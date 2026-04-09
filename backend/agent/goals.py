"""
YU Goals — Gollwitzer if-then hypothesis storage.

A user encodes ONE active goal as a behavioral hypothesis:
"Test whether {behavior} for {N days} improves my {target_metric}"

Stored as JSON on disk. The whole point is that every specialist agent reads
this goal and runs against it. The screen has a north star.
"""

import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
GOAL_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "yu_goal.json")

DEFAULT_GOAL = {
    "persona": "consultant",
    "behavior": "Email cutoff at 9pm",
    "duration_days": 7,
    "target_metric": "hrv",
    "target_metric_label": "morning HRV",
    "started_on": None,
    "baseline_at_start": None,  # the metric value the day the test started
    "adherence": {},  # day -> "yes" | "partial" | "no"
}

LIBRARY_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "yu_hypothesis_library.json")

PERSONAS = {
    "consultant": {
        "label": "Consultant lens",
        "frame": "cognitive performance and decision capacity",
        "voice_rule": "Lead with cognitive readiness and how the data maps to today's calendar. Never use wellness language.",
    },
    "athlete": {
        "label": "Athlete lens",
        "frame": "training absorption and readiness for intensity",
        "voice_rule": "Lead with training load and recovery. Reference workout windows.",
    },
    "founder": {
        "label": "Founder lens",
        "frame": "energy as fuel for high-stakes decisions",
        "voice_rule": "Lead with how the data protects tomorrow's baseline. Frame work cutoffs as performance architecture, never self-care.",
    },
}

METRIC_KEYS = {
    "hrv": ("hrv", "morning HRV"),
    "readiness": ("readinessScore", "readiness"),
    "sleep": ("sleepScore", "sleep score"),
    "deep_sleep": ("deepSleepMin", "deep sleep"),
    "rhr": ("avgHeartRate", "resting heart rate"),
}
# direction = +1 if higher is better, -1 if lower is better
METRIC_DIRECTION = {"hrv": 1, "readiness": 1, "sleep": 1, "deep_sleep": 1, "rhr": -1}


def _today_metric_value(target_metric: str) -> float | None:
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data() or []
    if not daily:
        return None
    key = METRIC_KEYS.get(target_metric, ("hrv", ""))[0]
    val = daily[-1].get(key)
    return float(val) if val is not None else None


def load_library() -> list[dict]:
    if os.path.exists(LIBRARY_FILE):
        try:
            with open(LIBRARY_FILE) as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_library(lib: list[dict]) -> None:
    with open(LIBRARY_FILE, "w") as f:
        json.dump(lib, f, indent=2)


def _compute_verdict(h: dict) -> dict:
    """Confirmed / inconclusive / weakened, based on end value vs baseline_at_start."""
    start = h.get("baseline_at_start")
    end = h.get("ended_value")
    direction = METRIC_DIRECTION.get(h.get("target_metric"), 1)
    if start is None or end is None:
        return {"label": "inconclusive", "delta": None, "delta_pct": None}
    delta = end - start
    delta_signed = delta * direction  # positive = improvement
    delta_pct = round((delta / start) * 100, 1) if start else None
    if abs(delta_pct or 0) < 2:
        label = "inconclusive"
    elif delta_signed > 0:
        label = "confirmed"
    else:
        label = "weakened"
    return {"label": label, "delta": round(delta, 1), "delta_pct": delta_pct}


def archive_active(reason: str = "replaced") -> dict | None:
    """Archive the current goal into the library with a computed verdict."""
    if not os.path.exists(GOAL_FILE):
        return None
    g = load_goal()
    if not g.get("started_on"):
        return None
    end_val = _today_metric_value(g["target_metric"])
    archived = {
        **g,
        "ended_on": datetime.now(BOSTON_TZ).strftime("%Y-%m-%d"),
        "ended_value": end_val,
        "archive_reason": reason,
    }
    archived["verdict"] = _compute_verdict(archived)
    lib = load_library()
    lib.insert(0, archived)
    save_library(lib)
    return archived


def load_goal() -> dict:
    if os.path.exists(GOAL_FILE):
        try:
            with open(GOAL_FILE) as f:
                data = json.load(f)
            return {**DEFAULT_GOAL, **data}
        except Exception:
            pass
    g = {**DEFAULT_GOAL, "started_on": datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")}
    save_goal(g)
    return g


def save_goal(goal: dict) -> dict:
    with open(GOAL_FILE, "w") as f:
        json.dump(goal, f, indent=2)
    return goal


def update_goal(payload: dict) -> dict:
    if payload.get("reset"):
        # Archive existing hypothesis (if any) before starting a new one
        archive_active(reason="replaced")
        g = {**DEFAULT_GOAL}
        for k in ("persona", "behavior", "duration_days", "target_metric", "target_metric_label"):
            if k in payload:
                g[k] = payload[k]
        g["started_on"] = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
        g["baseline_at_start"] = _today_metric_value(g["target_metric"])
        g["adherence"] = {}
        return save_goal(g)
    g = load_goal()
    for k in ("persona", "behavior", "duration_days", "target_metric", "target_metric_label"):
        if k in payload:
            g[k] = payload[k]
    return save_goal(g)


def log_adherence(day: str, value: str) -> dict:
    g = load_goal()
    g["adherence"][day] = value
    return save_goal(g)


def goal_progress() -> dict:
    g = load_goal()
    started = datetime.strptime(g["started_on"], "%Y-%m-%d").replace(tzinfo=BOSTON_TZ)
    today = datetime.now(BOSTON_TZ)
    day_index = (today.date() - started.date()).days + 1
    days = []
    for i in range(g["duration_days"]):
        d = (started + timedelta(days=i)).strftime("%Y-%m-%d")
        days.append({"date": d, "status": g["adherence"].get(d, "pending" if i + 1 >= day_index else "skipped")})
    persona = PERSONAS.get(g["persona"], PERSONAS["consultant"])
    # Backfill baseline_at_start for older goals that don't have it
    if g.get("baseline_at_start") is None:
        g["baseline_at_start"] = _today_metric_value(g["target_metric"])
        save_goal(g)
    today_val = _today_metric_value(g["target_metric"])
    direction = METRIC_DIRECTION.get(g["target_metric"], 1)
    running_delta = None
    running_delta_pct = None
    if today_val is not None and g.get("baseline_at_start"):
        d = today_val - g["baseline_at_start"]
        running_delta = round(d, 1)
        running_delta_pct = round((d / g["baseline_at_start"]) * 100, 1) if g["baseline_at_start"] else None
    return {
        "goal": g,
        "persona": {"id": g["persona"], **persona},
        "day_index": min(day_index, g["duration_days"]),
        "duration": g["duration_days"],
        "days": days,
        "complete": day_index > g["duration_days"],
        "baseline_at_start": g.get("baseline_at_start"),
        "today_value": today_val,
        "running_delta": running_delta,
        "running_delta_pct": running_delta_pct,
        "direction": direction,
    }
