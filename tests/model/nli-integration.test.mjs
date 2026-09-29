import { test } from "node:test";
import assert from "node:assert/strict";
import { AutoTokenizer, AutoModelForSequenceClassification, env } from "@huggingface/transformers";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runNliInference } from "../../web/js/core/nli.js";
import { MODELS } from "../../web/js/core/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const EVIDENCE = "31% reported inadequate water access during the dry season.";
const PARAPHRASE = "31% reported inadequate water access in the dry season.";
const DIFFERENT = "Approximately 78% of households lack reliable clean water.";

test("pinned NLI model scores premise-hypothesis pairs correctly", async () => {
  env.allowLocalModels = true;
  env.cacheDir = join(__dirname, "../../.cache/transformers");
  const loadOpts = {
    dtype: MODELS.nli.dtype,
    revision: MODELS.nli.revision,
  };
  const tokenizer = await AutoTokenizer.from_pretrained(MODELS.nli.id, loadOpts);
  const model = await AutoModelForSequenceClassification.from_pretrained(
    MODELS.nli.id,
    loadOpts,
  );

  const paraphrase = await runNliInference(tokenizer, model, EVIDENCE, PARAPHRASE);
  const different = await runNliInference(tokenizer, model, EVIDENCE, DIFFERENT);

  assert.ok(
    paraphrase.probabilities.entailment > 0.5,
    `expected entailment > 0.5, got ${paraphrase.probabilities.entailment}`,
  );
  assert.notDeepEqual(
    paraphrase.probabilities,
    different.probabilities,
    "probabilities should change when only the hypothesis changes",
  );
});
