import { initApp, markDirty, announce } from "./app.js";
import { t, getLang } from "./i18n.js";
import { indexAllDocuments, formatSentenceLabel } from "../core/sentences.js";
import {
  scorePracticeSet,
  selectDebriefKey,
  summarizeHintChanges,
} from "../core/scoring.js";
import { resolveAnswerKeySources } from "../core/practice.js";
import { VERDICTS, FICTIONAL_WATERMARK } from "../core/constants.js";
import {
  renderHints,
  createSharedModelPanel,
  sourceLanguageForSet,
  hintsUnlocked,
} from "./hints-panel.js";

/** @type {object|null} */
let currentSet = null;
/** @type {Record<string, { verdict: string, preHintVerdict: string, correction: string, selected: string[], hints: string, hintsShown: boolean }>} */
let userState = {};
/** @type {Map<string, { updateGate: () => void }>} */
const hintControlGates = new Map();
/** @type {ReturnType<typeof createSharedModelPanel>|null} */
let modelPanel = null;
/** @type {ReturnType<typeof indexAllDocuments>|null} */
let allSentences = [];

const VERDICT_OPTIONS = [
  VERDICTS.SUPPORTED,
  VERDICTS.PARTLY_SUPPORTED,
  VERDICTS.NOT_IN_SOURCE,
  VERDICTS.CONTRADICTED,
  VERDICTS.SOURCES_DISAGREE,
];

async function loadManifest() {
  const res = await fetch(new URL("../../data/manifest.json", import.meta.url));
  return res.json();
}

async function loadSet(path) {
  const res = await fetch(new URL(`../../data/${path}`, import.meta.url));
  return res.json();
}

function renderSetPicker(manifest) {
  const select = document.getElementById("set-select");
  if (!select) return;
  select.innerHTML = "";
  const lang = getLang();
  const sets = manifest.sets.filter((s) => s.language === lang);
  for (const s of sets) {
    const opt = document.createElement("option");
    opt.value = s.path;
    opt.textContent = s.title ?? s.id;
    select.appendChild(opt);
  }
}

