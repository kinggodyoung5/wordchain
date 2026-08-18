import { loadDictionary } from './data/words.js';
import { loadProfanitySet } from './data/profanity.js';
import { SingleGame } from './game/single.js';
import { MultiGame } from './game/multi.js';
import {
  getLocalOverrideConfig,
  setLocalOverrideConfig,
  clearLocalOverrideConfig,
  validateConfigShape,
  getActiveFirebaseConfig,
} from './firebase/firebaseConfig.js';

const $ = (id) => document.getElementById(id);

const screens = {
  menu: $('screen-menu'),
  single: $('screen-single'),
  'multi-lobby': $('screen-multi-lobby'),
  'multi-room': $('screen-multi-room'),
  'multi-game': $('screen-multi-game'),
};
let currentScreenName = 'menu';
const history = [];

function showScreen(name, { push = true } = {}) {
  if (push && currentScreenName !== name) history.push(currentScreenName);
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  currentScreenName = name;
  $('btn-back').classList.toggle('hidden', name === 'menu');
}

function goBack() {
  const prev = history.pop() || 'menu';
  if (currentScreenName === 'single' && singleGame) {
    singleGame.destroy();
    singleGame = null;
  }
  if ((currentScreenName === 'multi-room' || currentScreenName === 'multi-game') && multiGame) {
    multiGame.leaveRoom();
  }
  showScreen(prev, { push: false });
}

$('btn-back').addEventListener('click', goBack);

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

let dict = null;
let profanitySet = null;
let singleGame = null;
let multiGame = null;

async function boot() {
  try {
    [dict, profanitySet] = await Promise.all([loadDictionary(), loadProfanitySet()]);
    $('dict-status').textContent = `완료 (${dict.fullSet.size.toLocaleString()}단어)`;
  } catch (err) {
    $('dict-status').textContent = '실패 — 새로고침 해주세요';
    console.error(err);
  }
}
boot();

// ── 메뉴 ──────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!dict) {
      toast('단어 사전을 아직 불러오는 중입니다…');
      return;
    }
    const mode = btn.dataset.mode;
    if (mode === 'single') startSingle();
    else showScreen('multi-lobby');
  });
});

// ── 싱글 모드 ─────────────────────────────────────────────────────────
function startSingle() {
  showScreen('single');
  if (singleGame) singleGame.destroy();
  singleGame = new SingleGame({
    dict,
    profanitySet,
    el: {
      form: $('single-form'),
      input: $('single-input'),
      banner: $('single-turn-banner'),
      currentChar: $('single-current-char'),
      timerFill: $('single-timer-fill'),
      log: $('single-word-log'),
      error: $('single-error'),
    },
    onEnd: ({ winner, reason }) => {
      showResult({
        emoji: winner === 'me' ? '🎉' : '🤖',
        title: winner === 'me' ? '승리했습니다!' : '패배했습니다',
        desc:
          reason === 'TIMEOUT'
            ? '시간 안에 답하지 못했어요.'
            : reason === 'BOT_STUCK'
              ? '봇이 더 이상 이을 단어를 찾지 못했어요!'
              : '',
        onClose: () => goBack(),
      });
    },
  });
  singleGame.start();
}

// ── 대결 모드 ─────────────────────────────────────────────────────────
const multiEl = {
  roomCodeDisplay: $('room-code-display'),
  roomPlayerList: $('room-player-list'),
  startBtn: $('btn-start-game'),
  roomWaitHint: $('room-wait-hint'),
  leaveRoomBtn: $('btn-leave-room'),
  leaveGameBtn: $('btn-leave-game'),
  playerOrder: $('multi-player-order'),
  turnBanner: $('multi-turn-banner'),
  currentCharEl: $('multi-current-char'),
  timerFill: $('multi-timer-fill'),
  wordLog: $('multi-word-log'),
  form: $('multi-form'),
  input: $('multi-input'),
  error: $('multi-error'),
};

