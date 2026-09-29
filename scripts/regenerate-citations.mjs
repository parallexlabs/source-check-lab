#!/usr/bin/env node
/**
 * Regenerates sourceSentences from the rule-based splitter and evidence fields.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { indexAllDocuments } from "../web/js/core/sentences.js";
import { textContainsEvidence } from "../web/js/core/numeric.js";
import {
  validateAllCitations,
  formatCitationReview,
} from "../web/js/core/citation-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DATA = join(__dirname, "../web/data");

/** @type {Record<string, Record<string, { refs: string[], evidence?: string }>>} */
const CITATION_MAP = {
  "en-01-needs-assessment": {
    c1: { refs: ["rna:s1"], evidence: "31%" },
    c2: { refs: ["rna:s0"], evidence: "412" },
    c4: { refs: ["rna:s2"], evidence: "does not estimate" },
    c5: { refs: ["rna:s1"], evidence: "31%" },
    c6: { refs: ["rna:s0", "rna:s3"], evidence: "may need repair" },
    c8: { refs: ["rna:s1", "rna:s2"], evidence: "dry season" },
  },
  "en-02-donor-report": {
    c1: { refs: ["annex:s0"], evidence: "1,240" },
    c2: { refs: ["annex:s1"], evidence: "Cooperative" },
    c3: { refs: ["annex:s2"], evidence: "No cash" },
    c4: { refs: ["annex:s3"], evidence: "registered households" },
    c5: { refs: ["annex:s0"], evidence: "January" },
    c6: { refs: ["annex:s0"], evidence: "Halcyon" },
    c7: { refs: ["annex:s0"], evidence: "Q1" },
    c8: { refs: ["annex:s2"], evidence: "No cash" },
  },
  "en-03-sitrep": {
    c1: { refs: ["sitrep:s0", "assess:s0"], evidence: "displaced" },
    c2: { refs: ["sitrep:s0"], evidence: "22 September" },
    c3: { refs: ["wash:s0"], evidence: "12,000" },
    c4: { refs: ["wash:s1"], evidence: "8,500" },
    c5: { refs: ["sitrep:s2"], evidence: "may reopen" },
    c6: { refs: ["sitrep:s3"], evidence: "no confirmed cases" },
    c7: { refs: ["sitrep:s1"], evidence: "2,100" },
    c8: { refs: ["wash:s2"], evidence: "high" },
    c9: { refs: [], evidence: "under control" },
  },
  "en-04-distribution": {
    c1: { refs: ["distlog:s1"], evidence: "820" },
    c2: { refs: ["distlog:s1"], evidence: "household" },
    c3: { refs: ["distlog:s2"], evidence: "per month" },
    c4: { refs: ["distlog:s0", "distlog:s3"], evidence: "850" },
    c5: { refs: ["distlog:s3"], evidence: "30 cards" },
    c6: { refs: ["distlog:s1"], evidence: "Greybrook" },
    c7: { refs: ["distlog:s2"], evidence: "25 kg" },
  },
  "en-05-health-protection": {
    c1: { refs: ["health:s0"], evidence: "45" },
    c2: { refs: ["health:s1"], evidence: "One referral" },
    c3: { refs: ["meeting:s0"], evidence: "three days" },
    c4: { refs: ["meeting:s0"], evidence: "three days" },
    c5: { refs: ["health:s2"], evidence: "Stock-out" },
    c6: { refs: ["meeting:s1"], evidence: "Ashford" },
    c8: { refs: ["health:s2"], evidence: "14 June" },
  },
  "en-06-evacuation": {
    c1: { refs: ["ops:s1"], evidence: "612" },
    c2: { refs: ["ops:s0"], evidence: "14:00" },
    c3: { refs: ["ops:s0"], evidence: "Northhaven" },
    c4: { refs: ["ops:s2"], evidence: "800" },
    c5: { refs: ["ops:s3"], evidence: "pending verification" },
    c6: { refs: ["ops:s1"], evidence: "6 buses" },
    c7: { refs: ["ops:s3"], evidence: "English and French" },
  },
  "fr-01-evaluation-besoins": {
    c1: { refs: ["era:s1"], evidence: "31" },
    c2: { refs: ["era:s0"], evidence: "412" },
    c4: { refs: ["era:s2"], evidence: "n'estime pas" },
    c5: { refs: ["era:s1"], evidence: "31" },
    c6: { refs: ["era:s0", "era:s3"], evidence: "pourraient" },
    c8: { refs: ["era:s1", "era:s2"], evidence: "saison sèche" },
  },
  "fr-02-rapport-bailleur": {
    c1: { refs: ["annexe:s0"], evidence: "1 240" },
    c2: { refs: ["annexe:s1"], evidence: "Meridia" },
    c3: { refs: ["annexe:s2"], evidence: "Aucun transfert" },
    c4: { refs: ["annexe:s3"], evidence: "ménages enregistrés" },
    c5: { refs: ["annexe:s0"], evidence: "janvier" },
    c6: { refs: ["annexe:s0"], evidence: "Halcyon" },
    c7: { refs: ["annexe:s0"], evidence: "T1" },
    c8: { refs: ["annexe:s2"], evidence: "transfert" },
  },
  "fr-03-sitrep": {
    c1: { refs: ["sitrep:s0", "eval:s0"], evidence: "déplacées" },
    c2: { refs: ["sitrep:s0"], evidence: "22 septembre" },
    c3: { refs: ["wash:s0"], evidence: "12 000" },
    c4: { refs: ["wash:s1"], evidence: "8 500" },
    c5: { refs: ["sitrep:s2"], evidence: "pourrait rouvrir" },
    c6: { refs: ["sitrep:s3"], evidence: "aucun cas confirmé" },
    c7: { refs: ["sitrep:s1"], evidence: "2 100" },
    c8: { refs: ["wash:s2"], evidence: "élevés" },
    c9: { refs: [], evidence: "sous contrôle" },
  },
  "fr-04-distribution": {
    c1: { refs: ["registre:s1"], evidence: "820" },
    c2: { refs: ["registre:s1"], evidence: "ménage" },
    c3: { refs: ["registre:s2"], evidence: "par mois" },
    c4: { refs: ["registre:s0", "registre:s3"], evidence: "850" },
    c5: { refs: ["registre:s3"], evidence: "30 cartes" },
    c6: { refs: ["registre:s1"], evidence: "Greybrook" },
    c7: { refs: ["registre:s2"], evidence: "25 kg" },
  },
  "fr-05-sante-protection": {
    c1: { refs: ["sante:s0"], evidence: "45" },
    c2: { refs: ["sante:s1"], evidence: "Une orientation" },
    c3: { refs: ["reunion:s0"], evidence: "trois jours" },
    c4: { refs: ["reunion:s0"], evidence: "trois jours" },
    c5: { refs: ["sante:s2"], evidence: "Rupture" },
    c6: { refs: ["reunion:s1"], evidence: "Ashford" },
    c8: { refs: ["sante:s2"], evidence: "14 juin" },
  },
  "fr-06-evacuation": {
    c1: { refs: ["ops:s1"], evidence: "612" },
    c2: { refs: ["ops:s0"], evidence: "14 h" },
    c3: { refs: ["ops:s0"], evidence: "Northhaven" },
    c4: { refs: ["ops:s2"], evidence: "800" },
    c5: { refs: ["ops:s3"], evidence: "en attente" },
    c6: { refs: ["ops:s1"], evidence: "6 bus" },
    c7: { refs: ["ops:s3"], evidence: "anglais et en français" },
  },
  "en-07-cross-fr": {
    c1: { refs: ["note:s0"], evidence: "186" },
    c2: { refs: ["note:s1"], evidence: "cinq ans" },
    c3: { refs: ["note:s2"], evidence: "limités" },
    c4: { refs: ["note:s2"], evidence: "15 août" },
    c5: { refs: ["note:s0"], evidence: "186" },
    c7: { refs: ["note:s0"], evidence: "district" },
    c8: { refs: ["note:s0"], evidence: "3 août" },
  },
  "fr-07-cross-en": {
    c1: { refs: ["log:s0"], evidence: "420" },
    c2: { refs: ["log:s1"], evidence: "415" },
    c3: { refs: ["log:s1"], evidence: "5 kits" },
    c4: { refs: ["log:s2"], evidence: "18 kg" },
    c5: { refs: ["log:s3"], evidence: "Brookvale Relief" },
    c6: { refs: ["log:s0"], evidence: "420" },
    c7: { refs: ["log:s3"], evidence: "Brookvale Relief" },
  },
};

