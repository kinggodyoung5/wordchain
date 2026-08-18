let profanitySetPromise = null;

export function loadProfanitySet() {
  if (!profanitySetPromise) {
    profanitySetPromise = fetch('./src/data/profanity.json')
      .then((res) => res.json())
      .then((list) => new Set(list));
  }
  return profanitySetPromise;
}

export function containsProfanity(word, profanitySet) {
  if (profanitySet.has(word)) return true;
  for (const bad of profanitySet) {
    if (word.includes(bad)) return true;
  }
  return false;
}
