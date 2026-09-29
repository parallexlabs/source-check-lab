import { VERDICT_LABELS } from "./constants.js";
import { errorTypeCountsForSet } from "./scoring.js";
import { resolveAnswerKeySources } from "./practice.js";

/**
 * HTML answer key for one practice set (print view).
 * @param {object} set
 * @param {'en'|'fr'} lang
 */
export function renderAnswerKeyHtml(set, lang) {
  const labels = VERDICT_LABELS[lang] ?? VERDICT_LABELS.en;
  const resolved = resolveAnswerKeySources(set);
  const rows = resolved
    .map((claim, i) => {
      const et = claim.answerKey.errorType
        ? claim.answerKey.errorType
        : "none";
      const sources = claim.resolvedSources.map((s) => s.text).join(" ");
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(claim.text)}</td>
        <td>${escapeHtml(labels[claim.answerKey.verdict] ?? claim.answerKey.verdict)}</td>
        <td>${escapeHtml(et)}</td>
        <td>${escapeHtml(claim.answerKey.explanation)}</td>
        <td>${escapeHtml(sources)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>Answer key: ${escapeHtml(set.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; font-size: 11pt; }
    h1 { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #ccc; padding: 0.35rem 0.5rem; vertical-align: top; text-align: left; }
    th { background: #f4f4f4; }
    .banner { font-weight: bold; margin-bottom: 1rem; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="banner">FICTIONAL TRAINING DATA / DONNÉES FICTIVES DE FORMATION</p>
  <h1>Answer key: ${escapeHtml(set.title)}</h1>
  <p>Practice lab only</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Claim</th><th>Verdict</th><th>Error type</th><th>Explanation</th><th>Source sentence(s)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="no-print"><button onclick="window.print()">Print</button></p>
</body>
</html>`;
}

/**
 * Group debrief sheet with error-type counts for one set.
 * @param {object} set
 * @param {'en'|'fr'} lang
 */
export function renderDebriefSheetHtml(set, lang) {
  const { counts, cleanClaims, total } = errorTypeCountsForSet(set);
  const errorRows = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([et, n]) => `<tr><td>${escapeHtml(et)}</td><td>${n}</td></tr>`)
    .join("");

  const title =
    lang === "fr" ? "Fiche de débriefing de groupe" : "Group debrief sheet";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <title>${title}: ${escapeHtml(set.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1.5rem; font-size: 12pt; }
    table { border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.75rem; }
    th { background: #f4f4f4; }
    .banner { font-weight: bold; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <p class="banner">FICTIONAL TRAINING DATA / DONNÉES FICTIVES DE FORMATION</p>
  <h1>${title}</h1>
  <p><strong>${escapeHtml(set.title)}</strong></p>
  <p>Claims: ${total} | Clean (no seeded error): ${cleanClaims}</p>
  <h2>${lang === "fr" ? "Types d'erreurs dans ce jeu" : "Error types in this set"}</h2>
  <table>
    <thead><tr><th>${lang === "fr" ? "Type" : "Error type"}</th><th>${lang === "fr" ? "Nombre" : "Count"}</th></tr></thead>
    <tbody>${errorRows || `<tr><td colspan="2">${lang === "fr" ? "Aucune erreur semée" : "No seeded errors"}</td></tr>`}</tbody>
  </table>
  <h2>${lang === "fr" ? "Questions de débriefing" : "Debrief questions"}</h2>
  <ul>
    <li>${lang === "fr" ? "Quel type d'erreur a été le plus facile à manquer?" : "Which error type was easiest to miss?"}</li>
    <li>${lang === "fr" ? "Avez-vous eu des fausses alertes (affirmation correcte marquée comme fausse)?" : "Did anyone raise false alarms (marking a correct claim as wrong)?"}</li>
    <li>${lang === "fr" ? "Quand les sources divergent, avez-vous noté le désaccord plutôt que choisir une source?" : "When sources disagreed, did you record the disagreement instead of picking one source?"}</li>
    <li>${lang === "fr" ? "Les indices ont-ils changé votre verdict? Pour le mieux ou pour le pire?" : "Did hints change your verdict? For better or worse?"}</li>
  </ul>
  <p class="no-print"><button onclick="window.print()">Print</button></p>
</body>
</html>`;
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
