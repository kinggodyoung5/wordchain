import { getActiveFirebaseConfig, isConfigured } from './firebaseConfig.js';

const SDK_VERSION = '11.0.2';
const BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const CONNECT_TIMEOUT_MS = 12000;

let appPromise = null;

/** 응답이 없는 네트워크 작업이 화면을 영원히 멈추게 두지 않도록 시간 제한을 건다. */
export function withTimeout(promise, ms, label = '요청') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} 시간 초과 (${ms / 1000}초)`);
      err.code = 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function connect() {
  const { config, source } = getActiveFirebaseConfig();
  if (!isConfigured(config)) {
    const err = new Error('NOT_CONFIGURED');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const [{ initializeApp }, { getDatabase }, { getAuth, signInAnonymously, onAuthStateChanged }] =
    await Promise.all([
      import(/* @vite-ignore */ `${BASE}/firebase-app.js`),
      import(/* @vite-ignore */ `${BASE}/firebase-database.js`),
      import(/* @vite-ignore */ `${BASE}/firebase-auth.js`),
    ]);

  const app = initializeApp(config);
  const db = getDatabase(app);
  const auth = getAuth(app);

  const uid = await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
        }
      },
      reject
    );
    signInAnonymously(auth).catch(reject);
  });

  return { app, db, auth, uid, source };
}

/**
 * Firebase 앱/DB/인증을 지연 초기화한다.
 * 성공한 연결만 캐시한다 — 실패(일시적인 네트워크 오류, 타임아웃 등)를 캐시하면
 * 새로고침 전까지 모든 시도가 같은 에러로 즉시 실패하는 "연동이 풀린" 상태가 된다.
 * @returns {Promise<{app:any, db:any, auth:any, uid:string, source:'central'|'local'}>}
 */
export function getFirebase() {
  if (!appPromise) {
    appPromise = withTimeout(connect(), CONNECT_TIMEOUT_MS, 'Firebase 연결').catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export function resetFirebase() {
  appPromise = null;
}

export async function getDbModule() {
  return import(/* @vite-ignore */ `${BASE}/firebase-database.js`);
}

/** Firebase 오류 코드를 사용자가 바로 조치할 수 있는 한국어 문장으로 바꾼다. */
export function describeFirebaseError(err) {
  const code = (err && err.code) || '';
  const message = (err && err.message) || '';
  if (code === 'NOT_CONFIGURED') return 'Firebase 설정이 비어 있어요.';
  if (code === 'TIMEOUT') {
    return '서버 응답이 없어요. 네트워크를 확인하거나, 같은 사이트를 연 다른 탭을 닫고 새로고침해 보세요.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return '익명 로그인이 꺼져 있어요. (Firebase 콘솔 → Authentication → 로그인 방법 → 익명 사용 설정)';
  }
  if (code === 'auth/network-request-failed') {
    return '네트워크에 연결할 수 없어요. 인터넷 연결(또는 학교/회사 방화벽)을 확인해 주세요.';
  }
  if (code.startsWith('auth/invalid-api-key') || code.startsWith('auth/api-key-not-valid')) {
    return 'Firebase API 키가 올바르지 않아요. 설정(톱니바퀴)을 확인해 주세요.';
  }
  if (code === 'auth/too-many-requests') {
    return '요청이 너무 많아 잠시 차단됐어요. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(message)) {
    return '접근 권한이 없어요. Realtime Database 보안 규칙을 확인해 주세요.';
  }
  return `알 수 없는 연결 오류예요${code ? ` (${code})` : ''}. 잠시 후 다시 시도해 주세요.`;
}

/**
 * 연결 점검: 설정 → 익명 로그인 → DB 읽기 → DB 쓰기를 순서대로 따로 확인해서
 * 어느 계층에서 막혔는지 알려준다. 임시 방(rooms/DIAGxxxx)을 만들었다가 지운다.
 * @returns {Promise<{step:string, ok:boolean, detail:string}[]>}
 */
export async function runDiagnostics() {
  const results = [];
  const push = (step, ok, detail = '') => results.push({ step, ok, detail });

  const { config, source } = getActiveFirebaseConfig();
  const configured = isConfigured(config);
  push('설정', configured, source === 'local' ? '내 브라우저 개인 설정 사용 중' : '중앙(공용) 설정 사용 중');
  if (!configured) return results;

  let fb;
  try {
    fb = await getFirebase();
    push('익명 로그인', true);
  } catch (err) {
    push('익명 로그인', false, describeFirebaseError(err));
    return results;
  }

  const { ref, get, set, remove, serverTimestamp } = await getDbModule();
  const metaRef = ref(fb.db, `rooms/DIAG${Math.floor(Math.random() * 9000 + 1000)}/meta`);

  try {
    await withTimeout(get(metaRef), 8000, 'DB 읽기');
    push('DB 읽기', true);
  } catch (err) {
    push('DB 읽기', false, describeFirebaseError(err));
    return results;
  }

  try {
    await withTimeout(
      set(metaRef, { hostUid: fb.uid, status: 'diag', createdAt: serverTimestamp() }),
      8000,
      'DB 쓰기'
    );
    push('DB 쓰기', true);
  } catch (err) {
    push('DB 쓰기', false, describeFirebaseError(err));
    return results;
  } finally {
    remove(metaRef).catch(() => {});
  }

  return results;
}
