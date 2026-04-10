"""
Per-user biometric data loader.

Reads from the Firestore biometric_samples collection (normalized
BiometricSample format) for any user. Falls back to the global
in-memory Oura caches for Omar (backwards compatible).

This replaces direct reads from _sleep_by_day/_score_by_day etc.
in the workout pipeline.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


def _get_db():
    try:
        from google.cloud import firestore
        return firestore.Client(project="resolution-hack")
    except Exception:
        return None


def load_user_biometrics(user_id: str, days: int = 30) -> dict:
    """Load biometric data for a user from Firestore BiometricSamples.
    Returns dicts in the same shape as the Oura in-memory caches so
    build_athlete_context() works without changes.

    Returns: {sleep_by_day, score_by_day, readiness_by_day, stress_by_day}
    """
    # For Omar, use the existing global caches (most data, fastest)
    if user_id == "omar" or user_id == "":
        return _load_omar_fallback()

    db = _get_db()
    if not db:
        return _empty()

    cutoff = (datetime.now(BOSTON_TZ) - timedelta(days=days)).strftime("%Y-%m-%d")
    try:
        docs = db.collection("biometric_samples").where("user_id", "==", user_id).where("day", ">=", cutoff).stream()
        samples = [d.to_dict() for d in docs]
    except Exception:
        return _empty()

    if not samples:
        return _empty()

    # Rebuild the cache shape from normalized samples
    sleep_by_day: dict = {}
    score_by_day: dict = {}
    readiness_by_day: dict = {}
    stress_by_day: dict = {}

    for s in samples:
        day = s.get("day", "")
        st = s.get("sample_type", "")
        val = s.get("value")
        if not day or val is None:
            continue

        if st == "hrv_rmssd":
            sleep_by_day.setdefault(day, {})["average_hrv"] = val
        elif st == "rhr":
            sleep_by_day.setdefault(day, {})["average_heart_rate"] = val
        elif st == "deep_sleep_min":
            sleep_by_day.setdefault(day, {})["deep_sleep_duration"] = val * 60  # back to seconds
        elif st == "total_sleep_min":
            sleep_by_day.setdefault(day, {})["total_sleep_duration"] = val * 60
        elif st == "sleep_efficiency":
            sleep_by_day.setdefault(day, {})["efficiency"] = val
        elif st == "sleep_score":
            score_by_day[day] = val
        elif st == "readiness_score":
            readiness_by_day[day] = {"score": val}
        elif st == "stress_high_min":
            stress_by_day[day] = {"stress_high": val * 60}  # back to seconds
        elif st == "respiratory_rate":
            sleep_by_day.setdefault(day, {})["average_breath"] = val

    return {
        "sleep_by_day": sleep_by_day,
        "score_by_day": score_by_day,
        "readiness_by_day": readiness_by_day,
        "stress_by_day": stress_by_day,
    }


def _load_omar_fallback() -> dict:
    """Load from the global in-memory Oura caches for backwards compat."""
    try:
        from backend.oura.routes import _sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day
        return {
            "sleep_by_day": _sleep_by_day,
            "score_by_day": _score_by_day,
            "readiness_by_day": _readiness_by_day,
            "stress_by_day": _stress_by_day,
        }
    except Exception:
        return _empty()


def _empty() -> dict:
    return {"sleep_by_day": {}, "score_by_day": {}, "readiness_by_day": {}, "stress_by_day": {}}
