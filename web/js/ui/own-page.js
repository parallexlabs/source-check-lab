import { initApp, markDirty, announce } from "./app.js";
import { t, getLang } from "./i18n.js";
import { splitIntoClaims } from "../core/claim-split.js";
import { exportVerificationCsv, exportVerificationMarkdown } from "../core/export.js";
import { createSharedModelPanel, renderHints, hintsUnlocked } from "./hints-panel.js";
import { INPUT_LIMITS } from "../core/constants.js";
import { validateDocuments, validateSummaryText } from "../core/input-limits.js";
import { indexAllDocuments, formatSentenceLabel } from "../core/sentences.js";

/** @type {Array<{ id: string, text: string, verdict: string, correction: string, hints: string, selected: string[] }>} */
let claims = [];
/** @type {ReturnType<typeof createSharedModelPanel>|null} */
let modelPanel = null;
/** @type {ReturnType<typeof indexAllDocuments>|null} */
let allSentences = [];
/** @type {Array<{ id: string, title: string, content: string }>} */
let sourceDocuments = [];

/**
 * @param {string} message
 * @param {string[]} [fieldIds]
 */
function showInputError(message, fieldIds = []) {
  clearInputError();
  let el = document.getElementById("own-input-error");
  if (!el) {
    el = document.createElement("p");
    el.id = "own-input-error";
    el.className = "input-error";
    el.setAttribute("role", "alert");
    document.getElementById("main")?.prepend(el);
  }
  el.textContent = message;
  for (const id of fieldIds) {
    const field = document.getElementById(id);
    if (!field) continue;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", "own-input-error");
  }
  const first = fieldIds[0] ? document.getElementById(fieldIds[0]) : null;
  first?.focus();
}

function clearInputError() {
  document.getElementById("own-input-error")?.remove();
  for (const id of ["own-sources", "own-summary"]) {
    const field = document.getElementById(id);
    field?.removeAttribute("aria-invalid");
    field?.removeAttribute("aria-describedby");
  }
}

function validateInputs() {
  const sources = document.getElementById("own-sources")?.value ?? "";
  const summary = document.getElementById("own-summary")?.value ?? "";
  const lang = document.getElementById("own-lang")?.value ?? getLang();
  const docs = parseSources(sources, lang);
  const docCheck = validateDocuments(docs, lang);
  if (!docCheck.ok) {
    showInputError(
      docCheck.error === "too_many_sentences"
        ? t("own_too_many_sentences", {
          count: docCheck.sentenceCount ?? 0,
          limit: docCheck.limit ?? INPUT_LIMITS.maxSentences,
        })
        : t("own_input_too_large"),
      ["own-sources"],
    );
    return false;
  }
  const summaryCheck = validateSummaryText(summary, lang);
  if (!summaryCheck.ok) {
    showInputError(
      summaryCheck.error === "too_many_sentences"
        ? t("own_too_many_sentences", {
          count: summaryCheck.sentenceCount ?? 0,
          limit: summaryCheck.limit ?? INPUT_LIMITS.maxSentences,
        })
        : t("own_input_too_large"),
      ["own-summary"],
    );
    return false;
  }
  clearInputError();
  return true;
}

function parseSources(text, _lang) {
  const parts = text.split(/\n\s*\n/).filter((p) => p.trim());
  return parts.map((content, i) => ({
    id: `src${i + 1}`,
    title: `Source ${i + 1}`,
    content: content.trim(),
    synthetic: false,
  }));
}

function getOwnLang() {
  return document.getElementById("own-lang")?.value ?? getLang();
}

function renderSourcePanel() {
  const el = document.getElementById("own-source-panel");
  if (!el) return;
  el.replaceChildren();
  if (sourceDocuments.length === 0 || allSentences.length === 0) {
    el.hidden = true;
    return;
  }
  el.hidden = false;

  const heading = document.createElement("h2");
  heading.textContent = t("practice_sources");
  el.appendChild(heading);

  for (const doc of sourceDocuments) {
    const block = document.createElement("article");
    block.className = "source-doc";
    const h3 = document.createElement("h3");
    h3.textContent = doc.title;
    block.appendChild(h3);
    const docSents = allSentences.filter((s) => s.docId === doc.id);
    for (const s of docSents) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sentence";
      btn.dataset.sentenceId = s.id;
      btn.setAttribute("aria-pressed", "false");
      btn.dir = "auto";
      const bdi = document.createElement("bdi");
      bdi.textContent = s.text;
      btn.appendChild(bdi);
      btn.addEventListener("click", () => toggleSentence(s.id, btn));
      block.appendChild(btn);
    }
    el.appendChild(block);
  }
}

