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


# ── EWMA Baselines ──────────────────────────────────────────────────────────

EWMA_ALPHA = 0.15  # smoothing factor — higher = more reactive to recent data
PHASE_I_DAYS = 21  # bootstrap period before EWMA kicks in


def compute_ewma(values: list[float], alpha: float = EWMA_ALPHA) -> float | None:
    """Exponentially Weighted Moving Average. More weight on recent values."""
    if not values:
        return None
    ewma = values[0]
    for v in values[1:]:
        ewma = alpha * v + (1 - alpha) * ewma
    return round(ewma, 2)


def compute_ewma_std(values: list[float], alpha: float = EWMA_ALPHA) -> float | None:
    """EWMA standard deviation for control limits."""
    if len(values) < 5:
        return None
    ewma = compute_ewma(values, alpha)
    if ewma is None:
        return None
    # Exponentially-weighted variance
    var = 0.0
    weight = 1.0
    total_w = 0.0
    for v in reversed(values):
        var += weight * (v - ewma) ** 2
        total_w += weight
        weight *= (1 - alpha)
    return round((var / total_w) ** 0.5, 2) if total_w > 0 else None


def compute_baseline_with_limits(values: list[float]) -> dict:
    """Phase I/II baseline with EWMA and control limits.
    Phase I (first 21 days): simple mean + std for bootstrap.
    Phase II (ongoing): EWMA with ±2σ control limits."""
    if not values:
        return {"mean": None, "ewma": None, "std": None, "ucl": None, "lcl": None, "phase": "insufficient"}

    phase = "I" if len(values) <= PHASE_I_DAYS else "II"

    if phase == "I":
        mean = round(statistics.mean(values), 2)
        std = round(statistics.stdev(values), 2) if len(values) >= 3 else None
        return {
            "mean": mean,
            "ewma": mean,
            "std": std,
            "ucl": round(mean + 2 * std, 2) if std else None,
            "lcl": round(mean - 2 * std, 2) if std else None,
            "phase": "I",
            "n": len(values),
        }

    ewma = compute_ewma(values)
    std = compute_ewma_std(values)
    return {
        "mean": round(statistics.mean(values), 2),
        "ewma": ewma,
        "std": std,
        "ucl": round(ewma + 2 * std, 2) if ewma and std else None,
        "lcl": round(ewma - 2 * std, 2) if ewma and std else None,
        "phase": "II",
        "n": len(values),
    }


# ── Competency Matrix ───────────────────────────────────────────────────────

# Per-user approved/blocked movements. Stored in Firestore for multi-user;
# for now, defaults for Omar. Blocked movements are rejected by the validator.

COMPETENCY_COLLECTION = "competency"


def load_competency(user_id: str = "omar") -> dict:
    """Load the user's competency matrix from Firestore.
    Returns {blocked: [str], blocked_reasons: {str: str}}."""
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        doc = db.collection(COMPETENCY_COLLECTION).document(user_id).get()
        if doc.exists:
            return doc.to_dict()
    except Exception:
        pass
    # Default: nothing blocked
    return {"blocked": [], "blocked_reasons": {}}


def block_movement(movement_name: str, reason: str = "injury", user_id: str = "omar") -> dict:
    """Block a movement for a user."""
    comp = load_competency(user_id)
    blocked = comp.get("blocked", [])
    reasons = comp.get("blocked_reasons", {})
    name = movement_name.strip().lower()
    if name not in blocked:
        blocked.append(name)
    reasons[name] = reason
    comp["blocked"] = blocked
    comp["blocked_reasons"] = reasons
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        db.collection(COMPETENCY_COLLECTION).document(user_id).set(comp)
    except Exception:
        pass
    return comp


def unblock_movement(movement_name: str, user_id: str = "omar") -> dict:
    """Unblock a movement for a user."""
    comp = load_competency(user_id)
    name = movement_name.strip().lower()
    comp["blocked"] = [b for b in comp.get("blocked", []) if b != name]
    comp.get("blocked_reasons", {}).pop(name, None)
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        db.collection(COMPETENCY_COLLECTION).document(user_id).set(comp)
    except Exception:
        pass
    return comp


def _get_ml_readiness(bio: dict, baseline: dict) -> dict | None:
    try:
        from .ml_models import predict_readiness
        return predict_readiness(bio, baseline)
    except Exception:
        return None


