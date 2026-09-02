// 게임이 끝난 뒤 "이 단어 뜻이 뭐였지?" 복습용 사전 조회.
// 별도 API 키가 필요 없는 한국어 위키낱말사전(ko.wiktionary.org)의 공개 API를
// CORS(origin=*)로 직접 호출해서, "== 한국어 ==" 섹션의 뜻풀이(# ...)만 추려낸다.

const API_BASE = 'https://ko.wiktionary.org/w/api.php';
const cache = new Map();

function cleanWikitext(text) {
  return text
    .replace(/\[\[(?:[^\|\]]*\|)?([^\]]+)\]\]/g, '$1') // [[링크|표시]] / [[표시]] -> 표시
    .replace(/'''?/g, '') // '''굵게''', ''기울임'' 제거
    .replace(/\{\{[^{}]*\}\}/g, '') // {{템플릿}} 제거
    .replace(/<[^>]+>/g, '') // 남은 HTML 태그 제거
    .trim();
}

function parseKoreanDefinitions(wikitext) {
  // 위키낱말사전 한 페이지에는 여러 언어 섹션(== 한국어 ==, == 영어 == ...)이 섞여 있을 수 있어
  // 정규식 한 방보다 줄 단위로 훑는 게 훨씬 안전하다.
  let inKorean = false;
  const defs = [];
  for (const line of wikitext.split('\n')) {
    const level2 = line.match(/^==\s*([^=]+?)\s*==\s*$/);
    if (level2) {
      inKorean = level2[1].trim() === '한국어';
      continue;
    }
    if (!inKorean) continue;
    const defMatch = line.match(/^#(?!:)\s*(.+)$/);
    if (defMatch) {
      const cleaned = cleanWikitext(defMatch[1]);
      if (cleaned) defs.push(cleaned);
    }
  }
  return defs;
}

/**
 * @param {string} word
 * @returns {Promise<{word:string, definitions:string[]}|null>} null이면 못 찾은 것
 */
export async function lookupDefinition(word) {
  if (cache.has(word)) return cache.get(word);

  const promise = (async () => {
    try {
      const url = `${API_BASE}?action=parse&page=${encodeURIComponent(word)}&format=json&prop=wikitext&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error) return null;
      const wikitext = data.parse?.wikitext?.['*'];
      if (!wikitext) return null;
      const definitions = parseKoreanDefinitions(wikitext);
      if (definitions.length === 0) return null;
      return { word, definitions };
    } catch {
      return null;
    }
  })();

  cache.set(word, promise);
  const result = await promise;
  cache.set(word, result); // Promise 대신 최종 결과로 교체해 재조회 시 즉시 반환
  return result;
}
