"""HW7 Experiment C only — failure recovery with a known slow agent."""

import asyncio, json, statistics, time
from datetime import datetime, timezone
import httpx

COUNCIL = "https://yu-council-7wem4eneja-ue.a.run.app"
N = 10


async def trial(client, body):
    t0 = time.time()
    try:
        r = await client.post(f"{COUNCIL}/tick", json=body, timeout=120.0)
        r.raise_for_status()
        d = r.json()
        return {**d, "_wall_ms": int((time.time() - t0) * 1000), "_ok": True}
    except Exception as e:
        return {"_wall_ms": int((time.time() - t0) * 1000), "_ok": False, "_error": f"{type(e).__name__}: {e}"}


async def run(name, body):
    print(f"\n{name}")
    rows = []
    async with httpx.AsyncClient() as client:
        for i in range(N):
            row = await trial(client, body)
            rows.append(row)
            print(f"  {i+1:2d}/{N}: {row['_wall_ms']}ms · ok={row['_ok']} · specialists_ok={row.get('specialists_ok','-')}/{4} · failed={row.get('specialists_failed','-')}")
    walls = [r["_wall_ms"] for r in rows if r["_ok"]]
    completed = [r for r in rows if r["_ok"] and r.get("specialists_ok", 0) >= 1]
    return {
        "variant": name,
        "n": N,
        "p50": int(statistics.median(walls)) if walls else None,
        "p90": int(statistics.quantiles(walls, n=10)[-1]) if len(walls) >= 10 else max(walls),
        "completion_rate": round(len(completed) / N, 2),
        "avg_specialists_ok": round(statistics.mean([r.get("specialists_ok", 0) for r in rows]), 2),
        "rows": rows,
    }


async def main():
    c1 = await run("C1 strict_wait (timeout=30s, must wait for slow stress)",
                   {"strategy": "parallel", "cache": "off", "timeout_ms": 30000, "dry_run": True})
    c2 = await run("C2 short_timeout (timeout=2s, drops slow stress)",
                   {"strategy": "parallel", "cache": "off", "timeout_ms": 2000, "dry_run": True})

    out = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "experiment": "C — failure recovery with slow stress agent (SLOW_INJECT_MS=5000)",
        "variants": {"C1": c1, "C2": c2},
    }
    with open("hw7_exp_c.json", "w") as f:
        json.dump(out, f, indent=2, default=str)

    print(f"\n— Results —")
    print(f"  C1 strict_wait : p50 {c1['p50']}ms · completion {int(c1['completion_rate']*100)}% · avg specialists_ok {c1['avg_specialists_ok']}/4")
    print(f"  C2 short_timeout: p50 {c2['p50']}ms · completion {int(c2['completion_rate']*100)}% · avg specialists_ok {c2['avg_specialists_ok']}/4")
    print(f"\n💾 hw7_exp_c.json")


if __name__ == "__main__":
    asyncio.run(main())