/**
 * @param {string} id
 * @param {HTMLButtonElement} btn
 */
function toggleSentence(id, btn) {
  const activeClaim = document.querySelector(".claim-card.is-active");
  if (!activeClaim) return;
  const claim = claims.find((c) => c.id === activeClaim.dataset.claimId);
  if (!claim) return;
  const idx = claim.selected.indexOf(id);
  if (idx >= 0) {
    claim.selected.splice(idx, 1);
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
  } else {
    claim.selected.push(id);
    btn.classList.add("is-selected");
    btn.setAttribute("aria-pressed", "true");
  }
  markDirty();
  updateSelectedList(claim.id, activeClaim);
  modelPanel?.updateGate();
}

/**
 * @param {string} claimId
 * @param {HTMLElement} card
 */
function updateSelectedList(claimId, card) {
  const list = card.querySelector(".selected-list");
  if (!list) return;
  const claim = claims.find((c) => c.id === claimId);
  const sel = claim?.selected ?? [];
  if (sel.length === 0) {
    list.textContent = t("practice_no_sentences_yet");
    return;
  }
  list.replaceChildren();
  for (const id of sel) {
    const sentence = allSentences?.find((s) => s.id === id);
    const item = document.createElement("li");
    item.textContent = sentence
      ? `${formatSentenceLabel(sentence, getLang())}: ${sentence.text}`
      : id;
    list.appendChild(item);
  }
}

/**
 * @param {string} claimId
 */
