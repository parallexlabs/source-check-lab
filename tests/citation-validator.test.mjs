import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAllCitations,
  contentWords,
} from "../web/js/core/citation-validator.js";
import { indexAllDocuments } from "../web/js/core/sentences.js";
import {
  textContainsEvidence,
  textContainsPhraseTokens,
} from "../web/js/core/numeric.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DATA = join(__dirname, "../web/data");

function loadAllSets() {
  const manifest = JSON.parse(readFileSync(join(WEB_DATA, "manifest.json"), "utf8"));
  return manifest.sets.map((entry) =>
    JSON.parse(readFileSync(join(WEB_DATA, entry.path), "utf8")),
  );
}

test("all practice set citations validate", () => {
  const sets = loadAllSets();
  const { errors } = validateAllCitations(sets);
  assert.equal(errors.length, 0, errors.join("\n"));
});

test("en-01 c1 cites the 31% sentence with matching evidence text", () => {
  const set = JSON.parse(
    readFileSync(join(WEB_DATA, "practice/en/en-01-needs-assessment.json"), "utf8"),
  );
  const c1 = set.claims.find((c) => c.id === "c1");
  const allSentences = indexAllDocuments(set.documents, set.language);
  const cited = allSentences.find((s) => s.id === c1.answerKey.sourceSentences[0]);
  assert.ok(cited, "cited sentence exists");
  assert.match(cited.text, /31%/);
  assert.equal(c1.answerKey.evidence, "31%");
  assert.equal(textContainsEvidence(cited.text, c1.answerKey.evidence), true);
  assert.notEqual(c1.answerKey.sourceSentences[0], "rna:s0");
});

test("en-02 claims cite annex sentences with evidence in resolved text", () => {
  const set = JSON.parse(
    readFileSync(join(WEB_DATA, "practice/en/en-02-donor-report.json"), "utf8"),
  );
  const c2 = set.claims.find((c) => c.id === "c2");
  const allSentences = indexAllDocuments(set.documents, set.language);
  const cited = allSentences.find((s) => s.id === c2.answerKey.sourceSentences[0]);
  assert.ok(cited);
  assert.equal(textContainsEvidence(cited.text, c2.answerKey.evidence), true);
});

test("not_in_source claims cite no sentence", () => {
  const sets = loadAllSets();
  for (const set of sets) {
    for (const claim of set.claims) {
      if (claim.answerKey.verdict === "not_in_source") {
        assert.equal(
          claim.answerKey.sourceSentences.length,
          0,
          `${set.id} ${claim.id} should cite no sentence`,
        );
      }
    }
  }
});

test("not_in_source claims must not use evidence field", () => {
  const sets = loadAllSets();
  for (const set of sets) {
    for (const claim of set.claims) {
      if (claim.answerKey.verdict === "not_in_source") {
        assert.equal(
          claim.answerKey.evidence,
          undefined,
          `${set.id} ${claim.id} should use absentEvidence, not evidence`,
        );
      }
    }
  }
});

test("every cited claim with evidence resolves in sentence text", () => {
  const sets = loadAllSets();
  for (const set of sets) {
    const docLang = set.crossLanguage?.sourceLang ?? set.language;
    const allSentences = indexAllDocuments(set.documents, docLang);
    for (const claim of set.claims) {
      const evidence = claim.answerKey.evidence;
      if (!evidence || claim.answerKey.sourceSentences.length === 0) continue;
      const cited = claim.answerKey.sourceSentences
        .map((ref) => allSentences.find((s) => s.id === ref))
        .filter(Boolean);
      const ok = cited.some((s) => textContainsEvidence(s.text, evidence));
      assert.ok(ok, `${set.id} ${claim.id} evidence "${evidence}" not in cited text`);
    }
  }
});

test("phrase evidence rejects substring-only matches", () => {
  assert.equal(textContainsPhraseTokens("displaced population", "place"), false);
  assert.equal(textContainsPhraseTokens("12,000 people displaced", "12,000"), true);
});

test("contentWords finds overlap", () => {
  const a = contentWords("412 households in six villages");
  const b = contentWords("412 households were surveyed across 6 villages");
  assert.ok(a.some((w) => b.includes(w)));
});
