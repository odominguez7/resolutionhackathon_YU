"""
Typed AthleteContext — single source of truth for who the athlete is and
what state they're in at the moment of workout generation.

Replaces the ad-hoc biometrics dicts that were built inline in routes.py.
Every downstream consumer (prompt builder, validator, progression,
adherence, skeleton) reads from this instead of its own assembly.

v2.1 spec: 18 fields. We implement all 18.
"""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


# ── Equipment Model ─────────────────────────────────────────────────────────

# Typed equipment set. Each key is an equipment type, value is a list of
# available weights or True for presence. The validator checks every
# movement's required equipment against this set.

DEFAULT_EQUIPMENT = {
    "dumbbells": [35, 40, 45, 50],        # available pairs in lbs
    "treadmill": True,
    "pull_up_bar": True,
    # NOT available (explicitly false so the validator can reject)
    "barbell": False,
    "bench": False,
    "box": False,
    "rings": False,
    "kettlebell": False,
    "rope": False,
    "rower": False,
    "bike_erg": False,
}

BODYWEIGHT_EQUIPMENT = {
    "dumbbells": [],
    "treadmill": False,
    "pull_up_bar": False,
    "barbell": False,
    "bench": False,
    "box": False,
    "rings": False,
    "kettlebell": False,
    "rope": False,
    "rower": False,
    "bike_erg": False,
}

# Movement → required equipment mapping. If a movement requires equipment
# not in the athlete's set, the validator rejects it.
MOVEMENT_EQUIPMENT = {
    # Require dumbbells
    "db": "dumbbells",
    "dumbbell": "dumbbells",
    "goblet": "dumbbells",
    "man maker": "dumbbells",
    "devil press": "dumbbells",
    "cluster": "dumbbells",
    "arnold": "dumbbells",
    "z-press": "dumbbells",
    "renegade": "dumbbells",
    "floor press": "dumbbells",
    # Require pull-up bar
    "pull-up": "pull_up_bar",
    "pullup": "pull_up_bar",
    "chin-up": "pull_up_bar",
    "chinup": "pull_up_bar",
    "hanging": "pull_up_bar",
    "l-hang": "pull_up_bar",
    # Require treadmill
    "treadmill": "treadmill",
    # Require barbell (should be rejected for Omar)
    "barbell": "barbell",
    # Require bench
    "bench press": "bench",
    "incline press": "bench",
    # Require box
    "box jump": "box",
    "step-up": "box",
    # Require kettlebell
    "kettlebell": "kettlebell",
    "kb ": "kettlebell",
    # Require rings
    "ring": "rings",
    # Require rope
    "rope climb": "rope",
    # Require rower
    "row erg": "rower",
    "rowing machine": "rower",
}


def check_equipment(movement_name: str, equipment: dict) -> str | None:
    """Return an error string if the movement requires equipment the athlete
    doesn't have. None if OK."""
    name_lower = movement_name.lower()
    for keyword, equip_key in MOVEMENT_EQUIPMENT.items():
        if keyword in name_lower:
            val = equipment.get(equip_key)
            if val is False or val is None or val == []:
                return f"Movement '{movement_name}' requires {equip_key} which is not available"
    return None


# ── Intensity tier ──────────────────────────────────────────────────────────

def compute_intensity_tier(readiness: float, hrv: float | None, hrv_baseline: float | None) -> str:
    """Deterministic intensity tier from biometrics.
    Returns: push / work / easy / recovery."""
    if readiness > 80 and hrv and hrv_baseline and hrv >= hrv_baseline:
        return "push"
    if readiness > 65:
        return "work"
    if readiness > 50:
        return "easy"
    return "recovery"


# ── Build the full context ──────────────────────────────────────────────────

