"""
Oura Ring API — serves REAL biometric data from Omar's Oura Ring.
All data loaded from scripts/oura_data/ JSON exports.
"""

import json
import os
from fastapi import APIRouter

router = APIRouter()

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


# Pre-load all data at startup
SLEEP_SESSIONS = _load("sleep.json")
DAILY_SLEEP = _load("daily_sleep.json")
DAILY_READINESS = _load("daily_readiness.json")
DAILY_STRESS = _load("daily_stress.json")
DAILY_ACTIVITY = _load("daily_activity.json")
DAILY_RESILIENCE = _load("daily_resilience.json")
DAILY_SPO2 = _load("daily_spo2.json")
WORKOUTS = _load("workouts.json")
HEARTRATE = _load("heartrate.json")

# Build lookups
_sleep_by_day = {}
for s in SLEEP_SESSIONS:
    if s.get("type") == "long_sleep" or s["day"] not in _sleep_by_day:
        _sleep_by_day[s["day"]] = s

_score_by_day = {d["day"]: d.get("score", 0) for d in DAILY_SLEEP}
_readiness_by_day = {d["day"]: d for d in DAILY_READINESS}
_stress_by_day = {d["day"]: d for d in DAILY_STRESS}
_activity_by_day = {d["day"]: d for d in DAILY_ACTIVITY}
_resilience_by_day = {d["day"]: d for d in DAILY_RESILIENCE}
_spo2_by_day = {d["day"]: d for d in DAILY_SPO2}

print(f"[Oura API] Loaded: {len(SLEEP_SESSIONS)} sleep sessions, "
      f"{len(DAILY_SLEEP)} daily scores, {len(WORKOUTS)} workouts, "
      f"{len(HEARTRATE)} HR readings")


@router.get("/sleep-history")
def get_sleep_history():
    """Full sleep history with all metrics per day."""
    days = sorted(_sleep_by_day.keys())
    data = []
    for day in days:
        s = _sleep_by_day[day]
        score = _score_by_day.get(day, 0)
        readiness = _readiness_by_day.get(day, {})
        stress = _stress_by_day.get(day, {})
        activity = _activity_by_day.get(day, {})
        resilience = _resilience_by_day.get(day, {})
        spo2 = _spo2_by_day.get(day, {})

        total = s.get("total_sleep_duration", 0)
        deep = s.get("deep_sleep_duration", 0)
        rem = s.get("rem_sleep_duration", 0)
        light = s.get("light_sleep_duration", 0)
        awake = s.get("awake_time", 0)
        total_stages = deep + rem + light + awake if (deep + rem + light + awake) > 0 else 1

        stress_high = stress.get("stress_high", 0) or 0

        data.append({
            "day": day,
            "sleepScore": score,
            "hrv": s.get("average_hrv", 0),
            "avgHeartRate": round(s.get("average_heart_rate", 0), 1),
            "avgRespRate": round(s.get("average_breath", 0), 1),
            "lowestHeartRate": s.get("lowest_heart_rate", 0),
            "deepSleepPct": round(deep / total_stages, 3),
            "remSleepPct": round(rem / total_stages, 3),
            "lightSleepPct": round(light / total_stages, 3),
            "awakePct": round(awake / total_stages, 3),
            "deepSleepMin": round(deep / 60),
            "remSleepMin": round(rem / 60),
            "lightSleepMin": round(light / 60),
            "awakeMin": round(awake / 60),
            "totalSleepSeconds": total,
            "totalSleepHours": round(total / 3600, 1),
            "efficiency": s.get("efficiency", 0),
            "latency": s.get("latency", 0),
            "tnt": s.get("restless_periods", 0),
            "readinessScore": readiness.get("score", 0),
            "temperatureDeviation": readiness.get("temperature_deviation", 0),
            "stressHigh": stress_high,
            "stressMin": round(stress_high / 60),
            "recoveryHigh": stress.get("recovery_high", 0) or 0,
            "stressSummary": stress.get("day_summary", ""),
            "resilienceLevel": resilience.get("level", "") if isinstance(resilience, dict) else "",
            "spo2Avg": spo2.get("spo2_percentage", {}).get("average", 0) if isinstance(spo2.get("spo2_percentage"), dict) else 0,
            "activityScore": activity.get("score", 0),
            "steps": activity.get("steps", 0),
            "activeCalories": activity.get("active_calories", 0),
            "bedtimeStart": s.get("bedtime_start", ""),
            "bedtimeEnd": s.get("bedtime_end", ""),
        })

    return {"data": data, "totalDays": len(data)}


