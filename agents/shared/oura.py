"""
Self-contained Oura data loader for cloud agents.

Reads JSON files baked into the container image at /app/oura_data
Falls back to a deterministic seeded sample if no real data is found,
so the agent always has something to evaluate even on a fresh deploy.
"""

import json
import os
from datetime import datetime, timedelta

OURA_DIR = os.environ.get("OURA_DATA_DIR", "/app/oura_data")


def _load_jsons(path: str) -> list[dict]:
    if not os.path.isdir(path):
        return []
    out = []
    for fn in sorted(os.listdir(path)):
        if not fn.endswith(".json"):
            continue
        try:
            with open(os.path.join(path, fn)) as f:
                data = json.load(f)
            if isinstance(data, list):
                out.extend(data)
            elif isinstance(data, dict) and "data" in data:
                out.extend(data["data"])
        except Exception:
            pass
    return out


def _build_daily_data() -> list[dict]:
    """Returns a list of daily-aggregated dicts with the keys the agents expect."""
    sleep = _load_jsons(os.path.join(OURA_DIR, "sleep"))
    daily_sleep = _load_jsons(os.path.join(OURA_DIR, "daily_sleep"))
    daily_readiness = _load_jsons(os.path.join(OURA_DIR, "daily_readiness"))
    daily_stress = _load_jsons(os.path.join(OURA_DIR, "daily_stress"))

    by_day: dict[str, dict] = {}

    for s in sleep:
        day = s.get("day") or s.get("summary_date")
        if not day:
            continue
        d = by_day.setdefault(day, {"day": day})
        if s.get("average_hrv") is not None:
            d["hrv"] = s["average_hrv"]
        if s.get("average_heart_rate") is not None:
            d["avgHeartRate"] = s["average_heart_rate"]
        if s.get("deep_sleep_duration") is not None:
            d["deepSleepMin"] = round(s["deep_sleep_duration"] / 60)

    for s in daily_sleep:
        day = s.get("day")
        if not day:
            continue
        d = by_day.setdefault(day, {"day": day})
        if s.get("score") is not None:
            d["sleepScore"] = s["score"]

    for r in daily_readiness:
        day = r.get("day")
        if not day:
            continue
        d = by_day.setdefault(day, {"day": day})
        if r.get("score") is not None:
            d["readinessScore"] = r["score"]

    for st in daily_stress:
        day = st.get("day")
        if not day:
            continue
        d = by_day.setdefault(day, {"day": day})
        if st.get("stress_high") is not None:
            d["stressMin"] = st["stress_high"]

    rows = sorted(by_day.values(), key=lambda r: r["day"])
    if not rows:
        # Deterministic synthetic fallback so the agent never crashes
        today = datetime.utcnow().date()
        for i in range(30, -1, -1):
            d = today - timedelta(days=i)
            rows.append({
                "day": d.strftime("%Y-%m-%d"),
                "hrv": 32 + ((i * 7) % 9) - 4,
                "avgHeartRate": 60 + ((i * 5) % 7),
                "sleepScore": 78 + ((i * 11) % 11) - 5,
                "readinessScore": 75 + ((i * 13) % 9) - 4,
                "stressMin": 130 + ((i * 17) % 40) - 20,
                "deepSleepMin": 80 + ((i * 19) % 30) - 15,
            })
    return rows
