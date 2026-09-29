import {
  runNliInference,
  DEFAULT_NLI_ID2LABEL,
} from "../core/nli.js";
import { MODELS } from "../core/constants.js";
import { validateModelPayload } from "../core/input-limits.js";

/** @type {import('@huggingface/transformers').FeatureExtractionPipeline|null} */
let embedder = null;
/** @type {import('@huggingface/transformers').PreTrainedTokenizer|null} */
let nliTokenizer = null;
/** @type {import('@huggingface/transformers').PreTrainedModel|null} */
let nliModel = null;
/** @type {Map<string, { modelKind: string, aborted: boolean }>} */
const activeLoads = new Map();
let transformersVersion = "4.3.0";
/** @type {Record<string, string>} */
let nliId2Label = { ...DEFAULT_NLI_ID2LABEL };

async function importTransformers() {
  const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${transformersVersion}`;
  return import(/* webpackIgnore: true */ url);
}

/**
 * @param {string|null|undefined} loadId
 */
function isLoadAborted(loadId) {
  if (!loadId) return false;
  return activeLoads.get(loadId)?.aborted ?? false;
}

/**
 * @param {string|null|undefined} loadId
 */
function finishLoad(loadId) {
  if (loadId) activeLoads.delete(loadId);
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      transformersVersion = msg.transformersVersion ?? transformersVersion;
      self.postMessage({ type: "ready" });
      return;
    }
    if (msg.type === "cancel") {
      const loadId = msg.loadId;
      if (loadId && activeLoads.has(loadId)) {
        activeLoads.get(loadId).aborted = true;
        self.postMessage({
          type: "load-cancelled",
          modelKind: msg.modelKind ?? activeLoads.get(loadId)?.modelKind,
          loadId,
        });
      }
      return;
    }
    if (msg.type === "load") {
      const loadId = msg.loadId ?? crypto.randomUUID();
      activeLoads.set(loadId, { modelKind: msg.modelKind, aborted: false });
      const { pipeline, AutoTokenizer, AutoModelForSequenceClassification, env } =
        await importTransformers();
      if (isLoadAborted(loadId)) {
        finishLoad(loadId);
        return;
      }
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      if (typeof env.backends?.onnx?.wasm !== "undefined") {
        env.backends.onnx.wasm.proxy = false;
      }
      try {
        if (typeof navigator !== "undefined" && navigator.gpu) {
          env.backends.onnx.preferredBackend = "webgpu";
        }
      } catch {
        /* webgpu optional */
      }

      const progress = (p) => {
        if (isLoadAborted(loadId)) return;
        const pct = p.progress != null ? Math.round(p.progress) : undefined;
        self.postMessage({ type: "progress", kind: msg.modelKind, pct, status: p.status, loadId });
      };

      const revision =
        msg.modelKind === "embedding"
          ? MODELS.embedding.revision
          : MODELS.nli.revision;

      const loadOpts = {
        dtype: msg.dtype,
        revision,
        progress_callback: progress,
      };

      if (msg.modelKind === "embedding") {
        embedder = await pipeline("feature-extraction", msg.modelId, loadOpts);
        if (isLoadAborted(loadId)) {
          embedder = null;
          finishLoad(loadId);
          return;
        }
        finishLoad(loadId);
        self.postMessage({ type: "embedding-ready", loadId });
      } else if (msg.modelKind === "nli") {
        nliTokenizer = await AutoTokenizer.from_pretrained(msg.modelId, loadOpts);
        if (isLoadAborted(loadId)) {
          nliTokenizer = null;
          finishLoad(loadId);
          return;
        }
        nliModel = await AutoModelForSequenceClassification.from_pretrained(
          msg.modelId,
          loadOpts,
        );
        if (isLoadAborted(loadId)) {
          nliTokenizer = null;
          nliModel = null;
          finishLoad(loadId);
          return;
        }
        const cfg = nliModel.config?.id2label;
        if (cfg) nliId2Label = cfg;
        finishLoad(loadId);
        self.postMessage({ type: "nli-ready", id2label: nliId2Label, loadId });
      }
      return;
    }

    if (msg.type === "embed-rank") {
      const check = validateModelPayload({ claim: msg.claim, sentences: msg.sentences });
      if (!check.ok) throw new Error(check.error ?? "Payload too large");
      if (!embedder) throw new Error("Embedding model not loaded");
      const claimVec = await embedVector(embedder, `query: ${msg.claim}`);
      const ranked = [];
      for (let i = 0; i < msg.sentences.length; i++) {
        const s = msg.sentences[i];
        const vec = await embedVector(embedder, `passage: ${s.text}`);
        ranked.push({ id: s.id, text: s.text, score: cosine(claimVec, vec) });
      }
      ranked.sort((a, b) => b.score - a.score);
      self.postMessage({ rpcId: msg.rpcId, result: ranked.slice(0, 2) });
      return;
    }

    if (msg.type === "nli") {
      const check = validateModelPayload({ claim: msg.claim, evidence: msg.evidence });
      if (!check.ok) throw new Error(check.error ?? "Payload too large");
      if (!nliTokenizer || !nliModel) throw new Error("NLI model not loaded");
      const { probabilities, id2label } = await runNliInference(
        nliTokenizer,
        nliModel,
        msg.evidence,
        msg.claim,
      );
      self.postMessage({
        rpcId: msg.rpcId,
        result: { probabilities, id2label, raw: probabilities },
      });
      return;
    }
  } catch (err) {
    if (msg.loadId) finishLoad(msg.loadId);
    self.postMessage({
      type: "error",
      phase: msg.modelKind,
      error: err?.message ?? String(err),
      rpcId: msg.rpcId,
      loadId: msg.loadId,
    });
    if (msg.rpcId) {
      self.postMessage({ rpcId: msg.rpcId, error: err?.message ?? String(err) });
    }
  }
};

async function embedVector(pipe, text) {
  const out = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
