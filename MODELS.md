# On-device models

Source Check Lab downloads these models only when the user presses a labelled button. We verified each entry on **2026-09-29** with the Hugging Face API (`https://huggingface.co/api/models/<id>`) and the ONNX tree API for quantized file sizes.

## Xenova/multilingual-e5-small

| Field | Value |
|-------|-------|
| Upstream | [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) |
| Transformers.js revision | `761b726dd34fb83930e26aab4e9ac3899aa1fa78` |
| Licence | MIT |
| Licence URL | https://opensource.org/licenses/MIT |
| Transformers.js dtype | q8 (`model_quantized.onnx`) |
| Measured download (q8, browser) | **113 MB** (118,308,185 bytes) |
| Languages | Multilingual (100+ languages per upstream card) |
| Use in lab | Semantic evidence finder: ranks source sentences related to each claim |

## Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7

| Field | Value |
|-------|-------|
| Upstream | [MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7) |
| Transformers.js revision | `0864ced79bf1ef851bfaf9dd9de0aa54d735d9d0` |
| Licence | MIT |
| Licence URL | https://opensource.org/licenses/MIT |
| Transformers.js dtype | q8 (`model_quantized.onnx`) |
| Measured download (q8, browser) | **323 MB** (338,679,132 bytes) |
| Languages | Multilingual NLI (upstream: 100+ languages) |
| Use in lab | Optional deeper check: entailment / neutral / contradiction probabilities vs selected evidence (premise = evidence, hypothesis = claim) |

### Published limits (from upstream model card, 2026-09-29)

Source: [model card README](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7). The lab quotes these figures in the interface; they are not live guarantees.

| Benchmark | Accuracy |
|-----------|----------|
| XNLI English | 87.1% |
| XNLI French | 82.3% |
| ANLI (adversarial, all rounds) | 53.7% |
| ANLI round 3 | 49.7% |

`id2label` from config: `0: entailment`, `1: neutral`, `2: contradiction`.

## Library

| Package | Version | Licence |
|---------|---------|---------|
| @huggingface/transformers | 4.3.0 (pinned) | Apache-2.0 |

Loaded from `https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0` inside a module Web Worker. Each model load passes the `revision` option above.

## Notes

- `Xenova/paraphrase-multilingual-MiniLM-L12-v2` was evaluated as an alternative embedding model (MIT, ONNX available). We ship `multilingual-e5-small` for stronger multilingual retrieval in evaluation.
- If a model fails to load, the UI states which checks still run (deterministic pattern hints).
- NLI agreement in evaluation uses premise = source evidence sentence, hypothesis = claim text, matching the upstream zero-shot NLI usage.
