/**
 * Locale-aware numeric and date token extraction for whole-token matching.
 */

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractNumericTokens(text) {
  const tokens = [];
  const patterns = [
    /\d{1,3}(?:[,\s]\d{3})+(?:[.,]\d+)?%?/g,
    /\d+(?:[.,]\d+)?%?/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0];
      const normalized = normalizeNumericToken(raw);
      if (normalized) tokens.push(normalized);
    }
  }
  return [...new Set(tokens)];
}

/**
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeNumericToken(raw) {
  let s = raw.replace(/\s/g, "");
  if (!s) return null;
  const hasPercent = s.endsWith("%");
  if (hasPercent) s = s.slice(0, -1);
  s = s.replace(/,/g, "");
  if (/^\d+\.\d+$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(",", ".");
  }
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  return hasPercent ? `${s}%` : s;
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
export function textContainsNumericToken(haystack, needle) {
  const target = normalizeNumericToken(needle);
  if (!target) return false;
  const tokens = extractNumericTokens(haystack);
  return tokens.includes(target);
}

const DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g,
  /\b\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\w*\s+\d{4}\b/gi,
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\w*\s+\d{1,2},?\s+\d{4}\b/gi,
  /\bQ[1-4]\s+\d{4}\b/gi,
  /\b\d{1,2}:\d{2}(?:\s*(?:a\.?m\.?|p\.?m\.?))?\b/gi,
  /\b\d{1,2}\s*h\s*\d{2}\b/gi,
  /\b\d{1,2}\s+(?:janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)\.?\s+\d{4}\b/gi,
  /\b(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{4}\b/gi,
  /\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}\s+(?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?\b/gi,
];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractDateTokens(text) {
  const found = [];
  for (const pattern of DATE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) found.push(...matches);
  }
  return [...new Set(found.map((d) => normalizeDateToken(d)))];
}

/**
 * @param {string} raw
 */
export function normalizeDateToken(raw) {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
export function textContainsDateToken(haystack, needle) {
  const target = normalizeDateToken(needle);
  const tokens = extractDateTokens(haystack);
  return tokens.includes(target);
}

/**
 * @param {string} haystack
 * @param {string} phrase
 */
export function textContainsPhraseTokens(haystack, phrase) {
  const words = phrase
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
  return pattern.test(haystack);
}

/**
 * @param {string} haystack
 * @param {string} evidence
 */
export function textContainsEvidence(haystack, evidence) {
  if (!evidence?.trim()) return true;
  const ev = evidence.trim();
  if (textContainsNumericToken(haystack, ev)) return true;
  if (textContainsDateToken(haystack, ev)) return true;
  return textContainsPhraseTokens(haystack, ev);
}
