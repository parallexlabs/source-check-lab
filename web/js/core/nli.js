import { VERDICTS } from "./constants.js";

/** Default id2label from MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7 config.json */
export const DEFAULT_NLI_ID2LABEL = Object.freeze({
  0: "entailment",
  1: "neutral",
  2: "contradiction",
});

/** Conservative char limit for ~512 token DeBERTa inputs (premise + hypothesis). */
export const NLI_MAX_CHARS = 480;

/**
 * @param {string} text
 * @param {number} [maxChars]
 */
export function truncateForNli(text, maxChars = NLI_MAX_CHARS) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}

/**
 * Build NLI inputs: premise = source evidence, hypothesis = claim.
 * @param {string} evidence
 * @param {string} claim
 */
export function buildNliInputs(evidence, claim) {
  return {
    premise: truncateForNli(evidence),
    hypothesis: truncateForNli(claim),
  };
}

/**
 * Normalize id2label from model config to ordered label names.
 * @param {Record<string, string>|undefined} id2label
 * @returns {string[]}
 */
export function orderedNliLabels(id2label = DEFAULT_NLI_ID2LABEL) {
  const entries = Object.entries(id2label).map(([id, label]) => [Number(id), label]);
  entries.sort((a, b) => a[0] - b[0]);
  return entries.map(([, label]) => label.toLowerCase());
}

/**
 * Parse sequence-classification output into three probabilities using id2label.
 * @param {Array<{ label: string, score: number }>|{ labels?: string[], scores?: number[] }} rawOutput
 * @param {Record<string, string>} [id2label]
 * @returns {{ entailment: number, neutral: number, contradiction: number }}
 */
export function parseNliProbabilities(rawOutput, id2label = DEFAULT_NLI_ID2LABEL) {
  const probs = { entailment: 0, neutral: 0, contradiction: 0 };
  /** @type {Array<{ label: string, score: number }>} */
  let entries = [];

  if (Array.isArray(rawOutput)) {
    entries = rawOutput.map((row) => ({
      label: String(row.label).toLowerCase(),
      score: row.score ?? 0,
    }));
  } else {
    const labels = rawOutput.labels ?? [];
    const scores = rawOutput.scores ?? [];
    for (let i = 0; i < labels.length; i++) {
      entries.push({ label: String(labels[i]).toLowerCase(), score: scores[i] ?? 0 });
    }
  }

  for (const row of entries) {
    if (row.label.includes("entail")) probs.entailment = row.score;
    else if (row.label.includes("contrad")) probs.contradiction = row.score;
    else if (row.label.includes("neutral")) probs.neutral = row.score;
  }

  if (
    entries.length === 3 &&
    probs.entailment === 0 &&
    probs.neutral === 0 &&
    probs.contradiction === 0
  ) {
    const ordered = orderedNliLabels(id2label);
    for (let i = 0; i < ordered.length; i++) {
      const score = entries[i]?.score ?? 0;
      if (ordered[i].includes("entail")) probs.entailment = score;
      else if (ordered[i].includes("contrad")) probs.contradiction = score;
      else probs.neutral = score;
    }
  }

  return probs;
}

/**
 * Map answer-key verdict to expected NLI label for evaluation agreement.
 * @param {string} verdict
 */
export function verdictToNliExpectation(verdict) {
  if (verdict === VERDICTS.SUPPORTED || verdict === VERDICTS.PARTLY_SUPPORTED) {
    return "entailment";
  }
  if (verdict === VERDICTS.CONTRADICTED) {
    return "contradiction";
  }
  return "neutral";
}

/**
 * @param {{ entailment: number, neutral: number, contradiction: number }} probs
 */
export function nliTopLabel(probs) {
  const entries = [
    ["entailment", probs.entailment],
    ["neutral", probs.neutral],
    ["contradiction", probs.contradiction],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * @param {string} nliLabel
 * @param {string} keyVerdict
 */
export function nliAgreesWithKey(nliLabel, keyVerdict) {
  return nliLabel === verdictToNliExpectation(keyVerdict);
}

/**
 * @param {ArrayLike<number>} logits
 */
export function softmaxLogits(logits) {
  const arr = Array.from(logits);
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/**
 * Map label scores to entailment / neutral / contradiction using id2label order.
 * @param {number[]} scores
 * @param {Record<string, string>} [id2label]
 */
export function probabilitiesFromScores(scores, id2label = DEFAULT_NLI_ID2LABEL) {
  const probs = { entailment: 0, neutral: 0, contradiction: 0 };
  const labels = orderedNliLabels(id2label);
  for (let i = 0; i < labels.length && i < scores.length; i++) {
    const score = scores[i];
    const label = labels[i];
    if (label.includes("entail")) probs.entailment = score;
    else if (label.includes("contrad")) probs.contradiction = score;
    else probs.neutral = score;
  }
  return probs;
}

/**
 * Run NLI with AutoTokenizer + sequence classification model (premise = evidence).
 * @param {object} tokenizer
 * @param {object} model
 * @param {string} evidence
 * @param {string} claim
 */
export async function runNliInference(tokenizer, model, evidence, claim) {
  const { premise, hypothesis } = buildNliInputs(evidence, claim);
  const inputs = tokenizer(premise, {
    text_pair: hypothesis,
    padding: true,
    truncation: true,
  });
  const { logits } = await model(inputs);
  const id2label = model.config?.id2label ?? DEFAULT_NLI_ID2LABEL;
  const scores = softmaxLogits(logits.data);
  return {
    probabilities: probabilitiesFromScores(scores, id2label),
    id2label,
  };
}
