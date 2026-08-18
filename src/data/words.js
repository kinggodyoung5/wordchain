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
 * 난이도별 봇 단어 출제 범위(pool)를 만든다.
 * 실제 사용빈도 코퍼스 대신, 국립국어원 "한국어 학습용 어휘"로 이미 걸러진
 * commonList(상용 3천여 개)를 신뢰 가능한 기준으로 삼고, 그 위로는
 * 음절 수(2음절 → 상대적으로 기초 어휘, 3음절 이상 → 복합/전문 어휘 비중 증가)를
 * 보조 기준으로 사용한다. 완벽한 빈도 데이터는 아니지만 방향은 맞는 근사치다.
 *  - easy:   상용 단어만 (3,099개)
 *  - normal: 상용 단어 + 전체 사전의 2음절 단어 전부
 *  - hard:   전체 사전 (183,026개)
 */
function buildDifficultyPools(commonList, fullArray, fullSet) {
  const easyWords = commonList;

  const normalSet = new Set(commonList);
  for (const w of fullArray) {
    if (w.length === 2) normalSet.add(w);
  }

  return {
    easy: buildFirstCharIndex(easyWords),
    normal: buildFirstCharIndex([...normalSet]),
    hard: buildFirstCharIndex([...fullSet]),
  };
}

/**
 * @returns {Promise<{fullSet: Set<string>, commonList: string[], commonByFirstChar: Map<string,string[]>, fullByFirstChar: Map<string,string[]>, difficultyPools: {easy: Map, normal: Map, hard: Map}}>}
 */
export function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      const [common, full] = await Promise.all([
        fetchJson('./src/data/words-common.json'),
        fetchJson('./src/data/words-full.json'),
      ]);
      const fullSet = new Set(full);
      for (const w of common) fullSet.add(w);
      return {
        fullSet,
        commonList: common,
        commonByFirstChar: buildFirstCharIndex(common),
        fullByFirstChar: buildFirstCharIndex(full),
        difficultyPools: buildDifficultyPools(common, full, fullSet),
      };
    })();
  }
  return dictionaryPromise;
}

export function isHangulWord(word) {
  return HANGUL_RE.test(word);
}
