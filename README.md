# Source Check Lab

Source Check Lab is a bilingual (English and French) practice lab for Session 2 (verified work by role) of the [Humanitarian AI Training Kit](https://parallexlabs.github.io/humanitarian-ai-training-kit/). Humanitarian staff practise checking an AI-written summary against its sources, claim by claim: they commit a verdict and mark the evidence first, and only then can they see optional hints that run on their own device.

It is a practice lab and a human-review training environment, not a fact checker: the software never shows a "verified" or "approved" badge, and the person always decides.

**Try it:** https://parallexlabs.github.io/source-check-lab/

## How it works

```
Sources (left)          Claims (right)
─────────────────       ─────────────────
SitRep, RNA, logs  →    Commit verdict per claim
Click sentences    →    Mark evidence sentences
Then hints         →    Pattern / embedding / NLI probabilities
Check answers      →    Score, missed errors, false alarms, debrief
```

1. **Practice mode:** fourteen synthetic sets (seven English, seven French) including clean summaries, disagreeing sources and cross-language pairs.
2. **Check my own:** paste sources and a summary, split claims, run the same workflow, export a human review record (Markdown, CSV, print).
3. **Hints:** deterministic pattern checks (instant), optional embedding evidence finder, optional NLI probabilities (entailment / neutral / contradiction, not a verdict label).

## Privacy

**Leaves the browser:** requests to pinned paths on `cdn.jsdelivr.net` only: `@huggingface/transformers@4.3.0/` (library loaded via dynamic `import()` without an integrity hash because the module URL is versioned at runtime) and `onnxruntime-web@1.31.0-dev.20260914-8d85527a0/` (ONNX Runtime WebAssembly binaries fetched when a model loads). Model weights are fetched from `huggingface.co`, `cdn-lfs.hf.co`, and `cas-bridge.xethub.hf.co` only when you load a model.

**Content Security Policy:** GitHub Pages cannot set HTTP response headers, so the CSP is delivered only as a `<meta http-equiv="Content-Security-Policy">` tag on pages that can load models (`index.html`, `practice.html`, `own.html`). Static pages (`guide.html`, `facilitator.html`) use a stricter `'self'`-only policy. The model CSP keeps `'wasm-unsafe-eval'` because ONNX Runtime Web compiles WebAssembly at runtime in the browser; without it, model inference fails under a strict CSP.

**Residual CDN risk:** A compromise of jsDelivr or the pinned package paths could substitute malicious JavaScript or WASM. Paths are restricted to the exact version directories above, not the whole `cdn.jsdelivr.net` origin, but you still trust those hosts and package versions when loading optional models.

**Never leaves the browser:** text you type or paste, your verdicts, corrections and verification logs. No analytics, cookies or trackers. User text lives in memory and disappears when you close the tab.

## Limitations

Hints miss subtle paraphrase and reasoning errors. Embedding similarity is not truth. The NLI model can be confidently wrong (see published accuracy limits in the interface). Nothing replaces reading the source.

## Evaluation

Reproduce with `npm run eval` (pattern-only, used in CI) or `npm run eval:model` (adds embedding and NLI). Date: **2026-09-29**. Practice sets: **14**. Claims: **n = 110** (unique 110).

### Pattern-only (`npm run eval`)

| Metric | Value | n |
|--------|-------|---|
| Deterministic precision | 62.5% | 40 |
| Deterministic recall | 52.1% | 48 |

Recall by error type (error claims only): wrong_number 66.7% (4/6), wrong_date_time 100% (4/4), unit_confusion 100% (6/6), invented_quotation 50% (2/4), wrong_place_actor 75% (3/4), lost_uncertainty 50% (2/4), contradiction 66.7% (4/6), not_in_source 0% (0/4), overgeneralization 0% (0/4), omitted_caveat 0% (0/4), sources_disagree 0% (0/2).

### With models (`npm run eval:model`)

| Check | Value | n |
|-------|-------|---|
| Evidence finder top-2 recall (`Xenova/multilingual-e5-small`) | 89.1% | 110 (98/110) |
| NLI agreement with answer key (`Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7`) | 51% | 102 (52/102) |

### About the inference check

The deeper check scores each (evidence, claim) pair with a multilingual natural-language-inference model: the tokenizer receives the evidence as the premise and the claim as the hypothesis, and the three label probabilities come from the model's own logits and label map. It agrees with the answer key on 51% of claims with cited evidence (52/102). It misses some contradictions: for example, the evidence "The survey does not estimate district-wide prevalence." against the claim "The survey estimates district-wide water prevalence." scores neutral 0.912 and contradiction 0.074. Humanitarian paraphrases are often scored neutral, and five human verdicts map onto three model labels. Treat it as a weak signal only.

See `eval/results.json` and `eval/results-with-model.json` for the latest output and `MODELS.md` for pinned revisions and measured download sizes.

## Using it in a training session

See [facilitator guide](web/facilitator.html) (20 to 25 minutes) with printable answer keys and group debrief sheets. Maps to [Session 2: Verified work by role](https://parallexlabs.github.io/humanitarian-ai-training-kit/en/sessions/session-02-verified-work/index.html) in the Humanitarian AI Training Kit. Works without an AI account; pattern hints need only the static page load.

## Languages

English and French interface (`web/i18n/`). French prepared with machine assistance; not yet reviewed by a professional translator. Two practice sets pair a French source with an English summary (or the reverse); hints are weaker across languages.

## Related ParalleX work

- [Humanitarian AI Training Kit](https://parallexlabs.github.io/humanitarian-ai-training-kit/)
- [Humanitarian AI Risk Screen](https://github.com/parallexlabs/humanitarian-ai-risk-screen)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the CI command sequence (`npm test` is unit tests only; `npm run test:browser` and `npm run test:model` cover Playwright and model downloads). Security reports: [SECURITY.md](SECURITY.md).

## Licence

- Code: Apache-2.0 (see [LICENSE](LICENSE))
- Practice cases and written content: CC BY 4.0 (see [LICENSE-CONTENT](LICENSE-CONTENT))

## Citation

See [CITATION.cff](CITATION.cff).

## Open by design

**We build in the open.** ParalleX Labs Inc. publishes its tools, methods and learning materials under open licences, so public-interest teams can use them, check how they work and adapt them freely. Open work is easier to trust, because anyone can see exactly how a result is produced.

**Our own work, and only ours.** Everything in this repository was created by ParalleX Labs Inc. from public guidance and synthetic examples. It contains no client data, no client projects, and no one else's confidential information or intellectual property.
