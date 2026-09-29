import { test } from "node:test";
import assert from "node:assert/strict";
import { exportVerificationMarkdown, exportVerificationCsv } from "../web/js/core/export.js";

test("export markdown contains claim", () => {
  const md = exportVerificationMarkdown({
    title: "Test",
    lang: "en",
    sourceText: "Source",
    summaryText: "Summary",
    rows: [{ text: "Claim one", verdict: "supported", correction: "", hintsSummary: "" }],
    generatedAt: "2026-09-29",
  });
  assert.match(md, /Claim one/);
});

test("export csv header", () => {
  const csv = exportVerificationCsv({
    lang: "en",
    rows: [],
    generatedAt: "2026-09-29",
  });
  assert.match(csv, /^index,claim,verdict/);
});

test("export modes differ", () => {
  const own = exportVerificationMarkdown({
    title: "T",
    lang: "en",
    sourceText: "S",
    summaryText: "M",
    rows: [],
    generatedAt: "2026-09-29",
    mode: "own",
  });
  const practice = exportVerificationMarkdown({
    title: "T",
    lang: "en",
    sourceText: "S",
    summaryText: "M",
    rows: [],
    generatedAt: "2026-09-29",
    mode: "practice",
  });
  assert.match(own, /NOT A CERTIFICATION/i);
  assert.match(practice, /PRACTICE ONLY/i);
});

test("export csv escapes commas and quotes", () => {
  const csv = exportVerificationCsv({
    lang: "en",
    rows: [
      {
        text: 'Claim, with "quotes"',
        verdict: "supported",
        correction: "line\ntwo",
        hintsSummary: "hint",
      },
    ],
    generatedAt: "2026-09-29",
    mode: "practice",
  });
  assert.match(csv, /"Claim, with ""quotes"""/);
  assert.match(csv, /practice only/);
});

test("export csv neutralizes formula prefixes", () => {
  for (const prefix of ["=", "+", "-", "@"]) {
    const csv = exportVerificationCsv({
      lang: "en",
      rows: [{ text: `${prefix}SUM(A1)`, verdict: "supported", correction: prefix, hintsSummary: "" }],
      generatedAt: "2026-09-29",
    });
    const line = csv.split("\n")[1];
    assert.match(line, /\t/);
    assert.doesNotMatch(line, /^1,=/);
  }
});

test("export markdown uses collision-safe fences", () => {
  const md = exportVerificationMarkdown({
    title: "Test",
    lang: "en",
    sourceText: "Line with ``` fence",
    summaryText: "Summary ``` break",
    rows: [{ text: "ok", verdict: "supported", correction: "", hintsSummary: "" }],
    generatedAt: "2026-09-29",
  });
  assert.match(md, /````\nLine with ``` fence\n````/);
});
