// 두음법칙(頭音法則): 한자어 첫음절의 ㄴ/ㄹ이 조건에 따라 다른 소리로 바뀌는 한글 맞춤법 규칙
// (한글 맞춤법 제5장 제10~12항). 임의 치환이 아니라 아래 두 규칙만 자모 분해로 계산한다.
//
//  1) ㄴ/ㄹ + [이,야,여,예,요,유] → ㅇ + 같은 모음   (녀→여, 려→여, 니→이, 리→이 ...)
//  2) ㄹ + 그 외 모음(아,애,오,외,우,으 등)   → ㄴ + 같은 모음   (라→나, 로→노, 르→느, 릉→능 ...)
//
// 종성(받침)은 규칙과 무관하므로 그대로 유지한다.

const HANGUL_BASE = 0xAC00;
const HANGUL_LAST = 0xD7A3;
const CHO_COUNT = 19;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];

const Y_VOWELS = new Set(['ㅣ', 'ㅑ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ']); // 이 / 야 / 여 / 예 / 요 / 유
const NIEUN_IDX = CHO.indexOf('ㄴ');
const RIEUL_IDX = CHO.indexOf('ㄹ');
const IEUNG_IDX = CHO.indexOf('ㅇ');

function decompose(char) {
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return null;
  const offset = code - HANGUL_BASE;
  const cho = Math.floor(offset / (JUNG_COUNT * JONG_COUNT));
  const jung = Math.floor((offset % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT);
  const jong = offset % JONG_COUNT;
  return { cho, jung, jong };
}

function compose(choIdx, jungIdx, jongIdx) {
  return String.fromCharCode(HANGUL_BASE + (choIdx * JUNG_COUNT + jungIdx) * JONG_COUNT + jongIdx);
}

/**
 * 어두(단어 첫머리)에서의 두음법칙 변형을 반환한다. 규칙이 적용되지 않는 글자면 null.
 * @param {string} char 단일 한글 음절
 * @returns {string|null}
 */
export function dueumVariant(char) {
  if (!char || char.length !== 1) return null;
  const d = decompose(char);
  if (!d) return null;
  if (d.cho !== NIEUN_IDX && d.cho !== RIEUL_IDX) return null;

  if (Y_VOWELS.has(JUNG[d.jung])) {
    return compose(IEUNG_IDX, d.jung, d.jong); // 규칙 1: ㄴ/ㄹ + y계열모음 → ㅇ
  }
  if (d.cho === RIEUL_IDX) {
    return compose(NIEUN_IDX, d.jung, d.jong); // 규칙 2: ㄹ + 그 외 모음 → ㄴ
  }
  return null; // ㄴ + 일반 모음(나, 노 ...)은 원래도 어두에 올 수 있어 규칙 미적용
}

/**
 * prevLastChar로 끝난 단어 다음에, nextFirstChar로 시작하는 단어를 이어도 되는지 판정.
 * 문자 그대로 같거나, 두음법칙 변형과 같으면 허용한다.
 */
export function isValidChainStart(prevLastChar, nextFirstChar) {
  if (prevLastChar === nextFirstChar) return true;
  return dueumVariant(prevLastChar) === nextFirstChar;
}

/**
 * 화면에 보여줄 "현재 글자" 문자열. 두음법칙 변형이 있으면 함께 표기한다.
 * 예: '력' → "력 (또는 역)"
 */
export function formatChainChar(char) {
  const variant = dueumVariant(char);
  return variant ? `${char} (또는 ${variant})` : char;
}

/**
 * 현재 글자를 DOM 요소에 렌더링한다. 두음법칙 변형이 있으면 작은 보조 텍스트로 붙인다.
 * @param {HTMLElement} el
 * @param {string} char
 */
export function renderChainChar(el, char) {
  const variant = dueumVariant(char);
  el.textContent = '';
  const main = document.createElement('span');
  main.textContent = char;
  el.appendChild(main);
  if (variant) {
    const hint = document.createElement('span');
    hint.className = 'dueum-hint';
    hint.textContent = `(또는 ${variant})`;
    el.appendChild(hint);
  }
}

/**
 * 사전 검색 등에 쓸 수 있는, 허용되는 시작 글자 후보 배열 [원래글자, 변형(있으면)].
 */
export function chainStartCandidates(char) {
  const variant = dueumVariant(char);
  return variant ? [char, variant] : [char];
}
