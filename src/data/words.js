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
 * @returns {Promise<{fullSet: Set<string>, commonList: string[], commonByFirstChar: Map<string,string[]>, fullByFirstChar: Map<string,string[]>}>}
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
      };
    })();
  }
  return dictionaryPromise;
}

export function isHangulWord(word) {
  return HANGUL_RE.test(word);
}
