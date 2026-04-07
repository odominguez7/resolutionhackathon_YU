"""
Drift Prediction + Trigger Analysis for YU Cortex.

Prediction: Analyzes historical patterns to forecast drift probability in the next 72 hours.
Triggers: Looks backward 24-72h before drift onset to identify what caused it.
"""

import statistics
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

# Patterns that historically precede drift (from research document)
PRECURSOR_PATTERNS = [
    {
        "id": "sleep_debt",
        "name": "Sleep debt accumulation",
        "check": lambda days: sum(1 for d in days if d.get("totalSleepHours", 8) < 6.5) >= 2,
        "weight": 0.25,
        "description": "2+ nights under 6.5 hours in the last 3 days",
    },
    {
        "id": "deep_sleep_deficit",
        "name": "Deep sleep deficit",
        "check": lambda days: sum(1 for d in days if (d.get("deepSleepMin") or 60) < 45) >= 2,
        "weight": 0.20,
        "description": "2+ nights with less than 45 min deep sleep",
    },
    {
        "id": "hrv_decline",
        "name": "HRV trending down",
        "check": lambda days: len(days) >= 3 and all(
            (days[i].get("hrv") or 99) <= (days[i-1].get("hrv") or 0) for i in range(1, min(3, len(days)))
        ),
        "weight": 0.25,
        "description": "HRV declining for 3 consecutive days",
    },
    {
        "id": "stress_spike",
        "name": "Sustained high stress",
        "check": lambda days: sum(1 for d in days if (d.get("stressMin") or 0) > 90) >= 2,
        "weight": 0.15,
        "description": "2+ days with more than 90 min of high stress",
    },
    {
        "id": "rhr_elevation",
        "name": "RHR creeping up",
        "check": lambda days: len(days) >= 3 and (days[-1].get("avgHeartRate") or 0) - (days[0].get("avgHeartRate") or 0) > 3,
        "weight": 0.15,
        "description": "Resting heart rate increased 3+ bpm over 3 days",
    },
]


def predict_drift(daily_data: list[dict]) -> dict:
    """Predict probability of drift in the next 72 hours."""
    if len(daily_data) < 7:
        return {"probability": 0, "risk_level": "insufficient_data", "precursors": []}

    # Look at last 3 days for precursor patterns
    recent_3 = daily_data[-3:]
    active_precursors = []
    total_weight = 0

    for pattern in PRECURSOR_PATTERNS:
        try:
            if pattern["check"](recent_3):
                active_precursors.append({
                    "id": pattern["id"],
                    "name": pattern["name"],
                    "description": pattern["description"],
                    "weight": pattern["weight"],
                })
                total_weight += pattern["weight"]
        except:
            pass

    # Calculate probability (weighted sum, capped at 95%)
    probability = min(95, round(total_weight * 100))

    # Boost probability if already in YELLOW zone
    latest = daily_data[-1]
    readiness = latest.get("readinessScore", 70)
    if readiness < 65:
        probability = min(95, probability + 15)

    # Risk level
    if probability >= 70:
        risk_level = "high"
    elif probability >= 40:
        risk_level = "moderate"
    elif probability >= 15:
        risk_level = "low"
    else:
        risk_level = "minimal"

    return {
        "probability": probability,
        "risk_level": risk_level,
        "precursors": active_precursors,
        "precursors_active": len(active_precursors),
        "window": "next 72 hours",
        "based_on": f"last 3 days of biometric data ({recent_3[0].get('day', '?')} to {recent_3[-1].get('day', '?')})",
    }


def analyze_triggers(daily_data: list[dict], drift_start_idx: int = None) -> dict:
    """Identify what likely caused the current drift by looking backward."""
    if len(daily_data) < 7:
        return {"triggers": [], "analysis": "Insufficient data for trigger analysis."}

    # Find drift start: first YELLOW/RED day in recent window
    if drift_start_idx is None:
        # Find where metrics started declining
        for i in range(len(daily_data) - 1, max(0, len(daily_data) - 10), -1):
            readiness = daily_data[i].get("readinessScore", 70)
            if readiness >= 75:
                drift_start_idx = i + 1
                break
        if drift_start_idx is None:
            drift_start_idx = max(0, len(daily_data) - 7)

    # Look at 3 days BEFORE drift started
    pre_drift = daily_data[max(0, drift_start_idx - 3):drift_start_idx]
    if not pre_drift:
        return {"triggers": [], "analysis": "Cannot identify pre-drift window."}

    triggers = []

    # Check for training overload (consecutive high-activity days)
    high_activity = [d for d in pre_drift if (d.get("stressMin") or 0) > 60]
    if len(high_activity) >= 2:
        triggers.append({
            "trigger": "Training or activity overload",
            "evidence": f"{len(high_activity)} high-activity days in the 3 days before drift started",
            "confidence": "high" if len(high_activity) >= 3 else "moderate",
        })

    # Check for sleep debt
    short_sleep = [d for d in pre_drift if (d.get("totalSleepHours") or 8) < 6.5]
    if short_sleep:
        triggers.append({
            "trigger": "Sleep debt",
            "evidence": f"{len(short_sleep)} nights under 6.5 hours before drift started",
            "confidence": "high" if len(short_sleep) >= 2 else "moderate",
        })

    # Check for stress accumulation
    high_stress = [d for d in pre_drift if (d.get("stressMin") or 0) > 90]
    if high_stress:
        triggers.append({
            "trigger": "Sustained stress load",
            "evidence": f"{len(high_stress)} days with 90+ minutes of high stress before drift",
            "confidence": "high" if len(high_stress) >= 2 else "moderate",
        })

    # Check for HRV suppression
    hrv_vals = [d.get("hrv") for d in pre_drift if d.get("hrv")]
    if len(hrv_vals) >= 2:
        hrv_trend = hrv_vals[-1] - hrv_vals[0]
        if hrv_trend < -5:
            triggers.append({
                "trigger": "Rapid HRV decline",
                "evidence": f"HRV dropped {abs(hrv_trend):.0f}ms in the days before drift",
                "confidence": "high",
            })

    # Check deep sleep
    low_deep = [d for d in pre_drift if (d.get("deepSleepMin") or 60) < 45]
    if low_deep:
        triggers.append({
            "trigger": "Deep sleep deficit",
            "evidence": f"{len(low_deep)} nights with under 45 min deep sleep -- GH repair impaired",
            "confidence": "moderate",
        })

    if not triggers:
        triggers.append({
            "trigger": "Gradual accumulation",
            "evidence": "No single acute trigger identified. Drift likely from cumulative load over time.",
            "confidence": "low",
        })

    return {
        "triggers": triggers,
        "pre_drift_window": f"{pre_drift[0].get('day', '?')} to {pre_drift[-1].get('day', '?')}",
        "analysis": f"Analyzed {len(pre_drift)} days before drift onset. Found {len(triggers)} likely trigger{'s' if len(triggers) != 1 else ''}.",
    }
