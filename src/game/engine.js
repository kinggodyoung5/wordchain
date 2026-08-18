import { isHangulWord } from '../data/words.js';
import { containsProfanity } from '../data/profanity.js';
import { isValidChainStart, chainStartCandidates } from './dueum.js';

export const MIN_WORD_LENGTH = 2;

export const InvalidReason = {
  TOO_SHORT: 'TOO_SHORT',
  NOT_HANGUL: 'NOT_HANGUL',
  WRONG_START: 'WRONG_START',
  ALREADY_USED: 'ALREADY_USED',
  NOT_IN_DICTIONARY: 'NOT_IN_DICTIONARY',
  PROFANITY: 'PROFANITY',
};

export const InvalidMessage = {
  [InvalidReason.TOO_SHORT]: `${MIN_WORD_LENGTH}글자 이상 입력해주세요.`,
  [InvalidReason.NOT_HANGUL]: '한글 단어만 입력할 수 있습니다.',
  [InvalidReason.WRONG_START]: '이전 단어의 마지막 글자(두음법칙 포함)로 시작해야 해요.',
  [InvalidReason.ALREADY_USED]: '이미 사용된 단어예요.',
  [InvalidReason.NOT_IN_DICTIONARY]: '사전에 없는 단어예요.',
  [InvalidReason.PROFANITY]: '사용할 수 없는 단어예요.',
};

export function lastChar(word) {
  return word[word.length - 1];
}

/**
 * 끝말잇기 단어 검증. 시작 글자 판정은 문자열 그대로 비교하되,
 * 두음법칙(ㄴ/ㄹ이 어두에서 바뀌는 규칙)에 해당하는 경우만 예외로 허용한다.
 * 그 외 한글 자모 처리는 하지 않는다.
 */
export function validateWord(word, { requiredFirstChar, usedWords, dictionarySet, profanitySet }) {
  if (!word || word.length < MIN_WORD_LENGTH) {
    return { ok: false, reason: InvalidReason.TOO_SHORT };
  }
  if (!isHangulWord(word)) {
    return { ok: false, reason: InvalidReason.NOT_HANGUL };
  }
  if (requiredFirstChar && !isValidChainStart(requiredFirstChar, word[0])) {
    return { ok: false, reason: InvalidReason.WRONG_START };
  }
  if (usedWords.has(word)) {
    return { ok: false, reason: InvalidReason.ALREADY_USED };
  }
  if (profanitySet && containsProfanity(word, profanitySet)) {
    return { ok: false, reason: InvalidReason.PROFANITY };
  }
  if (!dictionarySet.has(word)) {
    return { ok: false, reason: InvalidReason.NOT_IN_DICTIONARY };
  }
  return { ok: true };
}

export function pickStartWord(commonList, usedWords = new Set()) {
  const candidates = commonList.filter((w) => w.length >= MIN_WORD_LENGTH && !usedWords.has(w));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 봇의 다음 단어 선택. 우선 상용 단어 목록에서 찾고, 없으면 전체 사전에서 찾는다.
 * 두음법칙 변형 시작 글자(예: '력' → '역')도 함께 후보로 검색한다.
 */
export function pickBotWord({ requiredFirstChar, usedWords, commonByFirstChar, fullByFirstChar }) {
  const startChars = chainStartCandidates(requiredFirstChar);

  const tryPool = (index) => {
    let candidates = [];
    for (const c of startChars) {
      const pool = index.get(c);
      if (pool) candidates = candidates.concat(pool.filter((w) => !usedWords.has(w)));
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  };
  return tryPool(commonByFirstChar) ?? tryPool(fullByFirstChar);
}
