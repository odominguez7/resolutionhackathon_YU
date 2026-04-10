"""
Normalization Layer — the 0-1 scale that decouples intelligence from hardware.

Every raw wearable value gets compressed into a normalized 0.0–1.0 score.
The THINK agent only interacts with normalized math. Hardware changes,
provider switches, API format updates — none of them touch the intelligence.

Also computes:
- data_confidence_score (how much can we trust today's inputs?)
- nervous_system_state (sympathetic vs parasympathetic dominant)
- ACWR (Acute:Chronic Workload Ratio — the golden metric)
- muscle_readiness_heatmap (per-chain recovery state)
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


# ── Normalization (raw → 0.0–1.0) ───────────────────────────────────────────

def normalize_readiness(raw: float | None, provider: str = "oura") -> float:
    """Any provider's readiness → 0.0–1.0."""
    if raw is None:
        return 0.5  # unknown = middle
    if provider == "oura":
        return round(min(1.0, max(0.0, raw / 100)), 3)
    if provider == "garmin":  # Body Battery 0-100
        return round(min(1.0, max(0.0, raw / 100)), 3)
    if provider == "whoop":  # Recovery 0-100%
        return round(min(1.0, max(0.0, raw / 100)), 3)
    return round(min(1.0, max(0.0, raw / 100)), 3)


def normalize_sleep(raw: float | None, provider: str = "oura") -> float:
    """Sleep score → 0.0–1.0."""
    if raw is None:
        return 0.5
    return round(min(1.0, max(0.0, raw / 100)), 3)


def normalize_stress(raw_minutes: float | None) -> float:
    """Stress minutes → 0.0–1.0 (higher = more stressed).
    0 min = 0.0, 300+ min = 1.0."""
    if raw_minutes is None:
        return 0.0
    return round(min(1.0, max(0.0, raw_minutes / 300)), 3)


# ── Data Confidence Score ────────────────────────────────────────────────────

def compute_data_confidence(
    has_wearable: bool,
    has_today_biometrics: bool,
    has_calendar: bool,
    has_subjective_log: bool,
    has_workout_history: bool,
    wearable_data_age_hours: float = 0,
) -> float:
    """How much can we trust today's inputs? 0.0–1.0.

    0.95 = full wearable + calendar + subjective + history (prescribe aggressively)
    0.60 = wearable only, no calendar or subjective (moderate confidence)
    0.30 = no wearable at all (safe defaults only)
    """
    score = 0.0
    if has_wearable:
        score += 0.40
        if has_today_biometrics:
            score += 0.20
            # Penalize stale data
            if wearable_data_age_hours > 24:
                score -= 0.10
        else:
            score += 0.05  # has device but no today data
    if has_calendar:
        score += 0.10
    if has_subjective_log:
        score += 0.15
    if has_workout_history:
        score += 0.15
    return round(min(1.0, max(0.0, score)), 2)


# ── Nervous System State ─────────────────────────────────────────────────────

def detect_nervous_system_state(
    hrv_deviation_ms: float,
    rhr_deviation_bpm: float,
) -> str:
    """Classify autonomic nervous system state.

    sympathetic_dominant: HRV below baseline + RHR above baseline
      → fight-or-flight, stressed, under-recovered
    parasympathetic_dominant: HRV above baseline + RHR below baseline
      → rest-and-digest, recovered, ready to push
    balanced: mixed signals or small deviations
    """
    if hrv_deviation_ms < -5 and rhr_deviation_bpm > 2:
        return "sympathetic_dominant"
    if hrv_deviation_ms > 3 and rhr_deviation_bpm < -1:
        return "parasympathetic_dominant"
    return "balanced"


# ── ACWR (Acute:Chronic Workload Ratio) ──────────────────────────────────────

def compute_acwr(workout_log: list[dict]) -> dict:
    """The golden metric of sports science.

    Acute = last 7 days total volume load
    Chronic = last 28 days average weekly volume load
    ACWR = Acute / Chronic

    < 0.8  = undertrained (safe to increase)
    0.8–1.3 = sweet spot
    1.3–1.5 = elevated risk
    > 1.5  = danger zone (throttle immediately)
    """
    now = datetime.now(BOSTON_TZ)
    acute_cutoff = now - timedelta(days=7)
    chronic_cutoff = now - timedelta(days=28)

    acute_load = 0
    chronic_load = 0
    chronic_weeks = 0

    for entry in workout_log:
        try:
            gen = datetime.fromisoformat(entry.get("generated_at", ""))
            if gen.tzinfo is None:
                gen = gen.replace(tzinfo=BOSTON_TZ)
        except (ValueError, KeyError):
            continue

        # Only count completed workouts
        fb = (entry.get("user_feedback") or {}).get("completed")
        if fb not in ("yes", "partial"):
            continue

        # Volume load = duration * intensity_multiplier
        duration = entry.get("duration_min") or entry.get("full_workout", {}).get("duration_min") or 45
        intensity = entry.get("intensity", "work")
        multiplier = {"push": 1.3, "work": 1.0, "easy": 0.6, "recovery": 0.3}.get(intensity, 1.0)
        load = duration * multiplier

        if gen >= acute_cutoff:
            acute_load += load
        if gen >= chronic_cutoff:
            chronic_load += load

    # Chronic = average weekly load over 4 weeks
    chronic_weekly = chronic_load / 4 if chronic_load > 0 else 1

    acwr = round(acute_load / max(1, chronic_weekly), 2)

    zone = "sweet_spot"
    if acwr < 0.8:
        zone = "undertrained"
    elif acwr > 1.5:
        zone = "danger_zone"
    elif acwr > 1.3:
        zone = "elevated_risk"

    return {
        "ratio": acwr,
        "zone": zone,
        "acute_load": round(acute_load, 1),
        "chronic_weekly": round(chronic_weekly, 1),
    }


