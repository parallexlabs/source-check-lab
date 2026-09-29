import { splitIntoSentences } from "./sentences.js";

/**
 * Split a summary into verifiable claims (sentences and major clauses).
 * @param {string} summary
 * @param {'en'|'fr'} lang
 * @returns {string[]}
 */
export function splitIntoClaims(summary, lang) {
  const sentences = splitIntoSentences(summary, lang);
  const claims = [];

  for (const sentence of sentences) {
    const clauses = splitClauses(sentence, lang);
    if (clauses.length <= 1) {
      claims.push(sentence);
    } else {
      for (const clause of clauses) {
        const trimmed = clause.trim();
        if (trimmed.length > 12) claims.push(trimmed);
      }
    }
  }

  return dedupeClaims(claims);
}

/**
 * @param {string} sentence
 * @param {'en'|'fr'} lang
 */
function splitClauses(sentence, lang) {
  const splitters =
    lang === "fr"
      ? /;\s+|,\s+(?:et|mais|tandis que|alors que|ce qui|qui)\s+/i
      : /;\s+|,\s+(?:and|but|while|which|who|whereas)\s+/i;

  const parts = sentence.split(splitters).filter((p) => p.trim().length > 0);
  return parts.length > 1 ? parts : [sentence];
}

/**
 * @param {string[]} claims
 */
function dedupeClaims(claims) {
  const seen = new Set();
  const out = [];
  for (const c of claims) {
    const key = c.toLowerCase().replace(/\s+/g, " ");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}
