import { initApp } from "./app.js";
import { getLang } from "./i18n.js";
import { renderAnswerKeyHtml, renderDebriefSheetHtml } from "../core/facilitator.js";

const CONTENT = {
  en: `
<p class="notice"><strong>Practice lab only:</strong> This is a human-review training environment. It is not a privacy protection tool, an AI fact checker or a safe translator. The software never shows a green "safe", "verified" or "approved" badge.</p>

<h2>Activity: Source Check Lab (25 minutes)</h2>
<p><strong>Learning objective:</strong> Participants practise verifying an AI-written summary against synthetic humanitarian sources, claim by claim. They commit a verdict and mark evidence before optional hints appear.</p>
<p><strong>Maps to kit session:</strong> Session 2, Verified work by role (<a href="https://parallexlabs.github.io/humanitarian-ai-training-kit/">Humanitarian AI Training Kit</a>).</p>

<h3>Timing</h3>
<ol>
  <li><strong>2 min</strong>: Open <a href="practice.html">Practice</a>. Remind: all documents are fictional training data.</li>
  <li><strong>3 min</strong>: Tour: verdict first, mark evidence sentences, then hints. Discuss false alarms and disagreeing sources.</li>
  <li><strong>15 min</strong>: Pairs or solo: one practice set. Try a clean set and one with source disagreement if time allows.</li>
  <li><strong>3 min</strong>: Check answers. Discuss missed errors, false alarms and hint changes.</li>
  <li><strong>2 min</strong>: Debrief (see questions below).</li>
</ol>

<h3>Low bandwidth / no AI account</h3>
<ul>
  <li>Pattern-only hints work offline after the page loads. No login required.</li>
  <li>Embedding and NLI models are optional large downloads; skip them if bandwidth is limited.</li>
  <li>Facilitator can screen-share one set while participants follow on phones.</li>
</ul>

<h3>With models (optional)</h3>
<ul>
  <li>Demonstrate one claim with the evidence finder. Stress: similarity is not truth.</li>
  <li>Show NLI probabilities (entailment / neutral / contradiction), not a verdict label. Compare with human judgment.</li>
</ul>

<h3>Debrief questions</h3>
<ul>
  <li>Which error type was easiest to miss? Why?</li>
  <li>Did anyone raise a false alarm on a correct claim?</li>
  <li>When sources disagreed, did you record the disagreement?</li>
  <li>When did hints help? When did they change your verdict for the worse?</li>
</ul>

<h3>Accessibility notes</h3>
<ul>
  <li>Full keyboard navigation: Tab through verdicts; Enter/Space on source sentences.</li>
  <li>Results announced via aria-live region after checking answers.</li>
  <li>Fictional watermark announced to screen readers on every practice source.</li>
</ul>
`,
  fr: `
<p class="notice"><strong>Exercice seulement :</strong> Ceci est un environnement de formation à la relecture humaine. Ce n'est pas un outil de confidentialité, un vérificateur de faits IA ni un traducteur sécurisé. Le logiciel n'affiche jamais un badge vert « sûr », « vérifié » ou « approuvé ».</p>

<h2>Activité : Laboratoire de vérification des sources (25 minutes)</h2>
<p><strong>Objectif :</strong> Pratiquer la vérification d'un résumé produit par un outil d'IA face à des sources synthétiques. Verdict et preuves d'abord, indices ensuite.</p>
<p><strong>Lien avec la trousse :</strong> Séance 2, Travail vérifié par rôle (<a href="https://parallexlabs.github.io/humanitarian-ai-training-kit/">Trousse de formation IA humanitaire</a>).</p>

<h3>Déroulement</h3>
<ol>
  <li><strong>2 min</strong>: Ouvrir <a href="practice.html">Exercice</a>. Rappel : données fictives de formation.</li>
  <li><strong>3 min</strong>: Visite : verdict d'abord, marquer les phrases, puis indices. Fausses alertes et sources divergentes.</li>
  <li><strong>15 min</strong>: Un jeu en binôme ou solo. Essayer une série sans erreur et un avec divergence si le temps le permet.</li>
  <li><strong>3 min</strong>: Vérifier les réponses. Discuter erreurs manquées, fausses alertes et changements dus aux indices.</li>
  <li><strong>2 min</strong>: Débriefing.</li>
</ol>

<h3>Faible bande passante / sans compte IA</h3>
<ul>
  <li>Indices par motif hors ligne après chargement. Aucune connexion requise.</li>
  <li>Modèles facultatifs, téléchargements volumineux.</li>
</ul>

<h3>Avec modèles (facultatif)</h3>
<ul>
  <li>Montrer les probabilités NLI (implication / neutre / contradiction), pas un verdict automatique.</li>
</ul>

<h3>Questions de débriefing</h3>
<ul>
  <li>Quel type d'erreur a été le plus facile à manquer ?</li>
  <li>Quelqu'un a-t-il signalé une fausse alerte sur une affirmation correcte ?</li>
  <li>Quand les sources divergeaient, avez-vous noté le désaccord ?</li>
  <li>Les indices ont-ils changé votre verdict en pire ?</li>
</ul>
`,
};

/** @type {object[]} */
let allSets = [];

async function loadSets() {
  const res = await fetch(new URL("../../data/manifest.json", import.meta.url));
  const manifest = await res.json();
  allSets = [];
  for (const entry of manifest.sets) {
    const setRes = await fetch(new URL(`../../data/${entry.path}`, import.meta.url));
    allSets.push(await setRes.json());
  }
}

function renderPrintLinks() {
  const keysEl = document.getElementById("facilitator-keys");
  const debriefEl = document.getElementById("facilitator-debrief");
  if (!keysEl || !debriefEl) return;
  const lang = getLang();
  keysEl.innerHTML = "";
  debriefEl.innerHTML = "";

  for (const set of allSets) {
    if (set.language !== lang && !set.crossLanguage) continue;

    const keyLi = document.createElement("li");
    const keyBtn = document.createElement("button");
    keyBtn.type = "button";
    keyBtn.className = "btn btn--ghost";
    keyBtn.textContent = set.title;
    keyBtn.addEventListener("click", () => openPrintWindow(renderAnswerKeyHtml(set, lang)));
    keyLi.appendChild(keyBtn);
    keysEl.appendChild(keyLi);

    const debLi = document.createElement("li");
    const debBtn = document.createElement("button");
    debBtn.type = "button";
    debBtn.className = "btn btn--ghost";
    debBtn.textContent = set.title;
    debBtn.addEventListener("click", () => openPrintWindow(renderDebriefSheetHtml(set, lang)));
    debLi.appendChild(debBtn);
    debriefEl.appendChild(debLi);
  }
}

/**
 * @param {string} html
 */
function openPrintWindow(html) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function render() {
  const el = document.getElementById("facilitator-content");
  if (!el) return;
  const lang = getLang();
  el.innerHTML = CONTENT[lang] ?? CONTENT.en;
  renderPrintLinks();
}

initApp({ onLangChange: render }).then(async () => {
  await loadSets();
  render();
});
