import { INPUT_LIMITS } from "./constants.js";

/**
 * Rule-based sentence splitter (deterministic in Node and Chromium).
 * @param {string} text
 * @param {'en'|'fr'} lang
 * @returns {string[]}
 */
export function splitIntoSentences(text, lang) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  let protectedText = normalized;
  const placeholders = [];
  let idx = 0;

  /**
   * @param {string} match
   */
  function protect(match) {
    const key = `__PH${idx}__`;
    placeholders.push({ key, match });
    idx += 1;
    return key;
  }

  protectedText = protectedText.replace(/\d+[.,]\d+/g, protect);
  protectedText = protectedText.replace(/\d{1,2}\s*h\s*\d{2}/gi, protect);
  protectedText = protectedText.replace(
    /\d{1,2}:\d{2}(?:\s*(?:a\.?m\.?|p\.?m\.?))?/gi,
    protect,
  );
  protectedText = protectedText.replace(/\d{4}-\d{2}-\d{2}/g, protect);
  protectedText = protectedText.replace(/\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?(?:\s*%)?/g, protect);

  const abbrev =
    lang === "fr"
      ? /\b(?:p\.\s*ex|ex|cf|art|sect|vol|min|max|dr|pr|mme|mr|m|st|approx|etc|prof|dir)\./gi
      : /\b(?:e\.\s*g|i\.\s*e|vs|vol|min|max|dr|mr|ms|mrs|st|approx|etc|u\.\s*s|u\.\s*k)\./gi;
  protectedText = protectedText.replace(abbrev, protect);

  const splitRe =
    /(?<=[.!?…])(?:\s+)(?=[\d«"'\u00AB\u2018\u2019\u201C\u201D]|[a-zàâäéèêëïîôùûüÿç]|[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ])/u;

  const parts = protectedText
    .split(splitRe)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.map((sentence) => {
    let restored = sentence;
    for (const { key, match } of placeholders) {
      restored = restored.replaceAll(key, match);
    }
    return restored;
  });
}

/**
 * @param {string} text
 * @param {'en'|'fr'} lang
 * @param {number} [maxSentences]
 * @returns {{ ok: true, sentences: string[] } | { ok: false, error: string, sentenceCount: number, sentences: string[] }}
 */
export function splitIntoSentencesBounded(text, lang, maxSentences = INPUT_LIMITS.maxSentences) {
  const sentences = splitIntoSentences(text, lang);
  if (sentences.length > maxSentences) {
    return {
      ok: false,
      error: "too_many_sentences",
      sentenceCount: sentences.length,
      sentences: sentences.slice(0, maxSentences),
    };
  }
  return { ok: true, sentences };
}

/**
 * @param {{ id: string, title: string, content: string }} doc
 * @param {'en'|'fr'} lang
 * @returns {{ docId: string, docTitle: string, sentences: { id: string, index: number, text: string }[] }}
 */
export function indexDocument(doc, lang) {
  const sentences = splitIntoSentences(doc.content, lang).map((text, index) => ({
    id: `${doc.id}:s${index}`,
    index,
    text,
  }));
  return { docId: doc.id, docTitle: doc.title, sentences };
}

/**
 * @param {Array<{ id: string, title: string, content: string }>} documents
 * @param {'en'|'fr'} lang
 * @param {number} [maxSentences]
 */
export function indexAllDocuments(documents, lang, maxSentences = INPUT_LIMITS.maxSentences) {
  const all = [];
  for (const doc of documents) {
    const bounded = splitIntoSentencesBounded(doc.content, lang, maxSentences);
    if (!bounded.ok) {
      throw new Error(
        `Document ${doc.id} has ${bounded.sentenceCount} sentences (limit ${maxSentences})`,
      );
    }
    for (const [index, text] of bounded.sentences.entries()) {
      all.push({
        id: `${doc.id}:s${index}`,
        index,
        text,
        docId: doc.id,
        docTitle: doc.title,
      });
    }
    if (all.length > maxSentences) {
      throw new Error(`Total sentences ${all.length} exceeds limit ${maxSentences}`);
    }
  }
  return all;
}

/**
 * @param {string} ref e.g. "doc1:s2"
 * @param {ReturnType<typeof indexAllDocuments>} allSentences
 */
export function resolveSentenceRef(ref, allSentences) {
  return allSentences.find((s) => s.id === ref) ?? null;
}

/**
 * Human-readable label for a sentence reference.
 * @param {{ id: string, index: number, docTitle?: string, text: string }} sentence
 * @param {'en'|'fr'} uiLang
 */
export function formatSentenceLabel(sentence, uiLang) {
  const n = sentence.index + 1;
  if (uiLang === "fr") {
    return `Phrase ${n}, extrait ${sentence.docTitle ?? ""}`.trim();
  }
  return `Sentence ${n}, ${sentence.docTitle ?? "source excerpt"}`.trim();
}

/**
 * Full source plain text from documents.
 * @param {Array<{ content: string }>} documents
 */
export function documentsPlainText(documents) {
  return documents.map((d) => d.content).join("\n\n");
}

/**
 * @param {string} text
 * @param {'en'|'fr'} lang
 */
export function countSentences(text, lang) {
  return splitIntoSentences(text, lang).length;
}
