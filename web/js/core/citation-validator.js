import { VERDICTS } from "./constants.js";
import {
  textContainsEvidence,
  textContainsPhraseTokens,
  extractNumericTokens,
  extractDateTokens,
} from "./numeric.js";
import { indexAllDocuments } from "./sentences.js";

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function wordsOverlap(a, b) {
  for (const w of a) {
    if (b.includes(w)) return true;
    const stem = w.slice(0, Math.min(5, w.length));
    if (stem.length >= 4 && b.some((s) => s.startsWith(stem) || w.startsWith(s.slice(0, 4)))) {
      return true;
    }
  }
  return false;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "were", "was", "are", "has", "have",
  "not", "but", "about", "into", "during", "between", "only", "all", "some", "may", "can",
  "les", "des", "une", "dans", "pour", "avec", "qui", "par", "sur", "est", "sont", "aux",
  "pas", "mais", "entre", "tout", "tous", "une", "ont", "été", "que", "du", "de", "la", "le",
]);

/**
 * @param {string} text
 * @returns {string[]}
 */
export function contentWords(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(tokens)];
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractEntities(text) {
  const matches = text.match(
    /\b(?:[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][a-zàâäéèêëïîôùûüÿç]+(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][a-zàâäéèêëïîôùûüÿç]+)+)\b/g,
  );
  return matches ? [...new Set(matches)] : [];
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
function containsEntityToken(haystack, needle) {
  return textContainsPhraseTokens(haystack, needle);
}

/**
 * @param {object} claim
 * @param {object} set
 * @param {ReturnType<typeof indexAllDocuments>} allSentences
 */
export function validateClaimCitation(claim, set, allSentences) {
  const errors = [];
  const ak = claim.answerKey;
  const refs = ak?.sourceSentences ?? [];
  const cited = refs
    .map((ref) => allSentences.find((s) => s.id === ref))
    .filter(Boolean);
  const citedText = cited.map((s) => s.text).join(" ");

  for (const ref of refs) {
    if (!allSentences.some((s) => s.id === ref)) {
      errors.push(`claim ${claim.id}: cited id ${ref} does not exist`);
    }
  }

  if (ak.verdict === VERDICTS.NOT_IN_SOURCE) {
    if (refs.length > 0) {
      errors.push(`claim ${claim.id}: not_in_source must cite no sentence`);
    }
    if (ak.evidence) {
      errors.push(
        `claim ${claim.id}: not_in_source must use absentEvidence, not evidence`,
      );
    }
    return { errors, cited, citedText };
  }

  if (refs.length === 0) {
    errors.push(`claim ${claim.id}: needs at least one cited sentence`);
    return { errors, cited, citedText };
  }

  if (ak.evidence) {
    const hasEvidence = cited.some((s) => textContainsEvidence(s.text, ak.evidence));
    if (!hasEvidence) {
      errors.push(
        `claim ${claim.id}: cited sentence(s) do not contain evidence "${ak.evidence}"`,
      );
    }
  }

  if (
    ak.verdict === VERDICTS.SUPPORTED ||
    ak.verdict === VERDICTS.PARTLY_SUPPORTED
  ) {
    if (!set.crossLanguage) {
      const claimWords = contentWords(claim.text);
      const sourceWords = contentWords(citedText);
      const overlap = wordsOverlap(claimWords, sourceWords);
      if (!overlap) {
        errors.push(
          `claim ${claim.id}: supported claim shares no content word with cited sentences`,
        );
      }
    }
  }

  if (ak.verdict === VERDICTS.CONTRADICTED) {
    const skipEntity =
      ak.errorType === "wrong_number" ||
      ak.errorType === "wrong_date_time" ||
      ak.errorType === "unit_confusion" ||
      ak.errorType === "wrong_place_actor";
    if (!skipEntity) {
      const entities = extractEntities(claim.text);
      for (const entity of entities) {
        const parts = entity.split(/\s+/).filter((p) => p.length >= 4);
        const matched =
          containsEntityToken(citedText, entity) ||
          parts.some((p) => containsEntityToken(citedText, p));
        if (!matched) {
          errors.push(
            `claim ${claim.id}: entity "${entity}" in claim not found in cited sentences`,
          );
        }
      }
    }
    const dates = extractDateTokens(claim.text);
    if (dates.length > 0 && extractDateTokens(citedText).length === 0) {
      errors.push(
        `claim ${claim.id}: date in claim but no date in cited sentences`,
      );
    }
    const nums = extractNumericTokens(claim.text);
    if (nums.length > 0 && extractNumericTokens(citedText).length === 0) {
      errors.push(
        `claim ${claim.id}: number in claim but no number in cited sentences`,
      );
    }
  }

  return { errors, cited, citedText };
}

/**
 * @param {object} set
 */
export function validateSetCitations(set) {
  const docLang = set.crossLanguage?.sourceLang ?? set.language;
  const allSentences = indexAllDocuments(set.documents, docLang);
  const rows = [];
  const errors = [];

  for (const claim of set.claims ?? []) {
    const result = validateClaimCitation(claim, set, allSentences);
    errors.push(...result.errors);
    rows.push({
      setId: set.id,
      claimId: claim.id,
      verdict: claim.answerKey.verdict,
      claimText: claim.text,
      evidence: claim.answerKey.evidence ?? null,
      absentEvidence: claim.answerKey.absentEvidence ?? null,
      refs: claim.answerKey.sourceSentences,
      citedSentences: result.cited.map((s) => ({ id: s.id, text: s.text })),
      errors: result.errors.filter((e) => e.startsWith(`claim ${claim.id}`)),
    });
  }

  return { rows, errors, allSentences };
}

/**
 * @param {object[]} sets
 */
export function validateAllCitations(sets) {
  const allRows = [];
  const allErrors = [];
  for (const set of sets) {
    const { rows, errors } = validateSetCitations(set);
    allRows.push(...rows);
    allErrors.push(...errors.map((e) => `${set.id}: ${e}`));
  }
  return { rows: allRows, errors: allErrors };
}

/**
 * Human-readable review lines for CLI output.
 * @param {ReturnType<typeof validateSetCitations>["rows"]} rows
 */
export function formatCitationReview(rows) {
  const lines = [];
  let currentSet = "";
  for (const row of rows) {
    if (row.setId !== currentSet) {
      currentSet = row.setId;
      lines.push("", `=== ${currentSet} ===`);
    }
    lines.push(`[${row.claimId}] ${row.verdict}`);
    lines.push(`  Claim: ${row.claimText}`);
    if (row.evidence) {
      lines.push(`  Evidence: ${row.evidence}`);
    }
    if (row.absentEvidence) {
      lines.push(`  Absent evidence: ${row.absentEvidence}`);
    }
    if (row.refs.length === 0) {
      lines.push("  Cited: (none)");
    } else {
      for (const s of row.citedSentences) {
        lines.push(`  Cited ${s.id}: ${s.text}`);
      }
    }
    if (row.errors.length) {
      for (const e of row.errors) lines.push(`  ERROR: ${e}`);
    }
  }
  return lines.join("\n");
}
