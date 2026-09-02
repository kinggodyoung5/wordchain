import { loadDictionary } from './data/words.js';
import { loadProfanitySet } from './data/profanity.js';
import { lookupDefinition } from './data/dictionary.js';
import { SingleGame } from './game/single.js';
import { Difficulty } from './game/engine.js';
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
  'single-difficulty': $('screen-single-difficulty'),
  single: $('screen-single'),
  'multi-lobby': $('screen-multi-lobby'),
  'multi-room': $('screen-multi-room'),
  'multi-game': $('screen-multi-game'),
  review: $('screen-review'),
};
let currentScreenName = 'menu';
const history = [];

function showScreen(name, { push = true } = {}) {
  if (push && currentScreenName !== name) history.push(currentScreenName);
  Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
  currentScreenName = name;
  $('btn-back').classList.toggle('hidden', name === 'menu' || name === 'review');
}

function goBack() {
  const prev = history.pop() || 'menu';
  if ((currentScreenName === 'single' || currentScreenName === 'review') && singleGame) {
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
document.querySelectorAll('#screen-menu .mode-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!dict) {
      toast('단어 사전을 아직 불러오는 중입니다…');
      return;
    }
    const mode = btn.dataset.mode;
    if (mode === 'single') showScreen('single-difficulty');
    else showScreen('multi-lobby');
  });
});

document.querySelectorAll('#screen-single-difficulty .mode-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    startSingle(btn.dataset.difficulty);
  });
});

// ── 싱글 모드 ─────────────────────────────────────────────────────────
function startSingle(difficulty = Difficulty.NORMAL) {
  showScreen('single');
  if (singleGame) singleGame.destroy();
  singleGame = new SingleGame({
    dict,
    profanitySet,
    difficulty,
    el: {
      form: $('single-form'),
      input: $('single-input'),
      banner: $('single-turn-banner'),
      currentChar: $('single-current-char'),
      timerFill: $('single-timer-fill'),
      log: $('single-word-log'),
      error: $('single-error'),
    },
    onEnd: ({ winner, reason, words }) => {
      showResult({
        emoji: winner === 'me' ? '🎉' : '🤖',
        title: winner === 'me' ? '승리했습니다!' : '패배했습니다',
        desc:
          reason === 'TIMEOUT'
            ? '시간 안에 답하지 못했어요.'
            : reason === 'BOT_STUCK'
              ? '봇이 더 이상 이을 단어를 찾지 못했어요!'
              : '',
        words,
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
      onGameEnded: ({ iWon, winnerNickname, words }) => {
        showResult({
          emoji: iWon ? '🏆' : '💥',
          title: iWon ? '승리했습니다!' : '탈락했습니다',
          desc: !iWon && winnerNickname ? `${winnerNickname}님이 승리했습니다.` : '',
          words,
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
function showResult({ emoji, title, desc, words, onClose }) {
  $('result-emoji').textContent = emoji;
  $('result-title').textContent = title;
  $('result-desc').textContent = desc || '';
  $('modal-result').classList.remove('hidden');
  const handler = () => {
    $('modal-result').classList.add('hidden');
    $('btn-result-close').removeEventListener('click', handler);
    if (words && words.length > 0) {
      showWordReview(words, onClose);
    } else {
      onClose?.();
    }
  };
  $('btn-result-close').addEventListener('click', handler);
}

// ── 단어 복습 화면 ────────────────────────────────────────────────────
function showWordReview(words, onDone) {
  const listEl = $('review-word-list');
  const defEl = $('review-definition');
  listEl.innerHTML = '';
  defEl.innerHTML = '<p class="review-placeholder">단어를 클릭하면 여기에 뜻이 나와요</p>';

  words.forEach((word) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'review-word-btn';
    btn.textContent = word;
    btn.addEventListener('click', () => {
      listEl.querySelectorAll('.review-word-btn.active').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      showDefinition(word, defEl);
    });
    listEl.appendChild(btn);
  });

  showScreen('review', { push: false });

  const closeHandler = () => {
    $('btn-review-close').removeEventListener('click', closeHandler);
    onDone?.();
  };
  $('btn-review-close').addEventListener('click', closeHandler);
}

async function showDefinition(word, defEl) {
  defEl.innerHTML = `<p class="def-loading">"${word}" 뜻을 찾는 중…</p>`;
  const result = await lookupDefinition(word);
  if (!result) {
    defEl.innerHTML = `
      <p class="def-word">${word}</p>
      <p class="review-placeholder">뜻풀이를 찾지 못했어요.</p>
      <span class="def-source"><a href="https://ko.wiktionary.org/wiki/${encodeURIComponent(word)}" target="_blank" rel="noopener">위키낱말사전에서 찾아보기 ↗</a></span>
    `;
    return;
  }
  const items = result.definitions.map((d) => `<li>${d}</li>`).join('');
  defEl.innerHTML = `
    <p class="def-word">${result.word}</p>
    <ol class="def-list">${items}</ol>
    <span class="def-source"><a href="https://ko.wiktionary.org/wiki/${encodeURIComponent(word)}" target="_blank" rel="noopener">한국어 위키낱말사전 ↗</a></span>
  `;
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