def _get_catalog_sha() -> str | None:
    try:
        from .catalog_svc import get_catalog_sha
        return get_catalog_sha()
    except Exception:
        return None


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
    user_id: str = "omar",
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
    hrv_baseline_data = compute_baseline_with_limits(last_30_hrvs)
    rhr_baseline_data = compute_baseline_with_limits(last_30_rhrs)
    hrv_bl = hrv_baseline_data.get("ewma") or (round(statistics.mean(last_30_hrvs), 1) if last_30_hrvs else None)
    rhr_val = round(sleep_session.get("average_heart_rate", 0), 1) if sleep_session.get("average_heart_rate") else None
    rhr_bl = rhr_baseline_data.get("ewma") or (round(statistics.mean(last_30_rhrs), 1) if last_30_rhrs else None)
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

    # Multi-signal overtraining guardian (v2.1)
    try:
        from .ml_models import compute_overtraining_risk
        deep_ratio = (deep_min / max(1, total_sleep_hrs * 60)) * 100 if total_sleep_hrs else None
        ot_result = compute_overtraining_risk(
            hrv=hrv_val, rhr=rhr_val, resp_rate=None,
            deep_sleep_ratio=deep_ratio,
            hrv_baseline=hrv_baseline_data, rhr_baseline=rhr_baseline_data,
        )
        overtraining_risk = ot_result["level"]
        overtraining_detail = ot_result
    except Exception:
        overtraining_risk = "none"
        overtraining_detail = {}

    # Load user profile from identity service
    try:
        from backend.identity.service import get_profile
        profile = get_profile(user_id)
    except Exception:
        profile = {}

    # Equipment — from profile if available, else defaults
    if travel_mode:
        equipment = BODYWEIGHT_EQUIPMENT
    elif profile.get("equipment"):
        equipment = profile["equipment"]
    else:
        equipment = DEFAULT_EQUIPMENT

    # Competency
    competency = load_competency(user_id)

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

    # Weekly pattern counts + balance + volume
    try:
        from .workout_brain import recent_log, balance_instructions, tag_patterns as _tag
        import re as _re
        history = recent_log(7)
        balance = balance_instructions(history)
        # Weekly volume: sum reps per pattern from this week's logged workouts
        weekly_volume: dict[str, int] = {}
        for entry in history:
            full = entry.get("full_workout") or {}
            for bk in ("workout", "strength", "metcon"):
                block = full.get(bk) or {}
                for m in (block.get("movements") or []):
                    if not isinstance(m, dict):
                        continue
                    name = m.get("movement_name") or m.get("name") or ""
                    reps_str = str(m.get("reps") or "0")
                    reps_num = 0
                    r_match = _re.match(r"(\d+)", reps_str)
                    if r_match and not any(c in reps_str for c in ["m", "sec", "min"]):
                        reps_num = int(r_match.group(1))
                    pats = _tag([name])
                    for p in pats:
                        weekly_volume[p] = weekly_volume.get(p, 0) + reps_num
    except Exception:
        balance = {"must_include": [], "avoid": [], "week_counts": {}}
        weekly_volume = {}

    return {
        # ── Identity (v2.1 fields 1-6) ──
        "user_id": user_id,
        "catalog_sha": _get_catalog_sha(),
        "equipment": equipment,
        "competency": competency,
        "fitness_level": profile.get("fitness_level", "advanced"),
        "goals": profile.get("goals", ["strength", "conditioning", "hybrid"]),

        # ── Biometrics (v2.1 fields 7-8) ──
        "baseline": {
            "hrv": hrv_baseline_data,
            "rhr": rhr_baseline_data,
        },
        "readiness": readiness_score,

        # ── Risk (v2.1 field 9-10) ──
        "overtraining_risk": overtraining_risk,
        "overtraining_detail": overtraining_detail,
        "load_tolerance": None,       # TODO: load-to-response model

        # ML readiness scorer (v2.1)
        "readiness_ml": _get_ml_readiness(bio={
            "hrv": hrv_val, "rhr": rhr_val, "sleep_score": sleep_score,
            "deep_min": deep_min, "total_sleep_hrs": total_sleep_hrs, "stress_min": stress_min,
        }, baseline={"hrv": hrv_baseline_data, "rhr": rhr_baseline_data}),

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
        "tone_preference": profile.get("tone_preference", "coach"),
        "requested_format": None,
        "requested_type": session_type,
        "avoid_movements": list(avoid_movements or []),
        "lock_patterns": list(lock_patterns or []),

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
        "weekly_volume": weekly_volume,
        "travel_mode": travel_mode,
        "generated_at": now.isoformat(),
    }
