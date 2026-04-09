"""
HW7 — runs 3 distinct experiments against the deployed YU council.

Experiment A — Coordination strategy: sequential vs parallel fan-out
Experiment B — Memory strategy:    cache off vs cache on
Experiment C — Failure recovery:   strict-wait vs short timeout

Each variant runs N trials. Records timings, token usage, success/failure.
Saves raw JSON and prints a markdown summary.

Usage:
  python scripts/hw7_experiments.py --council https://yu-council-xxxx.run.app --trials 25
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from datetime import datetime

import httpx


async def trial(client: httpx.AsyncClient, url: str, body: dict, timeout: float = 60.0) -> dict:
    started = time.time()
    try:
        r = await client.post(f"{url}/tick", json=body, timeout=timeout)
        r.raise_for_status()
        data = r.json()
        return {**data, "_wall_ms": int((time.time() - started) * 1000), "_ok": True}
    except Exception as e:
        return {"_wall_ms": int((time.time() - started) * 1000), "_ok": False, "_error": f"{type(e).__name__}: {e}"}


async def run_variant(client: httpx.AsyncClient, url: str, name: str, body: dict, n: int) -> dict:
    print(f"  ▸ {name} ({n} trials)…", flush=True)
    rows = []
    for i in range(n):
        row = await trial(client, url, body)
        rows.append(row)
        print(f"     trial {i+1:2d}/{n}: {row.get('_wall_ms')}ms · ok={row.get('_ok')}", flush=True)
    return summarize(name, body, rows)


def summarize(name: str, body: dict, rows: list[dict]) -> dict:
    okays = [r for r in rows if r.get("_ok")]
    fails = len(rows) - len(okays)
    walls = [r["_wall_ms"] for r in okays]
    tokens = [r.get("total_tokens", 0) for r in okays]
    completed = [r for r in okays if r.get("specialists_ok", 0) >= 1]
    return {
        "variant": name,
        "config": body,
        "n": len(rows),
        "ok": len(okays),
        "failures": fails,
        "completion_rate": round(len(completed) / max(1, len(rows)), 3),
        "wall_ms": {
            "p50": int(statistics.median(walls)) if walls else None,
            "p90": int(statistics.quantiles(walls, n=10)[-1]) if len(walls) >= 10 else (max(walls) if walls else None),
            "mean": int(statistics.mean(walls)) if walls else None,
            "min": min(walls) if walls else None,
            "max": max(walls) if walls else None,
        },
        "tokens": {
            "mean": int(statistics.mean(tokens)) if tokens else 0,
            "total": sum(tokens),
        },
        "rows": rows,
    }


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--council", required=True, help="Council base URL")
    ap.add_argument("--trials", type=int, default=15)
    ap.add_argument("--out", default="hw7_results.json")
    args = ap.parse_args()

    print(f"🧪 HW7 experiments → {args.council}")
    print(f"   {args.trials} trials per variant\n")

    async with httpx.AsyncClient() as client:

        all_results = {}

        # ── Experiment A: coordination ──
        print("Experiment A — Coordination strategy")
        all_results["A_sequential"] = await run_variant(
            client, args.council, "A1 sequential",
            {"strategy": "sequential", "cache": "off", "timeout_ms": 10000, "dry_run": True}, args.trials)
        all_results["A_parallel"] = await run_variant(
            client, args.council, "A2 parallel",
            {"strategy": "parallel",   "cache": "off", "timeout_ms": 10000, "dry_run": True}, args.trials)

        # ── Experiment B: memory ──
        print("\nExperiment B — Memory strategy")
        all_results["B_no_cache"] = await run_variant(
            client, args.council, "B1 cache_off",
            {"strategy": "parallel",   "cache": "off", "timeout_ms": 10000, "dry_run": True}, args.trials)
        all_results["B_cache_on"] = await run_variant(
            client, args.council, "B2 cache_on",
            {"strategy": "parallel",   "cache": "on",  "timeout_ms": 10000, "dry_run": True}, args.trials)

        # ── Experiment C: failure recovery ──
        # Variant C1 has no per-agent timeout (waits indefinitely).
        # Variant C2 times out at 2s, so a slow agent gets dropped.
        # The slow agent is configured at deploy time via SLOW_INJECT_MS.
        # For this run we just compare strict-wait vs short timeout against
        # whatever the worker latencies happen to be.
        print("\nExperiment C — Failure recovery")
        all_results["C_strict_wait"] = await run_variant(
            client, args.council, "C1 strict_wait",
            {"strategy": "parallel",   "cache": "off", "timeout_ms": 30000, "dry_run": True}, args.trials)
        all_results["C_short_timeout"] = await run_variant(
            client, args.council, "C2 short_timeout",
            {"strategy": "parallel",   "cache": "off", "timeout_ms": 2000,  "dry_run": True}, args.trials)

    # ── Persist + report ──
    out = {
        "generated": datetime.utcnow().isoformat() + "Z",
        "council": args.council,
        "trials_per_variant": args.trials,
        "results": all_results,
    }
    with open(args.out, "w") as f:
        json.dump(out, f, indent=2, default=str)
    print(f"\n💾 Raw results → {args.out}")

    # ── Markdown summary ──
    md = []
    md.append(f"# HW7 — YU Multi-Agent Experiments\n")
    md.append(f"_Generated {out['generated']} · {args.trials} trials per variant · council: {args.council}_\n")
    md.append("## Summary\n")
    md.append("| Experiment | Variant | p50 ms | p90 ms | tokens (mean) | completion % | failures |")
    md.append("|---|---|---|---|---|---|---|")
    for key in ["A_sequential", "A_parallel", "B_no_cache", "B_cache_on", "C_strict_wait", "C_short_timeout"]:
        r = all_results[key]
        md.append(f"| {key.split('_')[0]} | {r['variant']} | {r['wall_ms']['p50']} | {r['wall_ms']['p90']} | {r['tokens']['mean']} | {int(r['completion_rate']*100)}% | {r['failures']} |")
    md.append("\n## Key takeaways\n")

    a_seq = all_results["A_sequential"]["wall_ms"]["p50"] or 0
    a_par = all_results["A_parallel"]["wall_ms"]["p50"] or 1
    md.append(f"- **A** Parallel fan-out is {round(a_seq / max(1,a_par), 1)}x faster than sequential ({a_seq}ms → {a_par}ms p50).")
    b_off_t = all_results["B_no_cache"]["tokens"]["mean"]
    b_on_t = all_results["B_cache_on"]["tokens"]["mean"]
    saved = round(100 * (1 - b_on_t / max(1, b_off_t)))
    md.append(f"- **B** Cache reduces mean Gemini tokens by {saved}% ({b_off_t} → {b_on_t}).")
    c_strict = all_results["C_strict_wait"]["completion_rate"]
    c_short = all_results["C_short_timeout"]["completion_rate"]
    md.append(f"- **C** Short-timeout completion rate {int(c_short*100)}% vs strict-wait {int(c_strict*100)}%.")
    summary = "\n".join(md)
    with open(args.out.replace(".json", ".md"), "w") as f:
        f.write(summary)
    print(f"📝 Summary → {args.out.replace('.json','.md')}\n")
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())
