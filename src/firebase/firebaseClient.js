import { getActiveFirebaseConfig, isConfigured } from './firebaseConfig.js';

const SDK_VERSION = '11.0.2';
const BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

let appPromise = null;

/**
 * Firebase 앱/DB/인증을 지연 초기화한다.
 * @returns {Promise<{app:any, db:any, auth:any, uid:string, source:'central'|'local'}>}
 */
export function getFirebase() {
  if (!appPromise) {
    appPromise = (async () => {
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
    })();
  }
  return appPromise;
}

export function resetFirebase() {
  appPromise = null;
}

export async function getDbModule() {
  return import(/* @vite-ignore */ `${BASE}/firebase-database.js`);
}