function highlightSelectedSentences(claimId) {
  const claim = claims.find((c) => c.id === claimId);
  const sel = claim?.selected ?? [];
  document.querySelectorAll("#own-source-panel .sentence").forEach((btn) => {
    const on = sel.includes(btn.dataset.sentenceId);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderClaimsList() {
  const el = document.getElementById("claims-list");
  if (!el) return;
  el.replaceChildren();

  const lang = getOwnLang();

  if (!modelPanel) {
    modelPanel = createSharedModelPanel(el);
    modelPanel.setHandlers(
      async ({ embedding, nli }) => {
        const active = document.querySelector(".claim-card.is-active");
        if (!active) return;
        const claim = claims.find((c) => c.id === active.dataset.claimId);
        if (!claim) return;
        const hintBox = active.querySelector(".hint-box");
        if (!hintBox) return;
        try {
          const summary = await renderHints(hintBox, {
            documents: sourceDocuments,
            lang,
            claimText: claim.text,
            selectedSentenceIds: claim.selected,
            loadEmbedding: embedding,
            loadNli: nli,
            onModelProgress: (p) => modelPanel?.onModelProgress(p),
            hintsUnlocked: hintsUnlocked(claim),
          });
          modelPanel?.onModelDone();
          claim.hints = summary;
        } catch (err) {
          modelPanel?.onModelFail(err);
        }
      },
      () => {
        const active = document.querySelector(".claim-card.is-active");
        if (!active) return false;
        const claim = claims.find((c) => c.id === active.dataset.claimId);
        return hintsUnlocked(claim);
      },
    );
  }

  claims.forEach((claim, i) => {
    const card = document.createElement("article");
    card.className = "claim-card";
    card.dataset.claimId = claim.id;

    const textInput = document.createElement("textarea");
    textInput.value = claim.text;
    textInput.rows = 2;
    textInput.dir = "auto";
    textInput.className = "user-text";
    textInput.setAttribute("aria-label", t("practice_claim_n", { n: i + 1 }));
    textInput.addEventListener("input", () => {
      claim.text = textInput.value.slice(0, INPUT_LIMITS.maxClaimChars);
      textInput.value = claim.text;
      markDirty();
    });
    card.appendChild(textInput);

    const verdictField = document.createElement("fieldset");
    verdictField.className = "verdict-options";
    const legend = document.createElement("legend");
    legend.textContent = t("practice_verdict");
    verdictField.appendChild(legend);
    for (const v of ["supported", "partly_supported", "not_in_source", "contradicted", "sources_disagree"]) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `verdict-${claim.id}`;
      input.value = v;
      input.checked = claim.verdict === v;
      input.addEventListener("change", () => {
        claim.verdict = v;
        markDirty();
        modelPanel?.updateGate();
      });
      const span = document.createElement("span");
      span.textContent = t(`verdict_${v}`);
      label.append(input, span);
      verdictField.appendChild(label);
    }
    card.appendChild(verdictField);

    const evidenceNote = document.createElement("p");
    evidenceNote.className = "evidence-note";
    evidenceNote.textContent = t("practice_evidence_first");
    card.appendChild(evidenceNote);

    const selBlock = document.createElement("div");
    selBlock.className = "selected-block";
    const selStrong = document.createElement("strong");
    selStrong.textContent = `${t("practice_selected_sentences")}:`;
    const selList = document.createElement("ul");
    selList.className = "selected-list";
    selBlock.append(selStrong, selList);
    card.appendChild(selBlock);

    const corrWrap = document.createElement("div");
    corrWrap.className = "correction-field";
    const corrLabel = document.createElement("label");
    corrLabel.textContent = t("practice_correction");
    const corr = document.createElement("textarea");
    corr.rows = 3;
    corr.dir = "auto";
    corr.className = "user-text";
    corr.value = claim.correction;
    corr.addEventListener("input", () => {
      claim.correction = corr.value;
      markDirty();
    });
    corrLabel.appendChild(corr);
    corrWrap.append(corrLabel);
    card.appendChild(corrWrap);

    const hintBox = document.createElement("div");
    hintBox.className = "hint-box";
    hintBox.hidden = true;
    card.appendChild(hintBox);

    card.addEventListener("focusin", () => {
      document.querySelectorAll(".claim-card").forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");
      highlightSelectedSentences(claim.id);
      modelPanel?.updateGate();
    });
    if (i === 0) card.classList.add("is-active");

    el.appendChild(card);
    updateSelectedList(claim.id, card);
  });

  modelPanel?.updateGate();
  if (claims[0]) highlightSelectedSentences(claims[0].id);
}

function splitClaims() {
  if (!validateInputs()) return;
  const summary = document.getElementById("own-summary")?.value ?? "";
  const sources = document.getElementById("own-sources")?.value ?? "";
  const lang = getOwnLang();
  sourceDocuments = parseSources(sources, lang);
  allSentences = indexAllDocuments(sourceDocuments, lang);
  renderSourcePanel();
  const parts = splitIntoClaims(summary, lang).slice(0, INPUT_LIMITS.maxClaims);
  claims = parts.map((text, i) => ({
    id: `c${i + 1}`,
    text: text.slice(0, INPUT_LIMITS.maxClaimChars),
    verdict: "",
    correction: "",
    hints: "",
    selected: [],
  }));
  renderClaimsList();
  markDirty();
  announce(`${parts.length} claims`);
}

function addClaim() {
  if (claims.length >= INPUT_LIMITS.maxClaims) {
    showInputError(t("own_input_too_large"), ["own-summary"]);
    return;
  }
  claims.push({
    id: `c${claims.length + 1}`,
    text: "",
    verdict: "",
    correction: "",
    hints: "",
    selected: [],
  });
  renderClaimsList();
  markDirty();
}

function getExportRows() {
  return claims.map((c) => ({
    text: c.text,
    verdict: c.verdict,
    correction: c.correction,
    hintsSummary: c.hints,
  }));
}

function exportMd() {
  if (!validateInputs()) return;
  const lang = getOwnLang();
  const sources = document.getElementById("own-sources")?.value ?? "";
  const summary = document.getElementById("own-summary")?.value ?? "";
  const md = exportVerificationMarkdown({
    title: t("own_title"),
    lang,
    sourceText: sources,
    summaryText: summary,
    rows: getExportRows(),
    generatedAt: new Date().toISOString(),
    mode: "own",
  });
  downloadFile("verification-log.md", md, "text/markdown");
}

function exportCsv() {
  const lang = getOwnLang();
  const csv = exportVerificationCsv({
    lang,
    rows: getExportRows(),
    generatedAt: new Date().toISOString(),
    mode: "own",
  });
  downloadFile("verification-log.csv", csv, "text/csv");
}

/**
 * @param {string} name
 * @param {string} content
 * @param {string} mime
 */
function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function printView() {
  window.print();
}

async function main() {
  await initApp();
  document.getElementById("split-claims")?.addEventListener("click", splitClaims);
  document.getElementById("add-claim")?.addEventListener("click", addClaim);
  document.getElementById("export-md")?.addEventListener("click", exportMd);
  document.getElementById("export-csv")?.addEventListener("click", exportCsv);
  document.getElementById("print-view")?.addEventListener("click", printView);
}

main();
