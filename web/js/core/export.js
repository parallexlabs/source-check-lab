import { VERDICT_LABELS } from "./constants.js";

/**
 * Neutralize spreadsheet formula injection in CSV cells.
 * @param {string} value
 */
export function neutralizeCsvCell(value) {
  const v = String(value ?? "");
  let i = 0;
  while (i < v.length) {
    const code = v.charCodeAt(i);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      i += 1;
      continue;
    }
    break;
  }
  const lead = v[i];
  if (lead === "=" || lead === "+" || lead === "-" || lead === "@") {
    return `\t${v}`;
  }
  return v;
}

/**
 * Escape Markdown table cell content.
 * @param {string} s
 */
function escMdCell(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Pick a fenced code block delimiter that does not appear in text.
 * @param {string} text
 */
function fenceFor(text) {
  let tick = "```";
  while (text.includes(tick)) tick += "`";
  return tick;
}

/**
 * @param {object} params
 * @param {string} params.title
 * @param {'en'|'fr'} params.lang
 * @param {string} params.sourceText
 * @param {string} params.summaryText
 * @param {Array<{ text: string, verdict: string|null, correction: string, hintsSummary: string }>} params.rows
 * @param {string} params.generatedAt ISO date
 * @param {'practice'|'own'} [params.mode]
 */
export function exportVerificationMarkdown(params) {
  const { title, lang, sourceText, summaryText, rows, generatedAt, mode = "own" } = params;
  const disclaimer =
    mode === "practice"
      ? "PRACTICE ONLY: This export is from practice mode with fictional training data."
      : "HUMAN REVIEW RECORD; NOT A CERTIFICATION. This log records a human review session only.";

  const sourceFence = fenceFor(sourceText);
  const summaryFence = fenceFor(summaryText);

  const lines = [
    `# ${title}`,
    "",
    `**Generated:** ${generatedAt}`,
    "",
    `> ${disclaimer}`,
    "",
    "## Source text",
    "",
    sourceFence,
    sourceText,
    sourceFence,
    "",
    "## Summary checked",
    "",
    summaryFence,
    summaryText,
    summaryFence,
    "",
    "## Claim verification log",
    "",
    "| # | Claim | Verdict | Correction | Hints noted |",
    "|---|-------|---------|------------|-------------|",
  ];

  rows.forEach((row, i) => {
    const verdictLabel =
      row.verdict
        ? (VERDICT_LABELS[lang]?.[row.verdict] ?? row.verdict)
        : "";
    lines.push(
      `| ${i + 1} | ${escMdCell(row.text)} | ${escMdCell(verdictLabel)} | ${escMdCell(row.correction)} | ${escMdCell(row.hintsSummary)} |`,
    );
  });

  lines.push("", "---", "", "*Created with Source Check Lab (ParalleX Labs Inc.). Nothing in this file was sent to a server.*");
  return lines.join("\n");
}

/**
 * @param {object} params
 */
export function exportVerificationCsv(params) {
  const { rows, lang, generatedAt, mode = "own" } = params;
  const disclaimer =
    mode === "practice"
      ? "practice only"
      : "human review record; not a certification";
  const header = ["index", "claim", "verdict", "correction", "hints", "generated_at", "export_mode"];
  const esc = (s) => {
    const v = neutralizeCsvCell(String(s ?? ""));
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [header.join(",")];
  rows.forEach((row, i) => {
    const verdictLabel =
      row.verdict
        ? (VERDICT_LABELS[lang]?.[row.verdict] ?? row.verdict)
        : "";
    lines.push(
      [
        i + 1,
        esc(row.text),
        esc(verdictLabel),
        esc(row.correction),
        esc(row.hintsSummary),
        esc(generatedAt),
        esc(disclaimer),
      ].join(","),
    );
  });
  return lines.join("\n");
}
