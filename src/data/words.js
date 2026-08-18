// 단어 사전 로딩: 검증용(대용량) + 봇/시작단어 선택용(상용 단어) 두 세트를 사용한다.
const HANGUL_RE = /^[가-힣]+$/;

let dictionaryPromise = null;

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`단어 목록을 불러오지 못했습니다: ${path}`);
  return res.json();
}

function buildFirstCharIndex(words) {
  const index = new Map();
  for (const w of words) {
    const c = w[0];
    let arr = index.get(c);
    if (!arr) index.set(c, (arr = []));
    arr.push(w);
  }
  return index;
}

/**
 * 난이도별 봇 단어 출제 범위(pool). 전부 같은 사용빈도 순위(국립국어원 "한국어
 * 학습용 어휘" 2004 + 한국어 위키낱말사전 "자주 쓰이는 한국어 낱말 5800"의
 * 고유명사 제거된 순위)에서 상위 N개를 자른 것이라 난이도가 오를수록
 * 이전 난이도를 그대로 포함한다.
 *  - veryEasy: 상위 500개 (words-veryeasy.json)
 *  - easy:     상위 700개 (words-easy.json)
 *  - normal:   상위 1,500개 (words-normal.json)
 *  - hard:     상위 2,500개 (words-hard.json)
 *  - veryHard: 전체 사전 (words-full.json, ~18만개) — 순위 밖 단어라
 *              고유명사가 일부 섞여 있을 수 있음 (아직 전체 정리는 못함).
 */
function buildDifficultyPools({ veryEasy, easy, normal, hard, fullSet }) {
  return {
    veryEasy: buildFirstCharIndex(veryEasy),
    easy: buildFirstCharIndex(easy),
    normal: buildFirstCharIndex(normal),
    hard: buildFirstCharIndex(hard),
    veryHard: buildFirstCharIndex([...fullSet]),
  };
}

/**
 * @returns {Promise<{fullSet: Set<string>, commonList: string[], easyList: string[], commonByFirstChar: Map<string,string[]>, fullByFirstChar: Map<string,string[]>, difficultyPools: {veryEasy: Map, easy: Map, normal: Map, hard: Map, veryHard: Map}}>}
 */
export function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      const [common, full, veryEasy, easy, normal, hard] = await Promise.all([
        fetchJson('./src/data/words-common.json'),
        fetchJson('./src/data/words-full.json'),
        fetchJson('./src/data/words-veryeasy.json'),
        fetchJson('./src/data/words-easy.json'),
        fetchJson('./src/data/words-normal.json'),
        fetchJson('./src/data/words-hard.json'),
      ]);
      const fullSet = new Set(full);
      for (const w of common) fullSet.add(w);
      return {
        fullSet,
        commonList: common,
        easyList: easy,
        commonByFirstChar: buildFirstCharIndex(common),
        fullByFirstChar: buildFirstCharIndex(full),
        difficultyPools: buildDifficultyPools({ veryEasy, easy, normal, hard, fullSet }),
      };
    })();
  }
  return dictionaryPromise;
}

export function isHangulWord(word) {
  return HANGUL_RE.test(word);
}
