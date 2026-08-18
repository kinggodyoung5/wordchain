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
 * 난이도별 봇 단어 출제 범위(pool).
 *  - easy:   words-easy.json (700개) — 국립국어원 "한국어 학습용 어휘"(2004)에서
 *            고유명사를 제외하고 실제 사용빈도 순으로 추린 상위 700개 명사.
 *            (부록:자주 쓰이는 한국어 낱말 5800, 한국어 위키낱말사전 기반 빈도 순위)
 *  - normal: words-common.json (3,036개) — 위 학습용 어휘 전체(고유명사 제거).
 *  - hard:   words-full.json (전체 사전, ~18만개).
 * easy/normal은 실제 빈도 데이터 + 고유명사 제거를 거쳤고, hard는 표준국어대사전
 * 명사 전체라 고유명사가 일부 섞여 있을 수 있다(예: 잘 알려지지 않은 지명/인명).
 */
function buildDifficultyPools(easyList, normalList, fullSet) {
  return {
    easy: buildFirstCharIndex(easyList),
    normal: buildFirstCharIndex(normalList),
    hard: buildFirstCharIndex([...fullSet]),
  };
}

/**
 * @returns {Promise<{fullSet: Set<string>, commonList: string[], easyList: string[], commonByFirstChar: Map<string,string[]>, fullByFirstChar: Map<string,string[]>, difficultyPools: {easy: Map, normal: Map, hard: Map}}>}
 */
export function loadDictionary() {
  if (!dictionaryPromise) {
    dictionaryPromise = (async () => {
      const [common, full, easy] = await Promise.all([
        fetchJson('./src/data/words-common.json'),
        fetchJson('./src/data/words-full.json'),
        fetchJson('./src/data/words-easy.json'),
      ]);
      const fullSet = new Set(full);
      for (const w of common) fullSet.add(w);
      return {
        fullSet,
        commonList: common,
        easyList: easy,
        commonByFirstChar: buildFirstCharIndex(common),
        fullByFirstChar: buildFirstCharIndex(full),
        difficultyPools: buildDifficultyPools(easy, common, fullSet),
      };
    })();
  }
  return dictionaryPromise;
}

export function isHangulWord(word) {
  return HANGUL_RE.test(word);
}
