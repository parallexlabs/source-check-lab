import { runDeterministicHints } from "./deterministic.js";
import { documentsPlainText, indexAllDocuments } from "./sentences.js";

/**
 * Build hint context from selected sentence refs or full source.
 * @param {object} params
 * @param {Array<{ id: string, title: string, content: string }>} params.documents
 * @param {'en'|'fr'} params.lang
 * @param {string} params.claimText
 * @param {string[]} [params.selectedSentenceIds]
 */
export function buildHintContext({ documents, lang, claimText, selectedSentenceIds = [] }) {
  const allSentences = indexAllDocuments(documents, lang);
  let contextText;

  if (selectedSentenceIds.length > 0) {
    contextText = selectedSentenceIds
      .map((id) => allSentences.find((s) => s.id === id)?.text)
      .filter(Boolean)
      .join(" ");
  } else {
    contextText = documentsPlainText(documents);
  }

  const deterministic = runDeterministicHints(claimText, contextText, lang);

  return {
    contextText,
    allSentences,
    deterministic,
  };
}

/**
 * Format hints for display/export (no verdict).
 * @param {object} hintBundle
 */
export function summarizeHints(hintBundle) {
  const parts = [];
  for (const h of hintBundle.deterministic ?? []) {
    parts.push(h.messageKey + (h.detail ? `: ${h.detail}` : ""));
  }
  for (const e of hintBundle.embedding ?? []) {
    parts.push(`evidence:${e.id}(${e.score?.toFixed(2) ?? "?"})`);
  }
  if (hintBundle.nli?.probabilities) {
    const p = hintBundle.nli.probabilities;
    parts.push(
      `nli:e${p.entailment.toFixed(2)}/n${p.neutral.toFixed(2)}/c${p.contradiction.toFixed(2)}`,
    );
  }
  return parts.join("; ");
}
