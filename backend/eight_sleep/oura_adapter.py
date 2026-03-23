"""
Oura Ring data adapter — converts real Oura API data into
the same format as our Eight Sleep mock data.

Loads exported JSON from scripts/oura_data/ and produces
MOCK_INTERVALS, MOCK_TRENDS, MOCK_CURRENT compatible structures.
"""

import json
import os
from datetime import datetime

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "scripts", "oura_data"
)


def _load(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def load_oura_data():
    """Load and merge all Oura data sources, return last 14 days."""

    sleep_sessions = _load("sleep.json")
    daily_sleep = _load("daily_sleep.json")
    daily_readiness = _load("daily_readiness.json")
    daily_stress = _load("daily_stress.json")

    # Build lookups by day
    sleep_by_day = {}
    for s in sleep_sessions:
        # Use the most recent "long_sleep" session per day
        if s.get("type") == "long_sleep" or not sleep_by_day.get(s["day"]):
            sleep_by_day[s["day"]] = s

    score_by_day = {d["day"]: d.get("score", 0) for d in daily_sleep}
    readiness_by_day = {d["day"]: d for d in daily_readiness}
    stress_by_day = {d["day"]: d for d in daily_stress}

    # Get all days that have sleep data, sorted, last 14
    all_days = sorted(sleep_by_day.keys())
    # Take last 14 days
    days = all_days[-14:] if len(all_days) >= 14 else all_days

    return days, sleep_by_day, score_by_day, readiness_by_day, stress_by_day


def generate_oura_trends():
    """Generate trend data from real Oura data in Eight Sleep format."""
    days, sleep_by_day, score_by_day, readiness_by_day, stress_by_day = load_oura_data()

    trends = []
    for day in days:
        s = sleep_by_day.get(day, {})
        score = score_by_day.get(day, 0)
        readiness = readiness_by_day.get(day, {})
        stress = stress_by_day.get(day, {})

        total = s.get("total_sleep_duration", 0)
        deep = s.get("deep_sleep_duration", 0)
        rem = s.get("rem_sleep_duration", 0)
        light = s.get("light_sleep_duration", 0)
        awake = s.get("awake_time", 0)
        total_stages = deep + rem + light + awake if (deep + rem + light + awake) > 0 else 1

        # Temperature from readiness
        temp_dev = readiness.get("temperature_deviation", 0) or 0
        bed_temp = 27.5 + temp_dev  # Simulated bed temp from body temp deviation

        # Stress: convert seconds to 1-10 scale
        stress_high = stress.get("stress_high", 0) or 0
        stress_score = min(10, max(1, int(stress_high / 3600) + 1))

        # Fitness sub-scores from readiness contributors
        contributors = readiness.get("contributors", {})
        readiness_score = readiness.get("score", 70)

        trends.append({
            "day": day,
            "sleepFitnessScore": {
                "total": readiness_score,
                "sleepDurationSeconds": {"score": contributors.get("total_sleep", readiness_score)},
                "latencyAsleepSeconds": {"score": contributors.get("latency", readiness_score)},
                "latencyOutSeconds": {"score": contributors.get("efficiency", readiness_score)},
                "wakeupConsistency": {"score": contributors.get("regularity", readiness_score)},
            },
            "sleepScore": score,
            "hrv": s.get("average_hrv", 0),
            "avgHeartRate": round(s.get("average_heart_rate", 0), 1),
            "avgRespRate": round(s.get("average_breath", 0), 1),
            "avgBedTempC": round(bed_temp, 1),
            "avgRoomTempC": round(21.0 + temp_dev * 0.3, 1),
            "tnt": s.get("restless_periods", 0),
            "deepSleepPct": round(deep / total_stages, 3),
            "remSleepPct": round(rem / total_stages, 3),
            "lightSleepPct": round(light / total_stages, 3),
            "awakePct": round(awake / total_stages, 3),
            "totalSleepSeconds": total,
            # Extra Oura-specific fields
            "efficiency": s.get("efficiency", 0),
            "readinessScore": readiness_score,
            "stressLevel": stress_score,
            "stressSummary": stress.get("day_summary", ""),
        })

    return trends


def generate_oura_intervals():
    """Generate interval data from real Oura data in Eight Sleep format."""
    days, sleep_by_day, *_ = load_oura_data()

    intervals = []
    for day in days:
        s = sleep_by_day.get(day, {})

        # Convert Oura HR/HRV timeseries to Eight Sleep format [[timestamp_ms, value], ...]
        hr_items = s.get("heart_rate", {}).get("items", [])
        hrv_items = s.get("hrv", {}).get("items", [])
        breath_items = []  # Oura doesn't provide breath timeseries

        # Oura timeseries: items are values at 5-min intervals from bedtime_start
        bedtime_start = s.get("bedtime_start", "")
        try:
            start_dt = datetime.fromisoformat(bedtime_start.replace("Z", "+00:00"))
            start_ms = int(start_dt.timestamp() * 1000)
        except (ValueError, AttributeError):
            start_ms = 0

        hr_ts = []
        for i, val in enumerate(hr_items):
            if val is not None:
                hr_ts.append([start_ms + i * 300000, val])  # 5-min intervals

        hrv_ts = []
        for i, val in enumerate(hrv_items):
            if val is not None:
                hrv_ts.append([start_ms + i * 300000, val])

        # Sleep stages from sleep_phase_5_min
        phases = s.get("sleep_phase_5_min", "") or ""
        stages = []
        stage_map = {"1": "deep", "2": "light", "3": "rem", "4": "awake"}
        current_stage = None
        current_duration = 0
        for char in phases:
            stage_name = stage_map.get(char, "awake")
            if stage_name == current_stage:
                current_duration += 300  # 5-min blocks
            else:
                if current_stage:
                    stages.append({"stage": current_stage, "duration": current_duration})
                current_stage = stage_name
                current_duration = 300
        if current_stage:
            stages.append({"stage": current_stage, "duration": current_duration})

        temp_dev = 0  # Will be filled from readiness if available

        intervals.append({
            "ts": bedtime_start,
            "score": s.get("readiness", {}).get("score", 0) if "readiness" in s else 0,
            "incomplete": False,
            "stages": stages,
            "heartRate": hr_ts,
            "respiratoryRate": [[start_ms + i * 300000, s.get("average_breath", 14)] for i in range(len(hr_items)) if hr_items[i] is not None],
            "tempBedC": [[start_ms + i * 300000, 27.5 + temp_dev] for i in range(min(10, len(hr_items)))],
            "tempRoomC": [[start_ms + i * 300000, 21.0] for i in range(min(10, len(hr_items)))],
            "tnt": s.get("restless_periods", 0),
            "hrv": s.get("average_hrv", 0),
        })

    return intervals


def generate_oura_current():
    """Generate current night data from latest Oura session."""
    days, sleep_by_day, *_ = load_oura_data()

    if not days:
        return {"sleepStage": "unknown", "heartRate": 0, "respiratoryRate": 0,
                "bedTempC": 27.5, "roomTempC": 21.0, "heatingLevel": 0,
                "bedPresence": False, "sessionProcessing": False}

    latest = sleep_by_day.get(days[-1], {})

    return {
        "sleepStage": "light",  # Approximate from latest data
        "heartRate": latest.get("average_heart_rate", 60),
        "respiratoryRate": latest.get("average_breath", 14),
        "bedTempC": 27.5,
        "roomTempC": 21.0,
        "heatingLevel": 0,
        "bedPresence": True,
        "sessionProcessing": False,
    }


# Check if real Oura data exists
def has_oura_data():
    return os.path.exists(os.path.join(DATA_DIR, "sleep.json"))


# Generate data
if has_oura_data():
    OURA_TRENDS = generate_oura_trends()
    OURA_INTERVALS = generate_oura_intervals()
    OURA_CURRENT = generate_oura_current()
else:
    OURA_TRENDS = []
    OURA_INTERVALS = []
    OURA_CURRENT = {}
