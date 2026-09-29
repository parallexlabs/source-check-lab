import {
  VERDICTS,
  verdictsMatch,
  ERROR_TYPE_LIST,
  DANGEROUS_ERROR_TYPES,
  ERROR_TYPES,
} from "./constants.js";

/**
 * Whether the answer key marks this claim as having an error.
 * @param {{ verdict: string, errorType: string|null }} answerKey
 */
export function claimHasError(answerKey) {
  if (answerKey.errorType) return true;
  if (answerKey.verdict === VERDICTS.SOURCES_DISAGREE) return true;
  return false;
}

/**
 * @param {Array<{ id: string, answerKey: { verdict: string, errorType: string|null } }>} claims
 * @param {Record<string, { verdict: string }>} userAnswers
 */
export function scorePracticeSet(claims, userAnswers) {
  let correct = 0;
  let missedErrors = 0;
  let falseAlarms = 0;
  const missedErrorTypes = new Set();
  const falseAlarmClaims = [];
  const missedErrorClaims = [];
  const dangerousMissed = new Set();
  const results = [];

  for (const claim of claims) {
    const user = userAnswers[claim.id]?.verdict ?? null;
    const key = claim.answerKey.verdict;
    const hasError = claimHasError(claim.answerKey);
    const match = user ? verdictsMatch(user, key) : false;

    if (match) correct += 1;

    const userRejected =
      user === VERDICTS.CONTRADICTED ||
      user === VERDICTS.NOT_IN_SOURCE ||
      user === VERDICTS.SOURCES_DISAGREE;

    if (hasError && !match) {
      missedErrors += 1;
      missedErrorClaims.push(claim.id);
      if (claim.answerKey.errorType) {
        missedErrorTypes.add(claim.answerKey.errorType);
        if (DANGEROUS_ERROR_TYPES.includes(claim.answerKey.errorType)) {
          dangerousMissed.add(claim.answerKey.errorType);
        }
      }
    } else if (!hasError && userRejected) {
      falseAlarms += 1;
      falseAlarmClaims.push(claim.id);
    }

    results.push({
      claimId: claim.id,
      userVerdict: user,
      keyVerdict: key,
      correct: match,
      errorType: claim.answerKey.errorType,
      hasError,
      isFalseAlarm: !hasError && userRejected,
      isMissedError: hasError && !match,
    });
  }

  const total = claims.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    correct,
    total,
    scorePct,
    missedErrors,
    falseAlarms,
    missedErrorTypes: [...missedErrorTypes],
    dangerousMissed: [...dangerousMissed],
    falseAlarmClaims,
    missedErrorClaims,
    results,
  };
}

/**
 * Compare verdict before and after hints against the answer key.
 * @param {string|null} preVerdict
 * @param {string|null} postVerdict
 * @param {string} keyVerdict
 * @returns {'better'|'worse'|'changed'|null}
 */
export function hintChangeDirection(preVerdict, postVerdict, keyVerdict) {
  if (!preVerdict || !postVerdict || preVerdict === postVerdict) return null;
  const preMatch = verdictsMatch(preVerdict, keyVerdict);
  const postMatch = verdictsMatch(postVerdict, keyVerdict);
  if (!preMatch && postMatch) return "better";
  if (preMatch && !postMatch) return "worse";
  return "changed";
}

/**
 * Summarize hint-induced verdict changes for debrief.
 * @param {Array<{ preVerdict: string|null, postVerdict: string|null, keyVerdict: string }>} changes
 */
export function summarizeHintChanges(changes) {
  let total = 0;
  let better = 0;
  let worse = 0;
  for (const c of changes) {
    const dir = hintChangeDirection(c.preVerdict, c.postVerdict, c.keyVerdict);
    if (!dir) continue;
    total += 1;
    if (dir === "better") better += 1;
    if (dir === "worse") worse += 1;
  }
  return { total, better, worse };
}

/**
 * Debrief message key based on score and missed types.
 * @param {number} scorePct
 * @param {string[]} missedErrorTypes
 * @param {string[]} dangerousMissed
 * @param {number} falseAlarms
 */
export function selectDebriefKey(scorePct, missedErrorTypes, dangerousMissed = [], falseAlarms = 0) {
  if (scorePct >= 90 && missedErrorTypes.length === 0 && falseAlarms === 0) {
    return "debrief_excellent";
  }
  if (dangerousMissed.length > 0) return "debrief_dangerous_errors";
  if (scorePct >= 70) return "debrief_good";
  if (
    missedErrorTypes.includes(ERROR_TYPES.WRONG_NUMBER) ||
    missedErrorTypes.includes(ERROR_TYPES.CONTRADICTION)
  ) {
    return "debrief_critical_errors";
  }
  if (falseAlarms >= 2) return "debrief_false_alarms";
  return "debrief_review";
}

/**
 * Penalize rejecting everything: count false rejections on supported claims.
 * @param {Array<{ answerKey: { verdict: string, errorType: string|null } }>} claims
 * @param {Record<string, { verdict: string }>} userAnswers
 */
export function countOverRejection(claims, userAnswers) {
  let count = 0;
  for (const claim of claims) {
    const user = userAnswers[claim.id]?.verdict;
    const key = claim.answerKey.verdict;
    if (
      user === VERDICTS.CONTRADICTED ||
      user === VERDICTS.NOT_IN_SOURCE
    ) {
      if (key === VERDICTS.SUPPORTED || key === VERDICTS.PARTLY_SUPPORTED) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Coverage stats for practice manifest validation.
 * @param {Array<{ language: string, claims: Array<{ answerKey: { errorType: string|null } }> }>} sets
 */
export function errorTypeCoverage(sets) {
  const coverage = { en: {}, fr: {} };
  for (const lang of ["en", "fr"]) {
    for (const et of ERROR_TYPE_LIST) {
      coverage[lang][et] = 0;
    }
  }
  for (const set of sets) {
    const lang = set.language;
    if (!coverage[lang]) continue;
    for (const claim of set.claims) {
      const et = claim.answerKey?.errorType;
      if (et && coverage[lang][et] !== undefined) {
        coverage[lang][et] += 1;
      }
    }
  }
  return coverage;
}

/**
 * Count error types in a single practice set (for facilitator debrief sheet).
 * @param {object} set
 */
export function errorTypeCountsForSet(set) {
  const counts = {};
  for (const et of ERROR_TYPE_LIST) counts[et] = 0;
  let cleanClaims = 0;
  for (const claim of set.claims ?? []) {
    const et = claim.answerKey?.errorType;
    if (et && counts[et] !== undefined) counts[et] += 1;
    else if (!et && !claimHasError(claim.answerKey)) cleanClaims += 1;
  }
  return { counts, cleanClaims, total: set.claims?.length ?? 0 };
}
