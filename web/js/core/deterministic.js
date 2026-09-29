/**
 * Deterministic hint checks (no ML). Points to patterns; never decides verdict.
 */

import {
  extractNumericTokens,
  extractDateTokens,
  textContainsNumericToken,
  textContainsDateToken,
} from "./numeric.js";

const HEDGING_EN = [
  "may",
  "might",
  "could",
  "possibly",
  "approximately",
  "about",
  "estimated",
  "likely",
  "unclear",
  "preliminary",
];
const HEDGING_FR = [
  "peut",
  "pourrait",
  "possiblement",
  "environ",
  "approximativement",
  "estimé",
  "probablement",
  "incertain",
  "préliminaire",
];

const CERTAINTY_EN = [
  "will",
  "must",
  "definitely",
  "certainly",
  "confirmed",
];
const CERTAINTY_FR = ["va", "doit", "certainement", "confirmé", "définitivement"];

const QUANTIFIERS_EN = [
  { weak: /\bsome\b/gi, strong: /\bmost\b/gi, all: /\ball\b/gi },
];
const QUANTIFIERS_FR = [
  { weak: /\bquelques\b/gi, strong: /\bla plupart\b/gi, all: /\btous\b/gi },
];

const NEGATION_EN = /\b(no|not|never|without|none)\b/gi;
const NEGATION_FR = /\b(pas|non|jamais|sans|aucun)\b/gi;

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractUnits(text) {
  const units = [
    "households",
    "individuals",
    "families",
    "people",
    "persons",
    "per week",
    "per month",
    "per day",
    "kg",
    "litres",
    "liters",
    "ménages",
    "personnes",
    "familles",
    "par semaine",
    "par mois",
    "par jour",
  ];
  const lower = text.toLowerCase();
  return units.filter((u) => lower.includes(u));
}

/**
 * Capitalized multi-word phrases as crude org/place detector.
 * @param {string} text
 * @returns {string[]}
 */
