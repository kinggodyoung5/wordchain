// ── 중앙화 설정 (Centralized) ─────────────────────────────────────────────
// 저장소에 커밋되는 "기본" Firebase 프로젝트 설정입니다.
// 팀/친구들과 같은 백엔드(Realtime DB)를 공유하고 싶다면 이 값을 실제 프로젝트 값으로 채우세요.
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 > 일반 > 내 앱 에서 확인할 수 있습니다.
// (모두 무료 Spark 요금제로 충분합니다.)
export const CENTRAL_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCyiS0Ki_B0ZKyWHlb6KN4MFeYOGvCnEK0',
  authDomain: 'wordchain-23737.firebaseapp.com',
  databaseURL: 'https://wordchain-23737-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'wordchain-23737',
  storageBucket: 'wordchain-23737.firebasestorage.app',
  messagingSenderId: '149469839512',
  appId: '1:149469839512:web:697f0fa6399d78ab82d0ed',
};

const LOCAL_STORAGE_KEY = 'kkeutmalitgi:firebaseConfig';

// ── 분산화 설정 (Decentralized) ──────────────────────────────────────────
// 사용자가 브라우저에서 직접 자신의 Firebase 프로젝트 config를 붙여넣으면
// localStorage에 저장되어, 저장소를 건드리지 않고도 자기만의 백엔드를 쓸 수 있습니다.
export function getLocalOverrideConfig() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLocalOverrideConfig(config) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
}

export function clearLocalOverrideConfig() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

export function getActiveFirebaseConfig() {
  const override = getLocalOverrideConfig();
  if (override && override.databaseURL) {
    return { config: override, source: 'local' };
  }
  return { config: CENTRAL_FIREBASE_CONFIG, source: 'central' };
}

export function isConfigured(config) {
  return Boolean(config && config.databaseURL && !config.databaseURL.includes('YOUR_PROJECT_ID'));
}

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];

export function validateConfigShape(config) {
  if (!config || typeof config !== 'object') return '올바른 JSON 객체가 아닙니다.';
  for (const key of REQUIRED_KEYS) {
    if (!config[key]) return `"${key}" 값이 필요합니다.`;
  }
  return null;
}
