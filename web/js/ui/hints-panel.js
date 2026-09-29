import { buildHintContext, summarizeHints } from "../core/hints.js";
import { MODELS, FICTIONAL_WATERMARK } from "../core/constants.js";
import { classifyModelFailure, modelFailureMessage } from "../core/model-errors.js";
import { t } from "./i18n.js";
import * as modelBridge from "./model-bridge.js";
import { announce } from "./app.js";

/**
 * @param {object} set
 * @returns {'en'|'fr'}
 */
export function sourceLanguageForSet(set) {
  return set.crossLanguage?.sourceLang ?? set.language;
}

/**
 * Whether hints are unlocked for a claim.
 * @param {{ verdict?: string, selected?: string[] }} state
 */
export function hintsUnlocked(state) {
  return Boolean(state?.verdict) && (state?.selected?.length ?? 0) > 0;
}

/**
 * Plain-language negation hint detail.
 * @param {string} code
 */
export function formatNegationDetail(code) {
  if (code === "claim_negated") return t("hint_negation_claim");
  if (code === "source_negated") return t("hint_negation_source");
  return code;
}

/**
 * @param {HTMLElement} container
 */
export function createSharedModelPanel(container) {
  const wrap = document.createElement("div");
  wrap.className = "model-panel no-print";
  wrap.dataset.state = "idle";

  const status = document.createElement("p");
  status.className = "model-panel__status";
  status.textContent = t("practice_model_idle");

  const progress = document.createElement("div");
  progress.className = "model-panel__progress";
  progress.hidden = true;
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const fill = document.createElement("div");
  fill.className = "progress-bar__fill";
  fill.dataset.pct = "0";
  bar.appendChild(fill);
  const progressText = document.createElement("p");
  progressText.className = "progress-text";
  progress.append(bar, progressText);

  const actions = document.createElement("div");
  actions.className = "model-panel__actions";

  const showBtn = document.createElement("button");
  showBtn.type = "button";
  showBtn.className = "btn btn--ghost";
  showBtn.textContent = t("practice_show_hints");

  const embedBtn = document.createElement("button");
  embedBtn.type = "button";
  embedBtn.className = "btn btn--secondary";
  embedBtn.textContent = t("practice_load_embedding", {
    size: MODELS.embedding.approxDownloadMB,
  });

  const nliBtn = document.createElement("button");
  nliBtn.type = "button";
  nliBtn.className = "btn btn--secondary";
  nliBtn.textContent = t("practice_load_nli", { size: MODELS.nli.approxDownloadMB });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn--ghost";
  cancelBtn.textContent = t("practice_cancel_load");
  cancelBtn.hidden = true;

  actions.append(showBtn, embedBtn, nliBtn, cancelBtn);
  wrap.append(status, progress, actions);
  container.prepend(wrap);

  /** @type {((opts: { embedding: boolean, nli: boolean }) => void)|null} */
  let onRun = null;
  /** @type {(() => boolean)|null} */
  let canShowHints = null;

  function setState(state) {
    wrap.dataset.state = state;
  }

  function setProgress(pct, kind) {
    progress.hidden = false;
    cancelBtn.hidden = false;
    setState("loading");
    const rounded = Math.min(100, Math.max(0, Math.round((pct ?? 0) / 5) * 5));
    fill.className = "progress-bar__fill";
    fill.classList.add(`pct-${rounded}`);
    progressText.textContent = t("practice_model_loading", { pct: pct ?? 0 });
    status.textContent =
      kind === "nli" ? t("practice_model_loading_nli") : t("practice_model_loading_embed");
    announce(t("practice_model_loading", { pct: pct ?? 0 }));
  }

  function hideProgress() {
    progress.hidden = true;
    cancelBtn.hidden = true;
  }

  /**
   * @param {unknown} err
   * @param {'load'|'run'} phase
   */
  function updateGate() {
    const ok = canShowHints?.() ?? false;
    const st = modelBridge.getModelStatus();
    showBtn.disabled = !ok;
    if (st.loading) {
      const kind = st.loadingKind;
      embedBtn.disabled = !ok || kind !== "embedding";
      nliBtn.disabled = !ok || kind !== "nli";
    } else {
      embedBtn.disabled = !ok;
      nliBtn.disabled = !ok;
    }
  }

  function showModelFailure(err, phase) {
    const { category, detail } = classifyModelFailure(err, phase);
    hideProgress();
    setState("failed");
    status.textContent = `${modelFailureMessage(category, t)} (${detail})`;
    announce(status.textContent);
    refreshLabels();
    updateGate();
  }

  function refreshLabels() {
    const st = modelBridge.getModelStatus();
    if (st.loading) {
      const kind = st.loadingKind === "nli" ? "nli" : "embedding";
      embedBtn.disabled = kind !== "embedding";
      nliBtn.disabled = kind !== "nli";
      showBtn.disabled = !(canShowHints?.() ?? false);
      return;
    }
    if (st.embeddingLoaded && st.nliLoaded) {
      setState("ready");
      status.textContent = t("practice_model_ready_both");
      embedBtn.textContent = t("practice_run_embedding");
      nliBtn.textContent = t("practice_run_nli");
    } else if (st.embeddingLoaded) {
      setState("ready");
      status.textContent = t("practice_model_ready_embed");
      embedBtn.textContent = t("practice_run_embedding");
    } else if (st.nliLoaded) {
      setState("ready");
      status.textContent = t("practice_model_ready_nli");
      nliBtn.textContent = t("practice_run_nli");
    } else if (!st.loading) {
      setState("idle");
      status.textContent = t("practice_model_idle");
      embedBtn.textContent = t("practice_load_embedding", {
        size: MODELS.embedding.approxDownloadMB,
      });
      nliBtn.textContent = t("practice_load_nli", { size: MODELS.nli.approxDownloadMB });
    }
  }

  cancelBtn.addEventListener("click", () => {
    modelBridge.cancelLoad();
    hideProgress();
    setState("idle");
    status.textContent = t("practice_model_cancelled");
    refreshLabels();
    updateGate();
  });

  function wire(btn, opts) {
    btn.addEventListener("click", () => {
      if (!canShowHints?.()) return;
      onRun?.(opts);
    });
  }
  wire(showBtn, { embedding: false, nli: false });
  wire(embedBtn, { embedding: true, nli: false });
  wire(nliBtn, { embedding: true, nli: true });

  return {
    setHandlers(run, gate) {
      onRun = run;
      canShowHints = gate;
    },
    updateGate,
    onModelProgress(p) {
      if (p.kind === "error") {
        showModelFailure(new Error(p.status ?? "Model error"), p.phase === "nli" || p.phase === "embedding" ? "load" : "run");
        return;
      }
      if (p.kind === "download-end") {
        hideProgress();
        return;
      }
      if (p.pct != null) setProgress(p.pct, p.kind);
    },
    onModelDone() {
      hideProgress();
      refreshLabels();
      updateGate();
    },
    onModelFail(err) {
      showModelFailure(err ?? new Error("Model failed"), "run");
    },
    refreshLabels,
    showModelFailure,
  };
}

