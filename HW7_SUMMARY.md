# HW7 — YU Multi-Agent Experiments

**Team:** Aline · Colin · Omar
**Project:** YU — biometric interpretation layer for high performers
**Date:** 2026-04-08

## What we built

We split the YU agent system into **7 independent Cloud Run services**, one per agent role, all deployed in `us-east1`:

| Service | Role | Tools |
|---|---|---|
| `yu-heart-agent`     | reads HRV from Oura, classifies state, drafts copy | Oura loader, classifier, Gemini |
| `yu-readiness-agent` | same shape, readiness metric | same |
| `yu-sleep-agent`     | same shape, sleep score | same |
| `yu-stress-agent`    | same shape, stress minutes | same |
| `yu-hypothesis-agent`| generates 3 if-then experiments from the council snapshot | Gemini |
| `yu-notifier-agent`  | only agent allowed to talk outside YU | Telegram Bot API |
| `yu-council`         | orchestrator: fans out to all 6 above | httpx, asyncio.gather |

Same Docker image, parameterised by `AGENT_MODULE` and `AGENT_ID` env vars at deploy time. The council exposes one `POST /tick` endpoint with three experiment toggles: `strategy`, `cache`, `timeout_ms`. All 7 services live, each with its own `*.run.app` URL.

## What we tested

| Experiment | Variant A | Variant B | What we measured |
|---|---|---|---|
| **A — Coordination** | Sequential fan-out | `asyncio.gather` parallel | total wall ms |
| **B — Memory** | No cache | In-process per-day cache | wall ms + Gemini tokens |
| **C — Failure recovery** | Strict 30s timeout | 2s timeout, drop slow agent | wall ms + completion rate + agents reached |

For Experiment C we deployed **`yu-stress-agent` with `SLOW_INJECT_MS=5000`** (env var) so one of the four specialists deterministically takes 5s every call — the same kind of cold-start drag you see in production.

10 trials per variant against the live cloud council.

## Results

| Experiment | Variant | p50 ms | p90 ms | tokens (mean) | completion | specialists reached |
|---|---|---|---|---|---|---|
| A | Sequential | 6 832 | 7 874 | 1 775 | 100% | 4/4 |
| A | **Parallel** | **3 686** | 5 083 | 1 802 | 100% | 4/4 |
| B | Cache off | 3 744 | 5 428 | 1 797 | 100% | 4/4 |
| B | **Cache on** | **2 276** | 3 527 | 1 789 | 100% | 4/4 |
| C | Strict wait (slow stress) | 8 698 | 9 470 | 1 792 | 100% | 4/4 |
| C | **Short timeout (slow stress)** | **4 251** | 4 714 | 1 720 | 100% | **3/4** |

## Key takeaways

1. **A — Parallel fan-out is 1.9× faster.** The total elapsed time is bounded by the slowest specialist when we use `asyncio.gather`. Sequential is dominated by the sum of latencies. For a morning-ritual product where users expect sub-3s response, this is the difference between "instant" and "noticeably slow".

2. **B — In-process cache cuts wall latency 39% (3.7s → 2.3s) but token usage is unchanged.** Each Cloud Run instance has its own in-memory dict, and Cloud Run rotates instances between calls, so the cache rarely hits *across* requests. We saw a clear latency improvement from connection reuse and warmer Python imports — but the token bill didn't move. **Real takeaway: in-memory cache saves ops effort, not money. For real cost reduction we need a Firestore-backed cache (already wired in `agents/shared/cache.py`).**

3. **C — Failure recovery: short timeout completes 2× faster with graceful degradation.** With one specialist deliberately slow (5s injected), strict-wait blocks the council on the slowest agent every single trial. Short-timeout (2s) drops that one agent and proceeds with 3/4 specialists. **Both completed 100% of trials**, but the council with 3/4 reaches the user 4.4 seconds sooner. In a production system, the partial answer is better than no answer.

## What this proves

- **A real, distributed agent system on the cloud, not a script on a laptop.** 7 independent Cloud Run services, each with its own URL, image, and process.
- **Real coordination patterns matter.** Switching from `for ... await` to `asyncio.gather` cut latency in half — the kind of finding you can't get from running everything in one process.
- **Real failure recovery.** Injecting a slow agent caused exactly the failure mode we expected and the timeout strategy handled it.
- **Real Gemini calls.** ~1 800 tokens per tick across 60 trials = ~108 000 real Gemini tokens spent.

## Reproducibility

```bash
# 1. Deploy all 7 services
./scripts/hw7_deploy.sh

# 2. Run experiments A + B
./venv/bin/python scripts/hw7_experiments.py \
  --council "https://yu-council-7wem4eneja-ue.a.run.app" \
  --trials 10 --out hw7_results.json

# 3. Inject the slow stress agent and re-run experiment C
gcloud run services update yu-stress-agent \
  --update-env-vars="SLOW_INJECT_MS=5000" \
  --project=resolution-hack --region=us-east1
./venv/bin/python scripts/hw7_exp_c.py
```

Raw results: `hw7_results.json` and `hw7_exp_c.json`.
