"""
YU Forecast Accuracy — the prediction-confirmation dopamine engine.

Stores user predictions about their own future biometrics, then verifies them
the next day against real Oura data. Surfaces a rolling Forecast Accuracy %.

This is THE differentiator: the user is competing with themselves at reading
their own body, not against population norms or other users.
"""

import json
import os
import statistics
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
PRED_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "yu_predictions.json")

# Tolerance bands per metric — within this many units = "accurate enough" (a hit)
HIT_TOLERANCE = {
    "hrv": 4,           # ms
    "readiness": 4,     # /100
    "sleep": 4,         # /100
    "deep_sleep": 10,   # minutes
    "rhr": 3,           # bpm
}

# Zone boundaries as multiples of the small_step. The 5 zones from baseline:
#   way_down  : delta < -2 * step
#   down      : -2 * step <= delta < -0.5 * step
#   same      : -0.5 * step <= delta <= +0.5 * step
#   up        : +0.5 * step <  delta <= +2 * step
#   way_up    : delta > +2 * step
ZONE_STEP = {
    "hrv": 4,
    "readiness": 4,
    "sleep": 4,
    "deep_sleep": 10,
    "rhr": 3,
}
ZONE_LABELS = ["way_down", "down", "same", "up", "way_up"]


def value_to_zone(value: float, baseline: float, target_metric: str) -> str:
    step = ZONE_STEP.get(target_metric, 4)
    delta = value - baseline
    if delta < -2 * step:
        return "way_down"
    if delta < -0.5 * step:
        return "down"
    if delta <= 0.5 * step:
        return "same"
    if delta <= 2 * step:
        return "up"
    return "way_up"
METRIC_OURA_KEY = {
    "hrv": "hrv",
    "readiness": "readinessScore",
    "sleep": "sleepScore",
    "deep_sleep": "deepSleepMin",
    "rhr": "avgHeartRate",
}


def _load() -> list[dict]:
    if os.path.exists(PRED_FILE):
        try:
            with open(PRED_FILE) as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save(rows: list[dict]) -> None:
    with open(PRED_FILE, "w") as f:
        json.dump(rows, f, indent=2)


def _today_value(target_metric: str):
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data() or []
    if not daily:
        return None
    key = METRIC_OURA_KEY.get(target_metric, "hrv")
    val = daily[-1].get(key)
    return float(val) if val is not None else None


def record_prediction(target_metric: str, predicted_zone: str, baseline: float, agent_id: str = "", rationale: str = "", mood_score: int | None = None) -> dict:
    """Logs a zone prediction made today, to be verified on a future day."""
    rows = _load()
    today = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    rows = [r for r in rows if not (r["made_on"] == today and r["target_metric"] == target_metric)]
    entry = {
        "made_on": today,
        "agent_id": agent_id,
        "target_metric": target_metric,
        "predicted_zone": predicted_zone,
        "baseline_at_prediction": float(baseline),
        "rationale": rationale,
        "mood_score": mood_score,
        "verified_on": None,
        "actual": None,
        "actual_zone": None,
        "is_hit": None,
    }
    rows.append(entry)
    _save(rows)
    return entry


def error_sparkline(window: int = 7) -> list[float]:
    """Returns the last N zone-distances (smaller = better). For the verification banner trend."""
    rows = [r for r in _load() if r.get("verified_on") and r.get("zone_distance") is not None]
    return [r["zone_distance"] for r in rows[-window:]]


def baseline_trend(target_metric: str, days: int = 30) -> dict:
    """Returns the user's metric trajectory and the rolling 7-day baseline.
    The dopamine question: 'is your floor rising?'"""
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data() or []
    key = METRIC_OURA_KEY.get(target_metric, "hrv")
    series = [d.get(key) for d in daily if d.get(key) is not None][-days:]
    if len(series) < 4:
        return {"target_metric": target_metric, "values": series, "rolling": [], "delta": None, "direction": "flat"}
    rolling = []
    window = 7
    for i in range(len(series)):
        lo = max(0, i - window + 1)
        chunk = series[lo:i + 1]
        rolling.append(round(sum(chunk) / len(chunk), 1))
    # delta = mean of last 7 vs mean of first 7
    early = sum(rolling[:7]) / 7 if len(rolling) >= 7 else rolling[0]
    late = sum(rolling[-7:]) / 7 if len(rolling) >= 7 else rolling[-1]
    delta = round(late - early, 1)
    if abs(delta) < 0.5:
        direction = "flat"
    elif delta > 0:
        direction = "up"
    else:
        direction = "down"
    return {
        "target_metric": target_metric,
        "values": [round(v, 1) for v in series],
        "rolling": rolling,
        "delta": delta,
        "direction": direction,
        "days": len(series),
    }


