# HW7 — YU Multi-Agent Experiments

_Generated 2026-04-09T04:12:47.417771Z · 5 trials per variant · council: https://yu-council-7wem4eneja-ue.a.run.app_

## Summary

| Experiment | Variant | p50 ms | p90 ms | tokens (mean) | completion % | failures |
|---|---|---|---|---|---|---|
| A | A1 sequential | 12883 | 22437 | 1792 | 100% | 0 |
| A | A2 parallel | 8176 | 8910 | 1793 | 100% | 0 |
| B | B1 cache_off | 8553 | 9037 | 1803 | 100% | 0 |
| B | B2 cache_on | 2415 | 2458 | 1808 | 100% | 0 |
| C | C1 strict_wait | 8429 | 10689 | 1787 | 100% | 0 |
| C | C2 short_timeout | 4337 | 4564 | 1433 | 100% | 0 |

## Key takeaways

- **A** Parallel fan-out is 1.6x faster than sequential (12883ms → 8176ms p50).
- **B** Cache reduces mean Gemini tokens by 0% (1803 → 1808).
- **C** Short-timeout completion rate 100% vs strict-wait 100%.