function ensureMultiGame() {
  if (multiGame) return multiGame;
  multiGame = new MultiGame({
    dict,
    profanitySet,
    el: multiEl,
    callbacks: {
      currentScreen: () => currentScreenName,
      onRoomJoined: () => showScreen('multi-room'),
      onGameStarted: () => showScreen('multi-game'),
      onGameEnded: ({ iWon, winnerNickname }) => {
        showResult({
          emoji: iWon ? '🏆' : '💥',
          title: iWon ? '승리했습니다!' : '탈락했습니다',
          desc: !iWon && winnerNickname ? `${winnerNickname}님이 승리했습니다.` : '',
          onClose: () => {
            multiGame.detachListeners();
            multiGame = null;
            showScreen('menu', { push: false });
            history.length = 0;
          },
        });
      },
      onLeft: () => {
        showScreen('multi-lobby', { push: false });
      },
    },
  });
  return multiGame;
}

$('btn-create-room').addEventListener('click', async () => {
  const nickname = $('multi-nickname').value.trim();
  if (!nickname) return ($('multi-lobby-error').textContent = '닉네임을 입력해주세요.');
  $('multi-lobby-error').textContent = '';
  try {
    await ensureMultiGame().createRoom(nickname);
  } catch (err) {
    handleFirebaseError(err);
  }
});

$('btn-join-room').addEventListener('click', async () => {
  const nickname = $('multi-nickname').value.trim();
  const code = $('multi-room-code').value.trim();
  if (!nickname) return ($('multi-lobby-error').textContent = '닉네임을 입력해주세요.');
  if (!code) return ($('multi-lobby-error').textContent = '방 코드를 입력해주세요.');
  $('multi-lobby-error').textContent = '';
  try {
    await ensureMultiGame().joinRoom(code, nickname);
  } catch (err) {
    if (err && err.message && !err.code) $('multi-lobby-error').textContent = err.message;
    else handleFirebaseError(err);
  }
});

function handleFirebaseError(err) {
  if (err && err.code === 'NOT_CONFIGURED') {
    $('multi-lobby-error').textContent = 'Firebase가 설정되지 않았습니다. 우측 상단 ⚙️ 에서 설정해주세요.';
    openFirebaseModal();
  } else {
    console.error(err);
    $('multi-lobby-error').textContent = '연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
}

// ── 결과 모달 ─────────────────────────────────────────────────────────
function showResult({ emoji, title, desc, onClose }) {
  $('result-emoji').textContent = emoji;
  $('result-title').textContent = title;
  $('result-desc').textContent = desc || '';
  $('modal-result').classList.remove('hidden');
  const handler = () => {
    $('modal-result').classList.add('hidden');
    $('btn-result-close').removeEventListener('click', handler);
    onClose?.();
  };
  $('btn-result-close').addEventListener('click', handler);
}

// ── Firebase 설정 모달 ────────────────────────────────────────────────
function openFirebaseModal() {
  const { config, source } = getActiveFirebaseConfig();
  const override = getLocalOverrideConfig();
  $('firebase-config-input').value = override ? JSON.stringify(override, null, 2) : '';
  $('firebase-config-status').textContent =
    source === 'local' ? '현재: 내 브라우저 설정(분산화) 사용 중' : '현재: 중앙 설정(공용 프로젝트) 사용 중';
  $('modal-firebase').classList.remove('hidden');
}

$('btn-settings').addEventListener('click', openFirebaseModal);
$('btn-firebase-close').addEventListener('click', () => $('modal-firebase').classList.add('hidden'));

$('btn-firebase-save').addEventListener('click', () => {
  const raw = $('firebase-config-input').value.trim();
  if (!raw) {
    $('firebase-config-status').textContent = 'config JSON을 입력해주세요.';
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    $('firebase-config-status').textContent = 'JSON 형식이 올바르지 않습니다.';
    return;
  }
  const err = validateConfigShape(parsed);
  if (err) {
    $('firebase-config-status').textContent = err;
    return;
  }
  setLocalOverrideConfig(parsed);
  $('firebase-config-status').textContent = '저장되었습니다! 페이지를 새로고침합니다…';
  setTimeout(() => location.reload(), 800);
});

$('btn-firebase-reset').addEventListener('click', () => {
  clearLocalOverrideConfig();
  $('firebase-config-input').value = '';
  $('firebase-config-status').textContent = '중앙 설정으로 초기화되었습니다. 새로고침합니다…';
  setTimeout(() => location.reload(), 800);
});
