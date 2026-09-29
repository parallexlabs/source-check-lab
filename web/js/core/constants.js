/** @typedef {'supported'|'partly_supported'|'not_in_source'|'contradicted'|'sources_disagree'} Verdict */

/** @typedef {'wrong_number'|'wrong_date_time'|'wrong_place_actor'|'unit_confusion'|'not_in_source'|'contradiction'|'lost_uncertainty'|'overgeneralization'|'omitted_caveat'|'invented_quotation'|'false_alarm'|'sources_disagree'|null} ErrorType */

export const VERDICTS = Object.freeze({
  SUPPORTED: "supported",
  PARTLY_SUPPORTED: "partly_supported",
  NOT_IN_SOURCE: "not_in_source",
  CONTRADICTED: "contradicted",
  SOURCES_DISAGREE: "sources_disagree",
});

export const ERROR_TYPES = Object.freeze({
  WRONG_NUMBER: "wrong_number",
  WRONG_DATE_TIME: "wrong_date_time",
  WRONG_PLACE_ACTOR: "wrong_place_actor",
  UNIT_CONFUSION: "unit_confusion",
  NOT_IN_SOURCE: "not_in_source",
  CONTRADICTION: "contradiction",
  LOST_UNCERTAINTY: "lost_uncertainty",
  OVERGENERALIZATION: "overgeneralization",
  OMITTED_CAVEAT: "omitted_caveat",
  INVENTED_QUOTATION: "invented_quotation",
  FALSE_ALARM: "false_alarm",
  SOURCES_DISAGREE: "sources_disagree",
});

export const ERROR_TYPE_LIST = Object.values(ERROR_TYPES).filter(
  (et) => et !== ERROR_TYPES.FALSE_ALARM && et !== ERROR_TYPES.SOURCES_DISAGREE,
);

/** Error types weighted most heavily in debrief feedback. */
export const DANGEROUS_ERROR_TYPES = Object.freeze([
  ERROR_TYPES.LOST_UNCERTAINTY,
  ERROR_TYPES.OMITTED_CAVEAT,
  ERROR_TYPES.OVERGENERALIZATION,
]);

export const FICTIONAL_WATERMARK =
  "FICTIONAL TRAINING DATA / DONNÉES FICTIVES DE FORMATION";

export const VERDICT_LABELS = Object.freeze({
  en: {
    supported: "Supported",
    partly_supported: "Partly supported",
    not_in_source: "Not in the source",
    contradicted: "Contradicted",
    sources_disagree: "Sources disagree",
  },
  fr: {
    supported: "Confirmé",
    partly_supported: "Partiellement confirmé",
    not_in_source: "Absent de la source",
    contradicted: "Contredit",
    sources_disagree: "Les sources divergent",
  },
});

export const TRANSFORMERS_VERSION = "4.3.0";
export const ONNXRUNTIME_WEB_VERSION = "1.31.0-dev.20260914-8d85527a0";

const TRANSFORMERS_CDN = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/`;
const ONNX_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNXRUNTIME_WEB_VERSION}/`;

/** Meta-tag CSP for pages that load optional on-device models (GitHub Pages has no response headers). */
export const CSP_MODEL_PAGES = [
  "default-src 'none'",
  `script-src 'self' ${TRANSFORMERS_CDN} 'wasm-unsafe-eval'`,
  `worker-src 'self' blob: ${TRANSFORMERS_CDN}`,
  `connect-src 'self' ${TRANSFORMERS_CDN} ${ONNX_CDN} https://huggingface.co https://cdn-lfs.hf.co https://cas-bridge.xethub.hf.co`,
  "img-src 'self' data:",
  "style-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

export const INPUT_LIMITS = Object.freeze({
  maxSourceChars: 50000,
  maxSummaryChars: 20000,
  maxClaimChars: 2000,
  maxSentenceChars: 2000,
  maxClaims: 40,
  maxSentences: 500,
  maxEmbedSentences: 120,
  maxNliEvidenceChars: 8000,
});

export const MODELS = Object.freeze({
  embedding: {
    id: "Xenova/multilingual-e5-small",
    revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
    dtype: "q8",
    approxDownloadMB: 113,
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    cardUrl: "https://huggingface.co/intfloat/multilingual-e5-small",
  },
  nli: {
    id: "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
    revision: "0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0",
    dtype: "q8",
    approxDownloadMB: 323,
    license: "MIT",
    licenseUrl: "https://opensource.org/licenses/MIT",
    cardUrl:
      "https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
    limits: Object.freeze({
      xnliEn: 0.871,
      xnliFr: 0.823,
      anliAll: 0.537,
      anliR3: 0.497,
    }),
  },
});

/** Scoring: user verdict matches if exact or partly_supported matches supported */
export function verdictsMatch(userVerdict, keyVerdict) {
  if (userVerdict === keyVerdict) return true;
  if (
    userVerdict === VERDICTS.SUPPORTED &&
    keyVerdict === VERDICTS.PARTLY_SUPPORTED
  ) {
    return true;
  }
  if (
    userVerdict === VERDICTS.PARTLY_SUPPORTED &&
    keyVerdict === VERDICTS.SUPPORTED
  ) {
    return true;
  }
  return false;
}
