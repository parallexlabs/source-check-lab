#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAllCitations,
  formatCitationReview,
} from "../web/js/core/citation-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DATA = join(__dirname, "../web/data");

function loadAllSets() {
  const manifest = JSON.parse(readFileSync(join(WEB_DATA, "manifest.json"), "utf8"));
  return manifest.sets.map((entry) =>
    JSON.parse(readFileSync(join(WEB_DATA, entry.path), "utf8")),
  );
}

const sets = loadAllSets();
const { rows, errors } = validateAllCitations(sets);

console.log(formatCitationReview(rows));

if (errors.length > 0) {
  console.error("\nValidation failed with", errors.length, "error(s):");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log("\nAll claim citations validated.");