def build_athlete_context(
    sleep_by_day: dict,
    score_by_day: dict,
    readiness_by_day: dict,
    stress_by_day: dict,
    session_type: str = "crossfit",
    travel_mode: bool = False,
    avoid_movements: list[str] | None = None,
    lock_patterns: list[str] | None = None,
) -> dict:
    """Assemble the full 18-field AthleteContext from raw Oura caches.
    This is the ONLY place biometrics get assembled. Everyone reads from here."""

    now = datetime.now(BOSTON_TZ)
    today_str = now.strftime("%Y-%m-%d")

    days = sorted(sleep_by_day.keys())
    last_30_hrvs = [sleep_by_day[d].get("average_hrv") for d in days[-30:] if sleep_by_day[d].get("average_hrv")]
    last_30_rhrs = [sleep_by_day[d].get("average_heart_rate") for d in days[-30:] if sleep_by_day[d].get("average_heart_rate")]

    # Today or most recent day
    if today_str in score_by_day:
        latest_day = today_str
    elif score_by_day:
        latest_day = max(score_by_day.keys())
    else:
        latest_day = today_str

    sleep_session = sleep_by_day.get(latest_day, {})
    readiness_data = readiness_by_day.get(latest_day, {})
    stress_data = stress_by_day.get(latest_day, {})

    # Last 3 days trend
    last_3 = []
    for d in days[-3:]:
        s = sleep_by_day[d]
        last_3.append({
            "day": d,
            "sleep_score": score_by_day.get(d, 0),
            "hrv": s.get("average_hrv"),
            "rhr": round(s.get("average_heart_rate", 0), 1) if s.get("average_heart_rate") else None,
            "readiness": readiness_by_day.get(d, {}).get("score"),
            "deep_min": round(s.get("deep_sleep_duration", 0) / 60),
            "total_hrs": round(s.get("total_sleep_duration", 0) / 3600, 1),
        })

    hrv_val = sleep_session.get("average_hrv")
    hrv_bl = round(statistics.mean(last_30_hrvs), 1) if last_30_hrvs else None
    rhr_val = round(sleep_session.get("average_heart_rate", 0), 1) if sleep_session.get("average_heart_rate") else None
    rhr_bl = round(statistics.mean(last_30_rhrs), 1) if last_30_rhrs else None
    readiness_score = readiness_data.get("score", 0)
    sleep_score = score_by_day.get(latest_day)
    stress_min = round((stress_data.get("stress_high", 0) or 0) / 60)
    deep_min = round(sleep_session.get("deep_sleep_duration", 0) / 60)
    total_sleep_hrs = round(sleep_session.get("total_sleep_duration", 0) / 3600, 1)

    intensity = compute_intensity_tier(readiness_score, hrv_val, hrv_bl)

    if intensity == "push":
        recovery_context = "Fully recovered. Push hard today."
    elif intensity == "work":
        recovery_context = "Decent recovery. Solid work day."
    elif intensity == "easy":
        recovery_context = "Under-recovered. Go easier today."
    else:
        recovery_context = "Low recovery. Active recovery only."

    # Equipment
    equipment = BODYWEIGHT_EQUIPMENT if travel_mode else DEFAULT_EQUIPMENT

    # Progression ledger
    try:
        from .workout_progression import get_all_progressions
        progression = get_all_progressions()
    except Exception:
        progression = []

    # Adherence profile
    try:
        from .workout_adherence import build_adherence_profile
        from .workout_brain import recent_log
        adherence = build_adherence_profile(recent_log(14))
    except Exception:
        adherence = {}

    # Weekly pattern counts + balance
    try:
        from .workout_brain import recent_log, balance_instructions
        history = recent_log(7)
        balance = balance_instructions(history)
    except Exception:
        balance = {"must_include": [], "avoid": [], "week_counts": {}}

    return {
        # ── Identity (v2.1 fields 1-6) ──
        "user_id": "omar",
        "catalog_sha": None,  # no versioning yet
        "equipment": equipment,
        "competency": None,   # no competency matrix yet — all movements assumed OK
        "fitness_level": "advanced",
        "goals": ["strength", "conditioning", "hybrid"],

        # ── Biometrics (v2.1 fields 7-8) ──
        "baseline": {
            "hrv": hrv_bl,
            "rhr": rhr_bl,
        },
        "readiness": readiness_score,

        # ── Risk (v2.1 field 9-10) ──
        "overtraining_risk": "none",  # TODO: multi-signal guardian
        "load_tolerance": None,       # TODO: load-to-response model

        # ── History (v2.1 fields 11-12) ──
        "last_7_sessions": [
            {"day": e.get("day"), "intensity": e.get("intensity"), "patterns": e.get("patterns"), "title": e.get("title")}
            for e in (balance.get("_raw_history") or [])
        ] if balance.get("_raw_history") else [],
        "weekly_pattern_counts": balance.get("week_counts", {}),

        # ── Personalization (v2.1 fields 13-14) ──
        "progression_ledger": {
            r.get("movement_name", ""): {
                "current_lbs": r.get("current_load_lbs"),
                "next_lbs": r.get("next_prescribed_lbs"),
                "consecutive_clean": r.get("consecutive_clean", 0),
            }
            for r in progression if r.get("movement_name")
        },
        "adherence_profile": adherence,

        # ── Preferences (v2.1 fields 15-18) ──
        "tone_preference": "coach",  # TODO: learn from feedback
        "requested_format": None,
        "requested_type": session_type,
        "avoid_movements": set(avoid_movements or []),
        "lock_patterns": set(lock_patterns or []),

        # ── Raw biometrics (for prompt injection + logging) ──
        "biometrics": {
            "sleep_score": sleep_score,
            "readiness": readiness_score,
            "hrv": hrv_val,
            "hrv_baseline": hrv_bl,
            "rhr": rhr_val,
            "rhr_baseline": rhr_bl,
            "stress_min": stress_min,
            "deep_min": deep_min,
            "total_sleep_hrs": total_sleep_hrs,
            "last_3_days": last_3,
            "recovery_context": recovery_context,
        },

        # ── Derived ──
        "intensity_tier": intensity,
        "balance": {
            "must_include": balance.get("must_include", []),
            "avoid": balance.get("avoid", []),
        },
        "travel_mode": travel_mode,
        "generated_at": now.isoformat(),
    }