function renderSources() {
  const el = document.getElementById("source-panel");
  if (!el || !currentSet) return;
  el.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = t("practice_sources");
  el.appendChild(heading);

  const watermark = document.createElement("div");
  watermark.className = "fictional-watermark";
  watermark.setAttribute("role", "note");
  watermark.setAttribute("aria-label", FICTIONAL_WATERMARK);
  watermark.textContent = FICTIONAL_WATERMARK;
  el.appendChild(watermark);

  if (currentSet.crossLanguage) {
    const notice = document.createElement("p");
    notice.className = "notice notice--warn";
    notice.textContent = t("practice_crosslang_notice");
    el.appendChild(notice);
  }

  const srcLang = sourceLanguageForSet(currentSet);
  allSentences = indexAllDocuments(currentSet.documents, srcLang);

  for (const doc of currentSet.documents) {
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
  const claimId = activeClaim.dataset.claimId;
  const state = userState[claimId] ?? emptyClaimState();
  const idx = state.selected.indexOf(id);
  if (idx >= 0) {
    state.selected.splice(idx, 1);
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
  } else {
    state.selected.push(id);
    btn.classList.add("is-selected");
    btn.setAttribute("aria-pressed", "true");
  }
  userState[claimId] = state;
  markDirty();
  updateSelectedList(claimId, activeClaim);
  modelPanel?.updateGate();
  hintControlGates.get(claimId)?.updateGate();
}

function emptyClaimState() {
  return {
    verdict: "",
    preHintVerdict: "",
    correction: "",
    selected: [],
    hints: "",
    hintsShown: false,
  };
}

/**
 * @param {string} claimId
 * @param {HTMLElement} card
 */
function updateSelectedList(claimId, card) {
  const list = card.querySelector(".selected-list");
  if (!list) return;
  const sel = userState[claimId]?.selected ?? [];
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

function renderClaims() {
  const el = document.getElementById("claims-panel");
  if (!el || !currentSet) return;
  el.replaceChildren();
  hintControlGates.clear();

  const heading = document.createElement("h2");
  heading.textContent = t("practice_claims");
  el.appendChild(heading);

  modelPanel = createSharedModelPanel(el);
  modelPanel.setHandlers(
    async ({ embedding, nli }) => {
      const active = document.querySelector(".claim-card.is-active");
      if (!active) return;
      const claimId = active.dataset.claimId;
      const claim = currentSet.claims.find((c) => c.id === claimId);
      if (!claim) return;
      const hintBox = active.querySelector(".hint-box");
      if (!hintBox) return;

      const st = userState[claimId] ?? emptyClaimState();
      if (!st.preHintVerdict && st.verdict) st.preHintVerdict = st.verdict;
      st.hintsShown = true;
      userState[claimId] = st;

      try {
        const summary = await renderHints(hintBox, {
          documents: currentSet.documents,
          lang: sourceLanguageForSet(currentSet),
          claimText: claim.text,
          selectedSentenceIds: st.selected,
          loadEmbedding: embedding,
          loadNli: nli,
          onModelProgress: (p) => modelPanel?.onModelProgress(p),
          crossLanguage: Boolean(currentSet.crossLanguage),
          hintsUnlocked: hintsUnlocked(st),
        });
        modelPanel?.onModelDone();
        userState[claimId] = { ...userState[claimId], hints: summary };
      } catch (err) {
        modelPanel?.onModelFail(err);
      }
    },
    () => {
      const active = document.querySelector(".claim-card.is-active");
      if (!active) return false;
      return hintsUnlocked(userState[active.dataset.claimId]);
    },
  );

  currentSet.claims.forEach((claim, i) => {
    const card = document.createElement("article");
    card.className = "claim-card";
    card.dataset.claimId = claim.id;
    if (i === 0) card.classList.add("is-active");

    const h = document.createElement("h3");
    h.textContent = t("practice_claim_n", { n: i + 1 });
    card.appendChild(h);

    const p = document.createElement("p");
    p.className = "user-text";
    p.dir = "auto";
    p.textContent = claim.text;
    card.appendChild(p);

    const verdictField = document.createElement("fieldset");
    verdictField.className = "verdict-options";
    const legend = document.createElement("legend");
    legend.textContent = t("practice_verdict");
    verdictField.appendChild(legend);
    for (const v of VERDICT_OPTIONS) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `verdict-${claim.id}`;
      input.value = v;
      input.addEventListener("change", () => {
        const st = userState[claim.id] ?? emptyClaimState();
        userState[claim.id] = { ...st, verdict: v };
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

    const corrWrap = document.createElement("div");
    corrWrap.className = "correction-field";
    const corrLabel = document.createElement("label");
    corrLabel.textContent = t("practice_correction");
    const corr = document.createElement("textarea");
    corr.rows = 3;
    corr.dir = "auto";
    corr.addEventListener("input", () => {
      const st = userState[claim.id] ?? emptyClaimState();
      userState[claim.id] = { ...st, correction: corr.value };
      markDirty();
    });
    corrLabel.appendChild(corr);
    corrWrap.append(corrLabel);
    card.appendChild(corrWrap);

    const selBlock = document.createElement("div");
    selBlock.className = "selected-block";
    const selStrong = document.createElement("strong");
    selStrong.textContent = `${t("practice_selected_sentences")}:`;
    const selList = document.createElement("ul");
    selList.className = "selected-list";
    selBlock.append(selStrong, selList);
    card.appendChild(selBlock);

    const hintBox = document.createElement("div");
    hintBox.className = "hint-box";
    hintBox.hidden = true;
    hintBox.id = `hints-${claim.id}`;
    card.appendChild(hintBox);

    hintControlGates.set(claim.id, {
      updateGate: () => modelPanel?.updateGate(),
    });

    card.addEventListener("focusin", () => {
      document.querySelectorAll(".claim-card").forEach((c) => c.classList.remove("is-active"));
      card.classList.add("is-active");
      highlightSelectedSentences(claim.id);
      modelPanel?.updateGate();
    });

    card.tabIndex = 0;
    el.appendChild(card);
    userState[claim.id] = emptyClaimState();
    updateSelectedList(claim.id, card);
  });

  modelPanel.updateGate();
}

/**
 * @param {string} claimId
 */
function highlightSelectedSentences(claimId) {
  const sel = userState[claimId]?.selected ?? [];
  document.querySelectorAll(".sentence").forEach((btn) => {
    const on = sel.includes(btn.dataset.sentenceId);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function feedbackForClaim(claim, user, match) {
  if (match) return t("feedback_correct");
  const ak = claim.answerKey;
  if (ak.verdict === VERDICTS.SOURCES_DISAGREE) {
    return t("feedback_sources_disagree");
  }
  if (!ak.errorType && (user?.verdict === VERDICTS.CONTRADICTED || user?.verdict === VERDICTS.NOT_IN_SOURCE)) {
    return t("feedback_false_alarm");
  }
  if (ak.errorType) {
    return `${t("feedback_missed_error")} (${t(`error_${ak.errorType}`)})`;
  }
  return t("feedback_missed_error");
}

function formatSourceLine(claim) {
  if (claim.answerKey.verdict === VERDICTS.NOT_IN_SOURCE || claim.resolvedSources.length === 0) {
    return t("debrief_no_source_sentence");
  }
  return claim.resolvedSources.map((s) => s.text).join(" ");
}

function renderResults() {
  const el = document.getElementById("results-panel");
  if (!el || !currentSet) return;

  const answers = {};
  for (const [id, st] of Object.entries(userState)) {
    answers[id] = { verdict: st.verdict };
  }
  const score = scorePracticeSet(currentSet.claims, answers);
  const debriefKey = selectDebriefKey(
    score.scorePct,
    score.missedErrorTypes,
    score.dangerousMissed,
    score.falseAlarms,
  );

  const hintChanges = currentSet.claims
    .filter((c) => userState[c.id]?.hintsShown && userState[c.id]?.preHintVerdict)
    .map((c) => ({
      preVerdict: userState[c.id].preHintVerdict,
      postVerdict: userState[c.id].verdict,
      keyVerdict: c.answerKey.verdict,
    }));
  const hintSummary = summarizeHintChanges(hintChanges);

  el.hidden = false;
  el.replaceChildren();

  const h2 = document.createElement("h2");
  h2.id = "results-heading";
  h2.tabIndex = -1;
  h2.textContent = t("answer_key_label");
  el.appendChild(h2);

  const scoreP = document.createElement("p");
  scoreP.className = "score-display";
  scoreP.textContent = t("practice_score", {
    correct: score.correct,
    total: score.total,
    pct: score.scorePct,
  });
  el.appendChild(scoreP);

  const stats = document.createElement("p");
  stats.textContent = `${t("practice_missed_errors", { n: score.missedErrors })} | ${t("practice_false_alarms", { n: score.falseAlarms })}`;
  el.appendChild(stats);

  const debrief = document.createElement("p");
  debrief.textContent = `${t("practice_debrief")}: ${t(debriefKey)}`;
  el.appendChild(debrief);

  if (score.dangerousMissed.length) {
    const d = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${t("practice_dangerous_missed")}:`;
    d.append(strong, ` ${score.dangerousMissed.map((e) => t(`error_${e}`)).join(", ")}`);
    el.appendChild(d);
  }

  if (hintSummary.total > 0) {
    const h = document.createElement("p");
    h.textContent = t("practice_hint_changes", {
      total: hintSummary.total,
      better: hintSummary.better,
      worse: hintSummary.worse,
    });
    el.appendChild(h);
  }

  const missed = document.createElement("p");
  const missedStrong = document.createElement("strong");
  missedStrong.textContent = `${t("practice_missed_types")}:`;
  missed.append(
    missedStrong,
    ` ${score.missedErrorTypes.length ? score.missedErrorTypes.map((e) => t(`error_${e}`)).join(", ") : t("value_none")}`,
  );
  el.appendChild(missed);

  const resolved = resolveAnswerKeySources(currentSet);
  for (const claim of resolved) {
    const user = userState[claim.id];
    const item = document.createElement("article");
    item.className = "claim-card";
    const result = score.results.find((r) => r.claimId === claim.id);
    const ok = result?.correct;

    const claimP = document.createElement("p");
    const tag = document.createElement("span");
    tag.className = `tag ${ok ? "tag--correct" : "tag--miss"}`;
    tag.textContent = ok ? "✓" : "✗";
    claimP.append(tag, ` ${claim.text}`);
    item.appendChild(claimP);

    for (const [labelKey, value] of [
      ["your_answer_label", user?.verdict ? t(`verdict_${user.verdict}`) : t("value_none")],
      ["answer_key_label", t(`verdict_${claim.answerKey.verdict}`)],
      [
        "error_type_label",
        claim.answerKey.errorType ? t(`error_${claim.answerKey.errorType}`) : t("none_error"),
      ],
      ["feedback_label", feedbackForClaim(claim, user, ok)],
      ["explanation_label", claim.answerKey.explanation],
    ]) {
      const row = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${t(labelKey)}:`;
      row.append(strong, ` ${value}`);
      item.appendChild(row);
    }

    const sourceRow = document.createElement("p");
    const sourceStrong = document.createElement("strong");
    sourceStrong.textContent = `${t("debrief_source_label")}:`;
    sourceRow.append(sourceStrong, ` ${formatSourceLine(claim)}`);
    item.appendChild(sourceRow);

    el.appendChild(item);

    document.querySelectorAll(".sentence").forEach((btn) => {
      if (claim.answerKey.sourceSentences.includes(btn.dataset.sentenceId)) {
        btn.classList.add("is-key");
      }
    });
  }

  announce(t("practice_score", { correct: score.correct, total: score.total, pct: score.scorePct }));
  h2.focus();
}

async function startSet(path) {
  currentSet = await loadSet(path);
  userState = {};
  hintControlGates.clear();
  const results = document.getElementById("results-panel");
  if (results) {
    results.hidden = true;
    results.replaceChildren();
  }
  renderSources();
  renderClaims();
  markDirty();
  const workspace = document.getElementById("practice-workspace");
  if (workspace) workspace.hidden = false;
  const empty = document.getElementById("empty-hint");
  if (empty) empty.hidden = true;
  announce(t("practice_title"));
}

async function main() {
  await initApp({
    onLangChange: async () => {
      const manifest = await loadManifest();
      renderSetPicker(manifest);
      if (currentSet) {
        const entry = manifest.sets.find((s) => s.id === currentSet.id);
        if (entry) await startSet(entry.path);
      }
    },
  });

  const manifest = await loadManifest();
  renderSetPicker(manifest);

  document.getElementById("start-set")?.addEventListener("click", () => {
    const path = document.getElementById("set-select")?.value;
    if (path) startSet(path);
  });

  document.getElementById("check-answers")?.addEventListener("click", () => {
    if (!currentSet) return;
    renderResults();
  });
}

main();