def felt_sense_alignment() -> dict:
    """How often did the user's mood at prediction time align with the actual data direction?
    Alignment = % of cases where (mood high & actual high vs baseline) or (mood low & actual low vs baseline)."""
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data() or []
    if not daily:
        return {"pct": None, "count": 0}
    rows = [r for r in _load() if r.get("verified_on") and r.get("mood_score") is not None]
    if not rows:
        return {"pct": None, "count": 0}
    aligned = 0
    for r in rows:
        # naive: compare mood (1-10) above 5 vs actual above predicted
        if r["mood_score"] >= 6 and r["actual"] >= r["predicted"]:
            aligned += 1
        elif r["mood_score"] <= 5 and r["actual"] <= r["predicted"]:
            aligned += 1
    return {"pct": round(100 * aligned / len(rows)), "count": len(rows)}


def verify_pending() -> list[dict]:
    """For every unverified prediction made on a previous day, look up today's
    actual value and score the zone. Returns the rows that were just verified."""
    rows = _load()
    today = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    just_verified = []
    cache_today_value: dict[str, float | None] = {}
    for r in rows:
        if r.get("verified_on"):
            continue
        if r["made_on"] >= today:
            continue
        if r["target_metric"] not in cache_today_value:
            cache_today_value[r["target_metric"]] = _today_value(r["target_metric"])
        actual = cache_today_value[r["target_metric"]]
        if actual is None:
            continue
        baseline = r.get("baseline_at_prediction", actual)
        actual_zone = value_to_zone(actual, baseline, r["target_metric"])
        r["verified_on"] = today
        r["actual"] = round(actual, 1)
        r["actual_zone"] = actual_zone
        r["is_hit"] = (r.get("predicted_zone") == actual_zone)
        # Adjacent-zone "near miss" — for the surprise UX
        try:
            i_pred = ZONE_LABELS.index(r.get("predicted_zone"))
            i_act = ZONE_LABELS.index(actual_zone)
            r["zone_distance"] = abs(i_pred - i_act)
        except ValueError:
            r["zone_distance"] = None
        just_verified.append(r)
    if just_verified:
        _save(rows)
    return just_verified


def accuracy_summary() -> dict:
    """Rolling forecast accuracy: 7-day, 30-day, lifetime."""
    verify_pending()
    rows = [r for r in _load() if r.get("verified_on")]
    today = datetime.now(BOSTON_TZ).date()

    def window(days: int | None):
        if days is None:
            scoped = rows
        else:
            scoped = [r for r in rows if (today - datetime.strptime(r["verified_on"], "%Y-%m-%d").date()).days <= days]
        if not scoped:
            return {"count": 0, "hit_pct": None, "avg_error": None}
        hit_pct = round(100 * sum(1 for r in scoped if r.get("is_hit")) / len(scoped))
        zone_dists = [r["zone_distance"] for r in scoped if r.get("zone_distance") is not None]
        avg_err = round(statistics.mean(zone_dists), 2) if zone_dists else None
        return {"count": len(scoped), "hit_pct": hit_pct, "avg_error": avg_err}

    last = next((r for r in reversed(rows) if r.get("verified_on")), None)
    return {
        "windows": {
            "last_7": window(7),
            "last_30": window(30),
            "lifetime": window(None),
        },
        "last_verification": last,
        "total_predictions": len(_load()),
    }


def todays_verification(target_metric: str | None = None) -> dict | None:
    """If a prediction made on a prior day got verified today, return it."""
    today = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    rows = _load()
    candidates = [r for r in rows if r.get("verified_on") == today]
    if target_metric:
        candidates = [r for r in candidates if r["target_metric"] == target_metric]
    return candidates[-1] if candidates else None