function extractNamedEntities(text) {
  const matches = text.match(
    /\b(?:[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][a-zàâäéèêëïîôùûüÿç]+(?:\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ][a-zàâäéèêëïîôùûüÿç]+)+)\b/g,
  );
  return matches ? [...new Set(matches)] : [];
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function extractQuotedPhrases(text) {
  const quoted = [];
  const patterns = [
    /"([^"]+)"/g,
    /«\s*([^»]+)\s*»/g,
    /'([^']+)'/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      if (m[1].trim().length > 2) quoted.push(m[1].trim());
    }
  }
  return quoted;
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
function containsNormalized(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * @param {string} claim
 * @param {string} contextText - selected sentences or full source
 * @param {'en'|'fr'} lang
 * @returns {Array<{ type: string, messageKey: string, detail: string, tokens?: string[] }>}
 */
export function runDeterministicHints(claim, contextText, lang) {
  const hints = [];
  const claimLower = claim.toLowerCase();
  const contextLower = contextText.toLowerCase();

  const claimNumbers = extractNumericTokens(claim);
  const sourceNumbers = extractNumericTokens(contextText);
  const missingNumbers = claimNumbers.filter(
    (n) => !textContainsNumericToken(contextText, n),
  );
  if (missingNumbers.length > 0) {
    const detail =
      sourceNumbers.length > 0
        ? `${claimNumbers.join(", ")} (claim) vs ${sourceNumbers.join(", ")} (source)`
        : missingNumbers.join(", ");
    hints.push({
      type: "number_mismatch",
      messageKey: "hint_number_not_in_source",
      detail,
      tokens: missingNumbers,
    });
  }

  const claimDates = extractDateTokens(claim);
  const missingDates = claimDates.filter((d) => !textContainsDateToken(contextText, d));
  if (missingDates.length > 0) {
    hints.push({
      type: "date_mismatch",
      messageKey: "hint_date_not_in_source",
      detail: missingDates.join(", "),
      tokens: missingDates,
    });
  }

  const claimUnits = extractUnits(claim);
  const contextUnits = extractUnits(contextText);
  const unitOnlyInClaim = claimUnits.filter(
    (u) => !contextUnits.some((cu) => cu.toLowerCase() === u.toLowerCase()),
  );
  if (unitOnlyInClaim.length > 0 && claimUnits.length > 0) {
    hints.push({
      type: "unit_mismatch",
      messageKey: "hint_unit_not_in_source",
      detail: unitOnlyInClaim.join(", "),
      tokens: unitOnlyInClaim,
    });
  }

  const claimEntities = extractNamedEntities(claim);
  const missingEntities = claimEntities.filter(
    (e) => !containsNormalized(contextText, e),
  );
  if (missingEntities.length > 0) {
    hints.push({
      type: "entity_mismatch",
      messageKey: "hint_entity_not_in_source",
      detail: missingEntities.join(", "),
      tokens: missingEntities,
    });
  }

  const hedging = lang === "fr" ? HEDGING_FR : HEDGING_EN;
  const certainty = lang === "fr" ? CERTAINTY_FR : CERTAINTY_EN;
  for (const h of hedging) {
    if (contextLower.includes(h) && !claimLower.includes(h)) {
      const hasCertainty = certainty.some((c) => claimLower.includes(c));
      if (hasCertainty || claimLower.includes("will") || claimLower.includes("va ")) {
        hints.push({
          type: "hedging_dropped",
          messageKey: "hint_hedging_dropped",
          detail: h,
          tokens: [h],
        });
        break;
      }
    }
  }

  const quantGroups = lang === "fr" ? QUANTIFIERS_FR : QUANTIFIERS_EN;
  for (const q of quantGroups) {
    const claimAll = q.all.test(claim);
    const sourceSome = q.weak.test(contextText) || q.strong.test(contextText);
    q.all.lastIndex = 0;
    q.weak.lastIndex = 0;
    q.strong.lastIndex = 0;
    if (claimAll && sourceSome && !q.all.test(contextText)) {
      hints.push({
        type: "quantifier_change",
        messageKey: "hint_quantifier_change",
        detail: lang === "fr" ? "tous vs quelques/la plupart" : "all vs some/most",
      });
      break;
    }
  }

  const negRe = lang === "fr" ? NEGATION_FR : NEGATION_EN;
  negRe.lastIndex = 0;
  const claimNeg = negRe.test(claim);
  negRe.lastIndex = 0;
  const sourceNeg = negRe.test(contextText);
  negRe.lastIndex = 0;
  if (claimNeg !== sourceNeg) {
    hints.push({
      type: "negation_mismatch",
      messageKey: "hint_negation_mismatch",
      detail: claimNeg ? "claim_negated" : "source_negated",
    });
  }

  const quoted = extractQuotedPhrases(claim);
  const badQuotes = quoted.filter((q) => !containsNormalized(contextText, q));
  if (badQuotes.length > 0) {
    hints.push({
      type: "quotation_mismatch",
      messageKey: "hint_quotation_not_in_source",
      detail: badQuotes.map((q) => `"${q}"`).join("; "),
      tokens: badQuotes,
    });
  }

  return hints;
}

/**
 * Map deterministic hint types to answer-key error types for evaluation.
 * @param {string} hintType
 * @returns {string|null}
 */
export function hintTypeToErrorType(hintType) {
  const map = {
    number_mismatch: "wrong_number",
    date_mismatch: "wrong_date_time",
    entity_mismatch: "wrong_place_actor",
    unit_mismatch: "unit_confusion",
    hedging_dropped: "lost_uncertainty",
    quantifier_change: "overgeneralization",
    negation_mismatch: "contradiction",
    quotation_mismatch: "invented_quotation",
  };
  return map[hintType] ?? null;
}

/**
 * Whether any deterministic hint flags the expected error type.
 * @param {Array<{ type: string }>} hints
 * @param {string|null} errorType
 */
export function hintsFlagErrorType(hints, errorType) {
  if (!errorType) return false;
  return hints.some((h) => hintTypeToErrorType(h.type) === errorType);
}
