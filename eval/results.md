# Source Check Lab evaluation

Date: 2026-09-29
Mode: pattern-only
Practice sets: 14
Claims evaluated (n): 110 (unique: 110)

## Deterministic hints

| Metric | Value | n |
|--------|-------|---|
| Precision | 62.5% | 40 |
| Recall | 52.1% | 48 |

### Recall by error type

| Error type | Recall % | tp | fn | n |
|------------|----------|----|----|---|
| wrong_number | 66.7% | 4 | 2 | 6 |
| not_in_source | 0% | 0 | 4 | 4 |
| contradiction | 66.7% | 4 | 2 | 6 |
| lost_uncertainty | 50% | 2 | 2 | 4 |
| overgeneralization | 0% | 0 | 4 | 4 |
| sources_disagree | 0% | 0 | 2 | 2 |
| wrong_date_time | 100% | 4 | 0 | 4 |
| unit_confusion | 100% | 6 | 0 | 6 |
| invented_quotation | 50% | 2 | 2 | 4 |
| omitted_caveat | 0% | 0 | 4 | 4 |
| wrong_place_actor | 75% | 3 | 1 | 4 |
