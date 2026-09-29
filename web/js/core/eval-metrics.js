import { runDeterministicHints, hintsFlagErrorType } from "./deterministic.js";
import { nliAgreesWithKey } from "./nli.js";
import { documentsPlainText, indexAllDocuments, resolveSentenceRef } from "./sentences.js";

export { nliAgreesWithKey };

/**
 * Evaluate deterministic hints against answer key.
 * @param {object} claim
 * @param {object} set
 */
export function evalDeterministicForClaim(claim, set) {
  const srcLang = set.crossLanguage?.sourceLang ?? set.language;
  const allSentences = indexAllDocuments(set.documents, srcLang);
  const keyRefs = claim.answerKey.sourceSentences ?? [];
  const contextParts = keyRefs
    .map((ref) => resolveSentenceRef(ref, allSentences)?.text)
    .filter(Boolean);
  const contextText =
    contextParts.length > 0
      ? contextParts.join(" ")
      : documentsPlainText(set.documents);

  const hints = runDeterministicHints(claim.text, contextText, srcLang);
  const errorType = claim.answerKey.errorType;
  const hasError = Boolean(errorType);
  const flagged = hintsFlagErrorType(hints, errorType);

  return {
    claimId: claim.id,
    setId: set.id,
    language: set.language,
    errorType,
    hasError,
    flagged,
    hints,
    precisionRelevant: hints.length > 0,
    precisionCorrect: hints.length > 0 && flagged,
  };
}

/**
 * @param {object[]} sets
 */
export function aggregateDeterministicMetrics(results) {
  const byType = {};
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const r of results) {
    if (r.hasError) {
      if (r.flagged) tp += 1;
      else fn += 1;
      if (r.errorType) {
        if (!byType[r.errorType]) byType[r.errorType] = { tp: 0, fn: 0 };
        if (r.flagged) byType[r.errorType].tp += 1;
        else byType[r.errorType].fn += 1;
      }
    } else if (r.hints.length > 0) {
      fp += 1;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : null;
  const recall = tp + fn > 0 ? tp / (tp + fn) : null;

  return {
    n: results.length,
    uniqueClaims: new Set(results.map((r) => `${r.setId}:${r.claimId}`)).size,
    tp,
    fp,
    fn,
    precision,
    recall,
    byErrorType: byType,
  };
}

/**
 * Check if deciding sentence in top K embedding results.
 * @param {string[]} topIds
 * @param {string[]} decidingRefs
 */
export function evidenceInTopK(topIds, decidingRefs, k = 2) {
  const top = topIds.slice(0, k);
  return decidingRefs.some((ref) => top.includes(ref));
}

/**
 * Cosine similarity between two vectors.
 * @param {Float32Array|number[]} a
 * @param {Float32Array|number[]} b
 */
export function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Rank source sentences by embedding similarity (for Node eval).
 * @param {number[]} claimEmbed
 * @param {Array<{ id: string, embedding: number[] }>} sentenceEmbeddings
 * @param {number} topK
 */
export function rankByEmbedding(claimEmbed, sentenceEmbeddings, topK = 2) {
  const scored = sentenceEmbeddings.map((s) => ({
    id: s.id,
    score: cosineSimilarity(claimEmbed, s.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