function loadAllSets() {
  const manifest = JSON.parse(readFileSync(join(WEB_DATA, "manifest.json"), "utf8"));
  return manifest.sets.map((entry) => ({
    entry,
    data: JSON.parse(readFileSync(join(WEB_DATA, entry.path), "utf8")),
  }));
}

const sets = loadAllSets();

for (const { data: set } of sets) {
  const map = CITATION_MAP[set.id];
  const docLang = set.crossLanguage?.sourceLang ?? set.language;
  const allSentences = indexAllDocuments(set.documents, docLang);

  for (const claim of set.claims) {
    const fix = map?.[claim.id];
    if (fix) {
      claim.answerKey.sourceSentences = fix.refs;
      if (fix.evidence) claim.answerKey.evidence = fix.evidence;
    } else if (claim.answerKey.verdict === "not_in_source") {
      claim.answerKey.sourceSentences = [];
    }

    const evidence = claim.answerKey.evidence;
    if (evidence && claim.answerKey.sourceSentences.length > 0) {
      for (const ref of claim.answerKey.sourceSentences) {
        const sentence = allSentences.find((s) => s.id === ref);
        if (!sentence || !textContainsEvidence(sentence.text, evidence)) {
          console.warn(
            `${set.id} ${claim.id}: evidence "${evidence}" missing in ${ref}`,
          );
        }
      }
    }
  }
}

for (const { entry, data } of sets) {
  writeFileSync(
    join(WEB_DATA, entry.path),
    JSON.stringify(data, null, 2) + "\n",
  );
}

const fixedSets = sets.map((s) => s.data);
const { rows, errors } = validateAllCitations(fixedSets);
console.log(formatCitationReview(rows));

if (errors.length) {
  console.error("\nValidation failed:");
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}

console.log("\nRegenerated citations for", fixedSets.length, "sets.");
