"""
Drift Detection Engine — the core differentiator of YU RestOS.

Detects burnout by combining TWO independent signal sources:
1. Eight Sleep biometrics (objective: sleep score, HRV, deep sleep %)
2. Self-reported check-ins (subjective: mood, energy, stress)

When BOTH signal sources degrade simultaneously over 3+ consecutive days,
that's a "drift event" — the user is heading toward burnout.
"""


def detect_drift(sleep_trends: list[dict], checkins: list[dict]) -> dict:
    """Analyze the last N days for drift patterns."""

    sleep_by_date = {t["day"]: t for t in sleep_trends}
    checkin_by_date = {c["date"]: c for c in checkins}

    common_dates = sorted(set(sleep_by_date.keys()) & set(checkin_by_date.keys()))

    if len(common_dates) < 5:
        return {"drift_detected": False, "reason": "Insufficient data"}

    # Baseline: first 5 days
    baseline_dates = common_dates[:5]
    baseline_sleep = sum(sleep_by_date[d]["sleepScore"] for d in baseline_dates) / 5
    baseline_hrv = sum(sleep_by_date[d]["hrv"] for d in baseline_dates) / 5
    baseline_mood = sum(checkin_by_date[d]["mood"] for d in baseline_dates) / 5
    baseline_energy = sum(checkin_by_date[d]["energy"] for d in baseline_dates) / 5

    # Scan for consecutive decline
    consecutive_decline = 0
    drift_start = None
    signals = []

    for date in common_dates[5:]:
        s = sleep_by_date[date]
        c = checkin_by_date[date]

        sleep_drop = ((baseline_sleep - s["sleepScore"]) / baseline_sleep) * 100
        hrv_drop = ((baseline_hrv - s["hrv"]) / baseline_hrv) * 100
        mood_drop = ((baseline_mood - c["mood"]) / baseline_mood) * 100
        energy_drop = ((baseline_energy - c["energy"]) / baseline_energy) * 100

        biometric_declining = sleep_drop > 10 or hrv_drop > 15
        behavioral_declining = mood_drop > 15 or energy_drop > 20

        if biometric_declining and behavioral_declining:
            consecutive_decline += 1
            if drift_start is None:
                drift_start = date
            signals.append({
                "date": date,
                "sleepScore": s["sleepScore"],
                "hrv": s["hrv"],
                "mood": c["mood"],
                "energy": c["energy"],
                "sleepDrop": round(sleep_drop, 1),
                "hrvDrop": round(hrv_drop, 1),
                "moodDrop": round(mood_drop, 1),
                "energyDrop": round(energy_drop, 1),
            })
        else:
            consecutive_decline = 0
            drift_start = None
            signals = []

    drift_detected = consecutive_decline >= 3

    if drift_detected and signals:
        latest = signals[-1]
        severity_score = (latest["sleepDrop"] + latest["hrvDrop"] +
                          latest["moodDrop"] + latest["energyDrop"]) / 4
        if severity_score > 30:
            severity = "high"
        elif severity_score > 20:
            severity = "medium"
        else:
            severity = "low"
    else:
        severity = "none"
        severity_score = 0

    return {
        "drift_detected": drift_detected,
        "severity": severity,
        "severity_score": round(severity_score, 1),
        "consecutive_days": consecutive_decline,
        "drift_start_date": drift_start,
        "baseline": {
            "sleepScore": round(baseline_sleep, 1),
            "hrv": round(baseline_hrv, 1),
            "mood": round(baseline_mood, 1),
            "energy": round(baseline_energy, 1),
        },
        "signals": signals,
        "summary": _generate_summary(drift_detected, severity, signals, baseline_sleep, baseline_hrv)
    }


def _generate_summary(detected, severity, signals, baseline_sleep, baseline_hrv):
    if not detected:
        return "No burnout drift detected. Your sleep and wellbeing are stable."

    latest = signals[-1]
    days = len(signals)
    return (
        f"Drift detected: {days} consecutive days of dual-signal decline. "
        f"Sleep score dropped {latest['sleepDrop']}% from your baseline of {baseline_sleep:.0f}. "
        f"HRV dropped {latest['hrvDrop']}% from {baseline_hrv:.0f}ms. "
        f"Your self-reported mood and energy confirm you're feeling the impact. "
        f"Severity: {severity}."
    )
