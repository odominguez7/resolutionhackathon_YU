"""
Product-led growth instrumentation (Q40 application).

Tracks the single metric that matters for YU activation:
time-to-first-State-Card per session — i.e. how long from a user landing
on /agent until they see their first /api/agent/ritual response.

Stored locally as a JSON ring buffer; safe to ship as-is for the demo
and easy to swap for BigQuery later.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
_HERE = os.path.dirname(__file__)
PATH = os.path.abspath(os.path.join(_HERE, "..", "..", "plg_metrics.json"))
MAX_ENTRIES = 500


def _load() -> dict:
    if not os.path.exists(PATH):
        return {"sessions": {}, "activations": []}
    try:
        with open(PATH) as f:
            return json.load(f)
    except Exception:
        return {"sessions": {}, "activations": []}


def _save(d: dict) -> None:
    with open(PATH, "w") as f:
        json.dump(d, f, indent=2)


def session_started(session_id: str) -> None:
    """Call when /agent page loads (or first agent API hit)."""
    if not session_id:
        return
    d = _load()
    if session_id not in d["sessions"]:
        d["sessions"][session_id] = {"started_at": time.time()}
        _save(d)


def first_state_card(session_id: str) -> dict:
    """Call when /api/agent/ritual returns successfully. Records latency."""
    if not session_id:
        return {"recorded": False, "reason": "no session_id"}
    d = _load()
    sess = d["sessions"].get(session_id)
    if not sess:
        d["sessions"][session_id] = {"started_at": time.time(), "card_at": time.time()}
        _save(d)
        return {"recorded": False, "reason": "no prior session start"}
    if "card_at" in sess:
        return {"recorded": False, "reason": "already activated"}
    sess["card_at"] = time.time()
    latency_ms = int((sess["card_at"] - sess["started_at"]) * 1000)
    d["activations"].append({
        "session_id": session_id,
        "latency_ms": latency_ms,
        "at": datetime.now(BOSTON_TZ).isoformat(),
    })
    if len(d["activations"]) > MAX_ENTRIES:
        d["activations"] = d["activations"][-MAX_ENTRIES:]
    _save(d)
    return {"recorded": True, "latency_ms": latency_ms}


def summary() -> dict:
    d = _load()
    acts = d.get("activations", [])
    if not acts:
        return {"activations": 0, "p50_ms": None, "p90_ms": None, "avg_ms": None}
    lats = sorted(a["latency_ms"] for a in acts)
    n = len(lats)
    p50 = lats[n // 2]
    p90 = lats[min(n - 1, int(n * 0.9))]
    avg = sum(lats) // n
    return {
        "activations": n,
        "p50_ms": p50,
        "p90_ms": p90,
        "avg_ms": avg,
        "last": acts[-5:],
    }