# ── Muscle Readiness Heatmap ─────────────────────────────────────────────────

def compute_muscle_heatmap(workout_log: list[dict]) -> dict:
    """Per-chain recovery state. 0.0 = just worked (needs rest), 1.0 = fully recovered.

    Based on days since each muscle chain was last worked.
    Day 0 = 0.2, Day 1 = 0.5, Day 2 = 0.8, Day 3+ = 1.0."""
    now = datetime.now(BOSTON_TZ)
    chains = {"push_h": 1.0, "push_v": 1.0, "pull_v": 1.0, "pull_h": 1.0,
              "squat": 1.0, "hinge": 1.0, "core": 1.0, "olympic": 1.0}

    for entry in reversed(workout_log):
        try:
            gen = datetime.fromisoformat(entry.get("generated_at", ""))
            if gen.tzinfo is None:
                gen = gen.replace(tzinfo=BOSTON_TZ)
        except (ValueError, KeyError):
            continue

        fb = (entry.get("user_feedback") or {}).get("completed")
        if fb not in ("yes", "partial"):
            continue

        days_ago = (now - gen).days
        recovery = min(1.0, max(0.2, days_ago * 0.3 + 0.2))

        for pattern in (entry.get("patterns") or []):
            if pattern in chains:
                chains[pattern] = min(chains[pattern], round(recovery, 1))

    return chains


# ── Build the Universal Context ──────────────────────────────────────────────

def build_universal_context(ctx: dict, workout_log: list[dict]) -> dict:
    """Transform the existing AthleteContext into the universal schema.
    This is the normalization layer that sits between PERCEIVE and THINK."""

    bio = ctx.get("biometrics") or {}
    baseline = ctx.get("baseline") or {}
    adherence = ctx.get("adherence_profile") or {}
    hrv_bl = (baseline.get("hrv") or {})
    rhr_bl = (baseline.get("rhr") or {})

    hrv = bio.get("hrv")
    rhr = bio.get("rhr")
    hrv_ewma = hrv_bl.get("ewma") if isinstance(hrv_bl, dict) else hrv_bl
    rhr_ewma = rhr_bl.get("ewma") if isinstance(rhr_bl, dict) else rhr_bl

    hrv_deviation = round(hrv - hrv_ewma, 1) if hrv and hrv_ewma else 0
    rhr_deviation = round(rhr - rhr_ewma, 1) if rhr and rhr_ewma else 0

    has_wearable = bool(hrv or bio.get("readiness"))
    has_today = bool(bio.get("readiness"))
    has_calendar = ctx.get("calendar_cognitive_load", 0) > 0
    has_subjective = bool(adherence.get("last_feedback"))
    has_history = len(workout_log) >= 3

    return {
        "meta": {
            "athlete_id": ctx.get("user_id", "unknown"),
            "timestamp_local": datetime.now(BOSTON_TZ).isoformat(),
            "schema_version": "v2.1",
            "data_confidence_score": compute_data_confidence(
                has_wearable, has_today, has_calendar, has_subjective, has_history,
            ),
        },
        "static_profile": {
            "primary_goal": "_".join(ctx.get("goals") or ["hybrid"]),
            "fitness_level": ctx.get("fitness_level", "intermediate"),
            "biomechanical_constraints": (ctx.get("competency") or {}).get("blocked", []),
        },
        "chronobiology_and_friction": {
            "equipment_context": "home_gym" if ctx.get("equipment", {}).get("dumbbells") else "bodyweight",
            "cognitive_load_index": round(ctx.get("calendar_cognitive_load", 0) / 10, 2),
            "sleep_debt_hrs": round(max(0, 7.5 - (bio.get("total_sleep_hrs") or 7.5)), 1),
            "preferred_training_window": (adherence.get("preferred_training_window") or {}).get("label"),
        },
        "physiological_engine": {
            "readiness_normalized": normalize_readiness(bio.get("readiness")),
            "sleep_normalized": normalize_sleep(bio.get("sleep_score")),
            "stress_normalized": normalize_stress(bio.get("stress_min")),
            "nervous_system_state": detect_nervous_system_state(hrv_deviation, rhr_deviation),
            "hrv_deviation_ms": hrv_deviation,
            "rhr_deviation_bpm": rhr_deviation,
        },
        "load_ledger": {
            "acwr": compute_acwr(workout_log),
            "muscle_readiness_heatmap": compute_muscle_heatmap(workout_log),
            "days_since_complete_rest": _days_since_rest(workout_log),
        },
        "system_flags": {
            "is_missing_wearable_data": not has_wearable,
            "is_missing_subjective_log": not has_subjective,
            "active_streak": adherence.get("streak", 0),
            "overtraining_risk": ctx.get("overtraining_risk", "none"),
            "data_confidence": compute_data_confidence(
                has_wearable, has_today, has_calendar, has_subjective, has_history,
            ),
        },
    }


def _days_since_rest(workout_log: list[dict]) -> int:
    """Count consecutive days with a completed workout (no rest day)."""
    now = datetime.now(BOSTON_TZ).date()
    days = 0
    for i in range(30):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        had_workout = any(
            e.get("day") == day and (e.get("user_feedback") or {}).get("completed") in ("yes", "partial")
            for e in workout_log
        )
        if had_workout:
            days += 1
        else:
            break
    return days