@router.get("/stats")
def get_stats():
    """Aggregate stats across full history."""
    days = sorted(_sleep_by_day.keys())
    if not days:
        return {"error": "No data"}

    scores = [_score_by_day.get(d, 0) for d in days if _score_by_day.get(d)]
    hrvs = [_sleep_by_day[d].get("average_hrv", 0) for d in days if _sleep_by_day[d].get("average_hrv")]
    hrs = [_sleep_by_day[d].get("average_heart_rate", 0) for d in days if _sleep_by_day[d].get("average_heart_rate")]
    totals = [_sleep_by_day[d].get("total_sleep_duration", 0) for d in days]
    deeps = []
    for d in days:
        s = _sleep_by_day[d]
        total_stages = (s.get("deep_sleep_duration", 0) + s.get("rem_sleep_duration", 0) +
                        s.get("light_sleep_duration", 0) + s.get("awake_time", 0))
        if total_stages > 0:
            deeps.append(s.get("deep_sleep_duration", 0) / total_stages)

    stress_levels = []
    for d in days:
        st = _stress_by_day.get(d, {})
        sh = st.get("stress_high", 0) or 0
        stress_levels.append(sh)

    readiness_scores = [_readiness_by_day.get(d, {}).get("score", 0) for d in days if _readiness_by_day.get(d, {}).get("score")]

    # Find best/worst days
    best_idx = scores.index(max(scores)) if scores else 0
    worst_idx = scores.index(min(scores)) if scores else 0

    avg = lambda lst: round(sum(lst) / len(lst), 1) if lst else 0

    return {
        "totalDays": len(days),
        "dateRange": {"start": days[0], "end": days[-1]},
        "avgSleepScore": avg(scores),
        "avgHRV": avg(hrvs),
        "avgHeartRate": avg(hrs),
        "avgDeepPct": round(avg(deeps) * 100, 1),
        "avgSleepHours": round(avg(totals) / 3600, 1),
        "avgReadiness": avg(readiness_scores),
        "avgStressMin": round(avg(stress_levels) / 60),
        "totalWorkouts": len(WORKOUTS),
        "bestDay": {"day": days[best_idx] if scores else "", "score": max(scores) if scores else 0},
        "worstDay": {"day": days[worst_idx] if scores else "", "score": min(scores) if scores else 0},
        "totalSleepSessions": len(SLEEP_SESSIONS),
    }


@router.get("/workouts")
def get_workouts():
    """Workout history."""
    data = []
    for w in WORKOUTS:
        data.append({
            "day": w.get("day", ""),
            "activity": w.get("activity", "unknown"),
            "calories": w.get("calories", 0),
            "duration": round(w.get("duration", 0) / 60) if w.get("duration") else 0,
            "distance": round(w.get("distance", 0) / 1000, 1) if w.get("distance") else 0,
            "intensity": w.get("intensity", ""),
            "avgHeartRate": w.get("average_heart_rate", 0),
            "maxHeartRate": w.get("max_heart_rate", 0),
            "source": w.get("source", ""),
        })
    return {"data": sorted(data, key=lambda x: x["day"], reverse=True)}


@router.get("/stress-detail")
def get_stress_detail():
    """Detailed stress data for stress analysis page."""
    days = sorted(_stress_by_day.keys())
    data = []
    for day in days:
        st = _stress_by_day[day]
        readiness = _readiness_by_day.get(day, {})
        sleep = _sleep_by_day.get(day, {})

        data.append({
            "day": day,
            "stressHigh": st.get("stress_high", 0) or 0,
            "stressMin": round((st.get("stress_high", 0) or 0) / 60),
            "recoveryHigh": st.get("recovery_high", 0) or 0,
            "recoveryMin": round((st.get("recovery_high", 0) or 0) / 60),
            "summary": st.get("day_summary", ""),
            "readinessScore": readiness.get("score", 0),
            "hrv": sleep.get("average_hrv", 0) if sleep else 0,
            "sleepScore": _score_by_day.get(day, 0),
        })
    return {"data": data}


@router.get("/heart-rate-detail")
def get_heart_rate_detail():
    """Heart rate readings — aggregated by day for charting."""
    # Group HR by day
    hr_by_day = {}
    for reading in HEARTRATE:
        ts = reading.get("timestamp", "")[:10]
        bpm = reading.get("bpm", 0)
        source = reading.get("source", "")
        if ts and bpm and source == "rest":
            if ts not in hr_by_day:
                hr_by_day[ts] = []
            hr_by_day[ts].append(bpm)

    data = []
    for day in sorted(hr_by_day.keys()):
        readings = hr_by_day[day]
        data.append({
            "day": day,
            "avgBpm": round(sum(readings) / len(readings), 1),
            "minBpm": min(readings),
            "maxBpm": max(readings),
            "readings": len(readings),
        })
    return {"data": data}
