import { MODELS, TRANSFORMERS_VERSION } from "../core/constants.js";
import { validateModelPayload } from "../core/input-limits.js";

/** @type {Worker|null} */
let worker = null;
/** @type {Map<'embedding'|'nli', { promise: Promise<unknown>, reject: (err: Error) => void, loadId: string }>} */
const pendingLoads = new Map();
/** @type {Promise<unknown>} */
let loadChain = Promise.resolve();
let ready = false;
let embeddingLoaded = false;
let nliLoaded = false;

/**
 * @param {(progress: { kind: string, pct?: number, status?: string }) => void} onProgress
 */
function ensureWorker(onProgress) {
  if (worker) return worker;
  worker = new Worker("js/workers/model-worker.mjs", { type: "module" });
  worker.onmessage = (ev) => {
    const msg = ev.data;
    if (msg.type === "progress") onProgress(msg);
    if (msg.type === "ready") ready = true;
    if (msg.type === "embedding-ready") embeddingLoaded = true;
    if (msg.type === "nli-ready") nliLoaded = true;
    if (msg.type === "error") onProgress({ kind: "error", status: msg.error, phase: msg.phase });
  };
  worker.postMessage({ type: "init", transformersVersion: TRANSFORMERS_VERSION });
  return worker;
}

export function getModelStatus() {
  const loadingKinds = [...pendingLoads.keys()];
  return {
    ready,
    embeddingLoaded,
    nliLoaded,
    loading: loadingKinds.length > 0,
    loadingKinds,
    loadingKind: loadingKinds[0] ?? null,
  };
}

/**
 * @param {'embedding'|'nli'} modelKind
 * @param {(p: object) => void} onProgress
 */
export function loadModel(modelKind, onProgress) {
  if (modelKind === "embedding" && embeddingLoaded) {
    return Promise.resolve({ type: "embedding-ready" });
  }
  if (modelKind === "nli" && nliLoaded) {
    return Promise.resolve({ type: "nli-ready" });
  }
  const existing = pendingLoads.get(modelKind);
  if (existing) {
    return existing.promise;
  }

  const loadPromise = loadChain.then(() => performLoad(modelKind, onProgress));
  loadChain = loadPromise.catch(() => {});
  return loadPromise;
}

/**
 * @param {'embedding'|'nli'} modelKind
 * @param {(p: object) => void} onProgress
 */
function performLoad(modelKind, onProgress) {
  const w = ensureWorker(onProgress);
  const modelId =
    modelKind === "embedding" ? MODELS.embedding.id : MODELS.nli.id;
  const dtype =
    modelKind === "embedding" ? MODELS.embedding.dtype : MODELS.nli.dtype;
  const loadId = crypto.randomUUID();

  /** @type {(err: Error) => void} */
  let rejectFn = () => {};
  const promise = new Promise((resolve, reject) => {
    rejectFn = reject;
    const handler = (ev) => {
      const msg = ev.data;
      if (msg.loadId && msg.loadId !== loadId) return;
      if (msg.type === `${modelKind}-ready`) {
        w.removeEventListener("message", handler);
        pendingLoads.delete(modelKind);
        resolve(msg);
      }
      if (msg.type === "load-cancelled" && msg.modelKind === modelKind) {
        w.removeEventListener("message", handler);
        pendingLoads.delete(modelKind);
        reject(new Error("Load cancelled"));
      }
      if (msg.type === "error" && msg.phase === modelKind) {
        w.removeEventListener("message", handler);
        pendingLoads.delete(modelKind);
        reject(new Error(msg.error));
      }
    };
    w.addEventListener("message", handler);
    w.postMessage({ type: "load", modelKind, modelId, dtype, loadId });
  });

  pendingLoads.set(modelKind, { promise, reject: rejectFn, loadId });
  return promise;
}

export function cancelLoad() {
  const status = getModelStatus();
  const kind = status.loadingKind;
  if (!kind) return;

  const pending = pendingLoads.get(kind);
  if (pending) {
    pending.reject(new Error("Load cancelled"));
    pendingLoads.delete(kind);
    worker?.postMessage({ type: "cancel", modelKind: kind, loadId: pending.loadId });
  }
}

/**
 * @param {string} claim
 * @param {string[]} sentences
 */
export function embedRank(claim, sentences) {
  const check = validateModelPayload({ claim, sentences });
  if (!check.ok) return Promise.reject(new Error(check.error ?? "Payload too large"));
  return rpc("embed-rank", { claim, sentences });
}

/**
 * @param {string} claim
 * @param {string} evidence
 */
export function nliCheck(claim, evidence) {
  const check = validateModelPayload({ claim, evidence });
  if (!check.ok) return Promise.reject(new Error(check.error ?? "Payload too large"));
  return rpc("nli", { claim, evidence });
}

/**
 * @param {string} type
 * @param {object} payload
 */
function rpc(type, payload) {
  const w = worker;
  if (!w) return Promise.reject(new Error("Worker not started"));
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const handler = (ev) => {
      const msg = ev.data;
      if (msg.rpcId !== id) return;
      w.removeEventListener("message", handler);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
    };
    w.addEventListener("message", handler);
    w.postMessage({ type, rpcId: id, ...payload });
  });
}

export function terminateWorker() {
  for (const [, pending] of pendingLoads) {
    pending.reject(new Error("Worker terminated"));
  }
  pendingLoads.clear();
  worker?.terminate();
  worker = null;
  ready = false;
  embeddingLoaded = false;
  nliLoaded = false;
  loadChain = Promise.resolve();
}
