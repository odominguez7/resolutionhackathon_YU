# HW7 — YU Multi-Agent Experiments

_Generated 2026-04-09T03:49:54.216730Z · 10 trials per variant · council: https://yu-council-7wem4eneja-ue.a.run.app_

## Summary

| Experiment | Variant | p50 ms | p90 ms | tokens (mean) | completion % | failures |
|---|---|---|---|---|---|---|
| A | A1 sequential | 6832 | 7874 | 1775 | 100% | 0 |
| A | A2 parallel | 3686 | 5083 | 1802 | 100% | 0 |
| B | B1 cache_off | 3744 | 5428 | 1797 | 100% | 0 |
| B | B2 cache_on | 2276 | 3527 | 1789 | 100% | 0 |
| C | C1 strict_wait | 4051 | 4903 | 1792 | 100% | 0 |
| C | C2 short_timeout | 3626 | 4280 | 1720 | 100% | 0 |

## Key takeaways

- **A** Parallel fan-out is 1.9x faster than sequential (6832ms → 3686ms p50).
- **B** Cache reduces mean Gemini tokens by 0% (1797 → 1789).
- **C** Short-timeout completion rate 100% vs strict-wait 100%.