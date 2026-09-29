#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evalDeterministicForClaim,
  aggregateDeterministicMetrics,
  evidenceInTopK,
  nliAgreesWithKey,
  cosineSimilarity,
} from "../web/js/core/eval-metrics.js";
import { runNliInference, nliTopLabel } from "../web/js/core/nli.js";
import { indexAllDocuments } from "../web/js/core/sentences.js";
import { MODELS } from "../web/js/core/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DATA = join(__dirname, "../web/data");
const OUT_DIR = join(__dirname, "../eval");
const withModel = process.argv.includes("--with-model");

function loadAllSets() {
  const manifest = JSON.parse(readFileSync(join(WEB_DATA, "manifest.json"), "utf8"));
  return manifest.sets.map((entry) => {
    const data = JSON.parse(readFileSync(join(WEB_DATA, entry.path), "utf8"));
    return data;
  });
}

function pct(n, d) {
  if (d === 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

async function runEmbeddingEval(sets) {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = true;
  env.cacheDir = join(__dirname, "../.cache/transformers");

  const embedder = await pipeline("feature-extraction", MODELS.embedding.id, {
    dtype: MODELS.embedding.dtype,
    revision: MODELS.embedding.revision,
  });

  let top2Hit = 0;
  let n = 0;
  const unique = new Set();

  for (const set of sets) {
    const srcLang = set.crossLanguage?.sourceLang ?? set.language;
    const allSentences = indexAllDocuments(set.documents, srcLang);
    for (const claim of set.claims) {
      const key = `${set.id}:${claim.id}`;
      unique.add(key);
      n += 1;
      const claimVec = await embedVector(embedder, `query: ${claim.text}`);
      const ranked = [];
      for (const s of allSentences) {
        const vec = await embedVector(embedder, `passage: ${s.text}`);
        ranked.push({ id: s.id, score: cosineSimilarity(claimVec, vec) });
      }
      ranked.sort((a, b) => b.score - a.score);
      const topIds = ranked.map((r) => r.id);
      if (evidenceInTopK(topIds, claim.answerKey.sourceSentences, 2)) top2Hit += 1;
    }
  }

  return {
    n,
    uniqueClaims: unique.size,
    top2Recall: pct(top2Hit, n),
    top2Hit,
    model: MODELS.embedding.id,
    revision: MODELS.embedding.revision,
  };
}

async function embedVector(pipe, text) {
  const out = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

async function runNliEval(sets) {
  const { AutoTokenizer, AutoModelForSequenceClassification, env } =
    await import("@huggingface/transformers");
  env.allowLocalModels = true;
  env.cacheDir = join(__dirname, "../.cache/transformers");

  const loadOpts = {
    dtype: MODELS.nli.dtype,
    revision: MODELS.nli.revision,
  };
  const tokenizer = await AutoTokenizer.from_pretrained(MODELS.nli.id, loadOpts);
  const model = await AutoModelForSequenceClassification.from_pretrained(
    MODELS.nli.id,
    loadOpts,
  );

  let agree = 0;
  let n = 0;
  const unique = new Set();

  for (const set of sets) {
    const srcLang = set.crossLanguage?.sourceLang ?? set.language;
    const allSentences = indexAllDocuments(set.documents, srcLang);
    for (const claim of set.claims) {
      const refs = claim.answerKey.sourceSentences;
      if (refs.length === 0) continue;
      const key = `${set.id}:${claim.id}`;
      unique.add(key);
      n += 1;
      const evidence = refs
        .map((ref) => allSentences.find((s) => s.id === ref)?.text)
        .filter(Boolean)
        .join(" ");
      if (!evidence) continue;
      const { probabilities: probs } = await runNliInference(
        tokenizer,
        model,
        evidence,
        claim.text,
      );
      const mapped = nliTopLabel(probs);
      if (nliAgreesWithKey(mapped, claim.answerKey.verdict)) agree += 1;
    }
  }

  return {
    n,
    uniqueClaims: unique.size,
    agreementPct: pct(agree, n),
    agree,
    model: MODELS.nli.id,
    revision: MODELS.nli.revision,
  };
}

async function main() {
  const sets = loadAllSets();
  const detResults = [];
  for (const set of sets) {
    for (const claim of set.claims) {
      detResults.push(evalDeterministicForClaim(claim, set));
    }
  }
  const det = aggregateDeterministicMetrics(detResults);

  const byTypeRows = [];
  for (const [type, counts] of Object.entries(det.byErrorType)) {
    const tp = counts.tp ?? 0;
    const fn = counts.fn ?? 0;
    byTypeRows.push({
      errorType: type,
      n: tp + fn,
      recallPct: pct(tp, tp + fn),
      tp,
      fn,
    });
  }

  const report = {
    generatedAt: new Date().toISOString().slice(0, 10),
    mode: withModel ? "with-model" : "pattern-only",
    practiceSets: sets.length,
    claims: {
      n: det.n,
      uniqueClaims: det.uniqueClaims,
    },
    deterministic: {
      n: det.n,
      uniqueClaims: det.uniqueClaims,
      precisionPct: pct(det.tp, det.tp + det.fp),
      recallPct: pct(det.tp, det.tp + det.fn),
      tp: det.tp,
      fp: det.fp,
      fn: det.fn,
      byErrorType: byTypeRows,
    },
    embedding: null,
    nli: null,
  };

  if (withModel) {
    console.log("Loading embedding model…");
    report.embedding = await runEmbeddingEval(sets);
    console.log("Loading NLI model…");
    report.nli = await runNliEval(sets);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, withModel ? "results-with-model.json" : "results.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  const md = [
    "# Source Check Lab evaluation",
    "",
    `Date: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Practice sets: ${report.practiceSets}`,
    `Claims evaluated (n): ${report.claims.n} (unique: ${report.claims.uniqueClaims})`,
    "",
    "## Deterministic hints",
    "",
    "| Metric | Value | n |",
    "|--------|-------|---|",
    `| Precision | ${report.deterministic.precisionPct ?? "n/a"}% | ${report.deterministic.tp + report.deterministic.fp} |`,
    `| Recall | ${report.deterministic.recallPct ?? "n/a"}% | ${report.deterministic.tp + report.deterministic.fn} |`,
    "",
    "### Recall by error type",
    "",
    "| Error type | Recall % | tp | fn | n |",
    "|------------|----------|----|----|---|",
    ...byTypeRows.map(
      (r) => `| ${r.errorType} | ${r.recallPct ?? "n/a"}% | ${r.tp} | ${r.fn} | ${r.n} |`,
    ),
    "",
  ];

  if (report.embedding) {
    md.push(
      "## Evidence finder (embedding)",
      "",
      `Model: ${report.embedding.model} @ ${report.embedding.revision}`,
      `Top-2 deciding sentence recall: ${report.embedding.top2Recall}% (${report.embedding.top2Hit}/${report.embedding.n}, unique ${report.embedding.uniqueClaims})`,
      "",
    );
  }

  if (report.nli) {
    md.push(
      "## NLI deeper check",
      "",
      `Model: ${report.nli.model} @ ${report.nli.revision}`,
      `Agreement with answer key verdict: ${report.nli.agreementPct}% (${report.nli.agree}/${report.nli.n}, unique ${report.nli.uniqueClaims})`,
      "",
    );
  }

  writeFileSync(join(OUT_DIR, "results.md"), md.join("\n"));
  const outFile = withModel ? "results-with-model.json" : "results.json";
  console.log(`Wrote ${join(OUT_DIR, outFile)}`);
  console.log(md.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