/**
 * Render hints for a claim (deterministic + optional models).
 * @param {HTMLElement} container
 * @param {object} opts
 */
export async function renderHints(container, opts) {
  const {
    documents,
    lang,
    claimText,
    selectedSentenceIds = [],
    loadEmbedding = false,
    loadNli = false,
    onModelProgress,
    crossLanguage = false,
    hintsUnlocked: unlocked = true,
  } = opts;

  container.innerHTML = "";
  container.hidden = true;

  if (!unlocked) {
    return "";
  }

  container.hidden = false;
  const label = document.createElement("p");
  label.className = "hint-box__label";
  label.textContent = t("hint_label");
  container.appendChild(label);

  if (crossLanguage) {
    const notice = document.createElement("p");
    notice.className = "notice notice--warn";
    notice.textContent = t("practice_crosslang_notice");
    container.appendChild(notice);
  }

  const bundle = buildHintContext({
    documents,
    lang,
    claimText,
    selectedSentenceIds,
  });

  const ul = document.createElement("ul");
  ul.className = "hint-list";
  for (const h of bundle.deterministic) {
    const li = document.createElement("li");
    const detail =
      h.type === "negation_mismatch" && h.detail
        ? `: ${formatNegationDetail(h.detail)}`
        : h.detail
          ? `: ${h.detail}`
          : "";
    li.textContent = `${t(h.messageKey)}${detail}`;
    if (h.type === "number_mismatch" && h.tokens?.length) {
      li.className = "hint--number-mismatch";
    }
    ul.appendChild(li);
  }
  if (bundle.deterministic.length === 0) {
    const li = document.createElement("li");
    li.textContent = t("practice_pattern_only");
    ul.appendChild(li);
  }
  container.appendChild(ul);

  const status = modelBridge.getModelStatus();
  let modelNote = "";

  if (loadEmbedding && !status.embeddingLoaded) {
    try {
      onModelProgress?.({ kind: "embedding", pct: 0 });
      await modelBridge.loadModel("embedding", onModelProgress);
      onModelProgress?.({ kind: "download-end" });
    } catch (err) {
      appendModelError(container, err, "load");
      return summarizeHints({ deterministic: bundle.deterministic });
    }
  }

  if (modelBridge.getModelStatus().embeddingLoaded) {
    try {
      const ranked = await modelBridge.embedRank(
        claimText,
        bundle.allSentences.slice(0, 120).map((s) => ({ id: s.id, text: s.text })),
      );
      bundle.embedding = ranked;
      for (const r of ranked) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = `${t("hint_evidence_top", { score: r.score.toFixed(2) })}: `;
        const excerpt = document.createElement("bdi");
        excerpt.dir = "auto";
        excerpt.textContent = r.text;
        li.append(label, excerpt);
        ul.appendChild(li);
      }
    } catch (err) {
      const { category, detail } = classifyModelFailure(err, "run");
      modelNote = `${modelFailureMessage(category, t)} (${detail})`;
    }
  }

  if (loadNli && !modelBridge.getModelStatus().nliLoaded) {
    try {
      onModelProgress?.({ kind: "nli", pct: 0 });
      await modelBridge.loadModel("nli", onModelProgress);
      onModelProgress?.({ kind: "download-end" });
    } catch (err) {
      appendModelError(container, err, "load");
      return summarizeHints(bundle);
    }
  }

  const evidenceText =
    selectedSentenceIds.length > 0
      ? selectedSentenceIds
        .map((id) => bundle.allSentences.find((s) => s.id === id)?.text)
        .filter(Boolean)
        .join(" ")
      : bundle.embedding?.[0]?.text ?? "";

  if (modelBridge.getModelStatus().nliLoaded && evidenceText) {
    try {
      const nli = await modelBridge.nliCheck(claimText, evidenceText);
      bundle.nli = nli;
      const nliBox = document.createElement("div");
      nliBox.className = "nli-probs";
      const title = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = t("hint_nli_probs_title");
      title.appendChild(strong);
      nliBox.appendChild(title);
      const probList = document.createElement("ul");
      probList.className = "hint-list";
      const probs = nli.probabilities;
      for (const [key, val] of [
        ["hint_nli_entailment", probs.entailment],
        ["hint_nli_neutral", probs.neutral],
        ["hint_nli_contradiction", probs.contradiction],
      ]) {
        const li = document.createElement("li");
        li.textContent = t(key, { pct: (val * 100).toFixed(1) });
        probList.appendChild(li);
      }
      nliBox.appendChild(probList);
      const limits = document.createElement("p");
      limits.className = "nli-limits";
      limits.textContent = `${t("hint_nli_limits", {
        xnliEn: (MODELS.nli.limits.xnliEn * 100).toFixed(1),
        xnliFr: (MODELS.nli.limits.xnliFr * 100).toFixed(1),
        anli: (MODELS.nli.limits.anliAll * 100).toFixed(1),
      })} `;
      const link = document.createElement("a");
      link.href = MODELS.nli.cardUrl;
      link.rel = "noopener noreferrer";
      link.textContent = t("hint_nli_card_link");
      limits.appendChild(link);
      nliBox.appendChild(limits);
      container.appendChild(nliBox);
    } catch (err) {
      const { category, detail } = classifyModelFailure(err, "run");
      modelNote = modelNote || `${modelFailureMessage(category, t)} (${detail})`;
    }
  }

  if (modelNote) {
    const note = document.createElement("p");
    note.className = "notice";
    note.textContent = modelNote;
    container.appendChild(note);
  }

  return summarizeHints(bundle);
}

/**
 * @param {HTMLElement} container
 * @param {unknown} err
 * @param {'load'|'run'} phase
 */
function appendModelError(container, err, phase) {
  const { category, detail } = classifyModelFailure(err, phase);
  const errEl = document.createElement("p");
  errEl.className = "error-state";
  errEl.textContent = `${modelFailureMessage(category, t)} (${detail})`;
  container.appendChild(errEl);
}

export { FICTIONAL_WATERMARK };
