"""
YU Council orchestrator agent.

Calls the 6 worker agents over HTTP. Exposes the 3 experiment toggles:
  strategy   = sequential | parallel
  cache      = on | off
  timeout_ms = N (per-agent timeout for failure-recovery experiment)
  dry_run    = bool (skip real Telegram for trial runs)

This agent has tools (httpx → 6 other agents), state (last tick log),
and autonomy (it picks the spokesperson and decides whether to notify).
"""

import asyncio
import os
import time
from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import uvicorn

PORT = int(os.environ.get("PORT", "8080"))

# Each worker agent has its own URL, supplied as env vars at deploy time.
SPECIALIST_URLS = {
    "heart":     os.environ.get("HEART_URL",     "http://127.0.0.1:8081"),
    "readiness": os.environ.get("READINESS_URL", "http://127.0.0.1:8082"),
    "sleep":     os.environ.get("SLEEP_URL",     "http://127.0.0.1:8083"),
    "stress":    os.environ.get("STRESS_URL",    "http://127.0.0.1:8084"),
}
HYPOTHESIS_URL = os.environ.get("HYPOTHESIS_URL", "http://127.0.0.1:8085")
NOTIFIER_URL   = os.environ.get("NOTIFIER_URL",   "http://127.0.0.1:8086")

app = FastAPI(title="yu-council")


class TickRequest(BaseModel):
    strategy: str = "parallel"      # parallel | sequential
    cache: str = "on"               # on | off
    timeout_ms: int = 3000          # per-agent timeout (0 = no timeout)
    dry_run: bool = True
    persona: str = "consultant"


async def _call_specialist(client: httpx.AsyncClient, name: str, url: str, use_cache: int, timeout: float | None) -> dict:
    started = time.time()
    try:
        params = {"use_cache": use_cache, "use_gemini": 1}
        resp = await client.get(f"{url}/evaluate", params=params, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        return {**data, "_call_ms": int((time.time() - started) * 1000), "_name": name, "_ok": True}
    except Exception as e:
        return {"_name": name, "_ok": False, "_error": f"{type(e).__name__}", "_call_ms": int((time.time() - started) * 1000)}


@app.get("/healthz")
def healthz():
    return {"ok": True, "agent": "council", "specialists": list(SPECIALIST_URLS.keys())}


@app.post("/tick")
async def tick(req: TickRequest):
    """One full agent loop. Returns rich timing/quality data for experiments."""
    t_total = time.time()
    use_cache = 1 if req.cache == "on" else 0
    timeout = (req.timeout_ms / 1000) if req.timeout_ms > 0 else None

    async with httpx.AsyncClient() as client:
        # ── Phase 1: gather specialist evaluations ──
        t_phase = time.time()
        specialist_results: list[dict] = []
        if req.strategy == "parallel":
            tasks = [_call_specialist(client, n, u, use_cache, timeout) for n, u in SPECIALIST_URLS.items()]
            specialist_results = await asyncio.gather(*tasks)
        else:
            for n, u in SPECIALIST_URLS.items():
                specialist_results.append(await _call_specialist(client, n, u, use_cache, timeout))
        phase_ms = int((time.time() - t_phase) * 1000)

        ok_specialists = [r for r in specialist_results if r.get("_ok") and r.get("state") not in (None, "insufficient")]
        failed = [r for r in specialist_results if not r.get("_ok")]

        # ── Phase 2: pick spokesperson — most extreme z-score ──
        spokesperson = None
        if ok_specialists:
            spokesperson = max(ok_specialists, key=lambda r: abs(r.get("z_score") or 0))

        # ── Phase 3: ask hypothesis agent for 3 candidates ──
        t_h = time.time()
        hypothesis_payload = {
            "persona": req.persona,
            "states": [{
                "title": r.get("title"),
                "state_label": r.get("state_label"),
                "today_value": r.get("today_value"),
                "baseline_mean": r.get("baseline_mean"),
            } for r in ok_specialists],
            "history": [],
        }
        try:
            hr = await client.post(f"{HYPOTHESIS_URL}/suggest", json=hypothesis_payload, timeout=20.0)
            hr.raise_for_status()
            hypothesis_data = hr.json()
        except Exception as e:
            hypothesis_data = {"suggestions": [], "source": "error", "tokens": 0, "error": str(e)}
        hypothesis_ms = int((time.time() - t_h) * 1000)

        # ── Phase 4: notifier ──
        notify_result = {"skipped": True}
        if spokesperson:
            notify_payload = {
                "title": spokesperson.get("title", "YU"),
                "data_line": spokesperson.get("data_line", ""),
                "narrative": spokesperson.get("narrative", ""),
                "implication": spokesperson.get("implication", ""),
                "dry_run": req.dry_run,
            }
            try:
                nr = await client.post(f"{NOTIFIER_URL}/send", json=notify_payload, timeout=15.0)
                nr.raise_for_status()
                notify_result = nr.json()
            except Exception as e:
                notify_result = {"sent": False, "mode": "error", "error": str(e)}

    total_ms = int((time.time() - t_total) * 1000)
    total_tokens = sum((r.get("tokens") or 0) for r in specialist_results) + (hypothesis_data.get("tokens") or 0)

    return {
        "ok": True,
        "strategy": req.strategy,
        "cache": req.cache,
        "timeout_ms": req.timeout_ms,
        "dry_run": req.dry_run,
        "phase_specialists_ms": phase_ms,
        "hypothesis_ms": hypothesis_ms,
        "total_ms": total_ms,
        "total_tokens": total_tokens,
        "specialists_ok": len(ok_specialists),
        "specialists_failed": len(failed),
        "spokesperson": spokesperson.get("_name") if spokesperson else None,
        "spokesperson_state": spokesperson.get("state_label") if spokesperson else None,
        "specialist_results": specialist_results,
        "hypothesis": hypothesis_data,
        "notification": notify_result,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
