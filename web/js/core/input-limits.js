import { INPUT_LIMITS } from "./constants.js";
import { countSentences, splitIntoSentencesBounded } from "./sentences.js";

/**
 * @param {string} text
 * @param {'en'|'fr'} lang
 */
export function validateSourceText(text, lang) {
  if (text.length > INPUT_LIMITS.maxSourceChars) {
    return { ok: false, error: "too_large_source", limit: INPUT_LIMITS.maxSourceChars };
  }
  const bounded = splitIntoSentencesBounded(text, lang);
  if (!bounded.ok) {
    return {
      ok: false,
      error: "too_many_sentences",
      sentenceCount: bounded.sentenceCount,
      limit: INPUT_LIMITS.maxSentences,
    };
  }
  return { ok: true, sentenceCount: bounded.sentences.length };
}

/**
 * @param {Array<{ content: string }>} documents
 * @param {'en'|'fr'} lang
 */
export function validateDocuments(documents, lang) {
  let totalSentences = 0;
  for (const doc of documents) {
    const result = validateSourceText(doc.content, lang);
    if (!result.ok) return result;
    totalSentences += result.sentenceCount ?? 0;
  }
  if (totalSentences > INPUT_LIMITS.maxSentences) {
    return {
      ok: false,
      error: "too_many_sentences",
      sentenceCount: totalSentences,
      limit: INPUT_LIMITS.maxSentences,
    };
  }
  return { ok: true, sentenceCount: totalSentences };
}

/**
 * @param {string} summary
 * @param {'en'|'fr'} lang
 */
export function validateSummaryText(summary, lang) {
  if (summary.length > INPUT_LIMITS.maxSummaryChars) {
    return { ok: false, error: "too_large_summary", limit: INPUT_LIMITS.maxSummaryChars };
  }
  const sentenceCount = countSentences(summary, lang);
  if (sentenceCount > INPUT_LIMITS.maxSentences) {
    return {
      ok: false,
      error: "too_many_sentences",
      sentenceCount,
      limit: INPUT_LIMITS.maxSentences,
    };
  }
  return { ok: true, sentenceCount };
}

/**
 * @param {{ claim?: string, sentences?: Array<{ text?: string }>, evidence?: string }} payload
 */
export function validateModelPayload(payload) {
  const { claim, sentences, evidence } = payload;
  if (typeof claim === "string" && claim.length > INPUT_LIMITS.maxClaimChars) {
    return { ok: false, error: "claim_too_long", limit: INPUT_LIMITS.maxClaimChars };
  }
  if (typeof evidence === "string" && evidence.length > INPUT_LIMITS.maxNliEvidenceChars) {
    return { ok: false, error: "evidence_too_long", limit: INPUT_LIMITS.maxNliEvidenceChars };
  }
  if (Array.isArray(sentences)) {
    if (sentences.length > INPUT_LIMITS.maxEmbedSentences) {
      return {
        ok: false,
        error: "too_many_sentences",
        sentenceCount: sentences.length,
        limit: INPUT_LIMITS.maxEmbedSentences,
      };
    }
    for (const s of sentences) {
      const text = s?.text ?? "";
      if (text.length > INPUT_LIMITS.maxSentenceChars) {
        return { ok: false, error: "sentence_too_long", limit: INPUT_LIMITS.maxSentenceChars };
      }
    }
  }
  return { ok: true };
}
