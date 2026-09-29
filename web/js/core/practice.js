import { ERROR_TYPE_LIST, VERDICTS } from "./constants.js";
import { errorTypeCoverage, claimHasError } from "./scoring.js";
import { indexAllDocuments } from "./sentences.js";

const VALID_VERDICTS = new Set(Object.values(VERDICTS));

/**
 * @param {object} set
 */
export function isCleanSet(set) {
  return (set.claims ?? []).every((c) => !claimHasError(c.answerKey));
}

/**
 * @param {object} set
 */
export function hasDisagreeingSources(set) {
  return Boolean(set.sourcesDisagree) ||
    (set.claims ?? []).some((c) => c.answerKey?.verdict === VERDICTS.SOURCES_DISAGREE);
}

/**
 * @param {object} set
 */
export function isCrossLanguageSet(set) {
  return Boolean(set.crossLanguage?.sourceLang && set.crossLanguage?.summaryLang);
}

/**
 * @param {object} set
 */
export function validatePracticeSet(set) {
  const errors = [];
  if (!set.id) errors.push("missing id");
  if (!set.language || !["en", "fr"].includes(set.language)) {
    errors.push("invalid language");
  }
  if (!set.synthetic) errors.push("must be marked synthetic");
  if (!Array.isArray(set.documents) || set.documents.length < 1) {
    errors.push("need at least one document");
  }
  if (!Array.isArray(set.claims) || set.claims.length < 6 || set.claims.length > 10) {
    errors.push("claims count must be 6-10");
  }

  for (const doc of set.documents ?? []) {
    if (!doc.synthetic) errors.push(`document ${doc.id} not marked synthetic`);
  }

  for (const claim of set.claims ?? []) {
    if (!claim.text) errors.push(`claim ${claim.id} missing text`);
    const ak = claim.answerKey;
    if (!ak || !VALID_VERDICTS.has(ak.verdict)) {
      errors.push(`claim ${claim.id} invalid verdict`);
    }
    if (ak?.errorType && !ERROR_TYPE_LIST.includes(ak.errorType) &&
        ak.errorType !== "sources_disagree") {
      errors.push(`claim ${claim.id} invalid errorType`);
    }
    if (!Array.isArray(ak?.sourceSentences)) {
      errors.push(`claim ${claim.id} needs sourceSentences array`);
    } else if (
      ak.verdict !== VERDICTS.NOT_IN_SOURCE &&
      ak.sourceSentences.length < 1
    ) {
      errors.push(`claim ${claim.id} needs sourceSentences`);
    } else if (
      ak.verdict === VERDICTS.NOT_IN_SOURCE &&
      ak.sourceSentences.length > 0
    ) {
      errors.push(`claim ${claim.id} not_in_source must cite no sentence`);
    }
    if (!ak?.explanation) errors.push(`claim ${claim.id} needs explanation`);
  }

  return errors;
}

/**
 * @param {object[]} sets
 * @param {number} minPerLang
 * @param {number} minErrorTypeCount
 */
export function validatePracticeManifest(sets, minPerLang = 5, minErrorTypeCount = 2) {
  const errors = [];
  const en = sets.filter((s) => s.language === "en");
  const fr = sets.filter((s) => s.language === "fr");
  if (en.length < minPerLang) errors.push(`need ${minPerLang}+ EN sets`);
  if (fr.length < minPerLang) errors.push(`need ${minPerLang}+ FR sets`);

  for (const set of sets) {
    errors.push(...validatePracticeSet(set).map((e) => `${set.id}: ${e}`));
  }

  const coverage = errorTypeCoverage(sets);
  for (const lang of ["en", "fr"]) {
    for (const et of ERROR_TYPE_LIST) {
      if (coverage[lang][et] < minErrorTypeCount) {
        errors.push(`${lang} error type ${et} only ${coverage[lang][et]}x (need ${minErrorTypeCount})`);
      }
    }
  }

  const cleanCount = sets.filter(isCleanSet).length;
  if (cleanCount < 2) errors.push(`need 2+ clean sets (have ${cleanCount})`);

  const disagreeCount = sets.filter(hasDisagreeingSources).length;
  if (disagreeCount < 2) errors.push(`need 2+ sets with disagreeing sources (have ${disagreeCount})`);

  const crossCount = sets.filter(isCrossLanguageSet).length;
  if (crossCount < 2) errors.push(`need 2+ cross-language sets (have ${crossCount})`);

  return errors;
}

/**
 * Resolve answer key source sentence texts for display.
 * @param {object} set
 */
export function resolveAnswerKeySources(set) {
  const docLang = set.crossLanguage?.sourceLang ?? set.language;
  const all = indexAllDocuments(set.documents, docLang);
  return set.claims.map((claim) => ({
    ...claim,
    resolvedSources: (claim.answerKey.sourceSentences ?? [])
      .map((ref) => all.find((s) => s.id === ref))
      .filter(Boolean),
  }));
}
