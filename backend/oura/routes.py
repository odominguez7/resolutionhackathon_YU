"""
Oura Ring API — serves REAL biometric data from Omar's Oura Ring.
All data loaded from scripts/oura_data/ JSON exports.
Webhooks push real-time updates from Oura cloud.
"""

import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Request

BOSTON_TZ = ZoneInfo("America/New_York")

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
CARDIO_AGE = _load("daily_cardiovascular_age.json")
VO2_MAX = _load("vo2_max.json")
TAGS = _load("tags.json")

# Build lookups
_sleep_by_day = {}
for s in SLEEP_SESSIONS:
    if s.get("type") == "long_sleep" or s["day"] not in _sleep_by_day:
        _sleep_by_day[s["day"]] = s

_score_by_day = {d["day"]: d.get("score", 0) for d in DAILY_SLEEP}
_daily_sleep_by_day = {d["day"]: d for d in DAILY_SLEEP}
_readiness_by_day = {d["day"]: d for d in DAILY_READINESS}
_stress_by_day = {d["day"]: d for d in DAILY_STRESS}
_activity_by_day = {d["day"]: d for d in DAILY_ACTIVITY}
_resilience_by_day = {d["day"]: d for d in DAILY_RESILIENCE}
_spo2_by_day = {d["day"]: d for d in DAILY_SPO2}

_cardio_by_day = {d["day"]: d for d in CARDIO_AGE}
_tags_by_day = {}
for t in TAGS:
    day = t.get("day", t.get("timestamp", "")[:10])
    if day not in _tags_by_day:
        _tags_by_day[day] = []
    _tags_by_day[day].append(t)

print(f"[Oura API] Loaded: {len(SLEEP_SESSIONS)} sleep sessions, "
      f"{len(DAILY_SLEEP)} daily scores, {len(WORKOUTS)} workouts, "
      f"{len(HEARTRATE)} HR readings, {len(CARDIO_AGE)} cardio age, "
      f"{len(TAGS)} tags")


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
        cardio = _cardio_by_day.get(day, {})

        total = s.get("total_sleep_duration", 0)
        deep = s.get("deep_sleep_duration", 0)
        rem = s.get("rem_sleep_duration", 0)
        light = s.get("light_sleep_duration", 0)
        awake = s.get("awake_time", 0)
        total_sleep_stages = deep + rem + light if (deep + rem + light) > 0 else 1
        total_with_awake = deep + rem + light + awake if (deep + rem + light + awake) > 0 else 1

        stress_high = stress.get("stress_high", 0) or 0

        data.append({
            "day": day,
            "sleepScore": score,
            "hrv": s.get("average_hrv", 0),
            "avgHeartRate": round(s.get("average_heart_rate", 0), 1),
            "avgRespRate": round(s.get("average_breath", 0), 1),
            "lowestHeartRate": s.get("lowest_heart_rate", 0),
            "deepSleepPct": round(deep / total_sleep_stages, 3),
            "remSleepPct": round(rem / total_sleep_stages, 3),
            "lightSleepPct": round(light / total_sleep_stages, 3),
            "awakePct": round(awake / total_with_awake, 3),
            "deepSleepMin": round(deep / 60),
            "remSleepMin": round(rem / 60),
            "lightSleepMin": round(light / 60),
            "awakeMin": round(awake / 60),
            "totalSleepSeconds": total,
            "totalSleepHours": round(total / 3600, 1),
            "efficiency": s.get("efficiency", 0),
            "latency": round(s.get("latency", 0) / 60, 1),
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
            "vascularAge": cardio.get("vascular_age", None),
            "bedtimeStart": s.get("bedtime_start", ""),
            "bedtimeEnd": s.get("bedtime_end", ""),
            # Contributors (from daily_sleep, daily_readiness, daily_activity)
            "sleepContributors": _daily_sleep_by_day.get(day, {}).get("contributors"),
            "readinessContributors": readiness.get("contributors"),
            "activityContributors": activity.get("contributors"),
            "resilienceContributors": resilience.get("contributors") if isinstance(resilience, dict) else None,
            "breathingDisturbanceIndex": spo2.get("breathing_disturbance_index"),
            "temperatureTrendDeviation": readiness.get("temperature_trend_deviation"),
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
        "latestVascularAge": CARDIO_AGE[-1].get("vascular_age") if CARDIO_AGE else None,
        "totalCardioAgeDays": len(CARDIO_AGE),
        "totalTags": len(TAGS),
        "age": _load_age(),
    }


def _load_age():
    """Load age from personal_info.json."""
    import json as _json
    path = os.path.join(DATA_DIR, "personal_info.json")
    if os.path.exists(path):
        with open(path) as f:
            data = _json.load(f)
            return data.get("age", 36) if isinstance(data, dict) else 36
    return 36


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


# Manual override for today's scores when Oura cloud API lags behind the app
_today_override: dict = {}


@router.post("/today/override")
async def override_today(request: Request):
    """Set today's scores manually from what the Oura app shows.
    Example: POST /api/oura/today/override {"sleepScore":88,"readinessScore":78,"stressMin":75}
    """
    global _today_override
    body = await request.json()
    from datetime import datetime
    from zoneinfo import ZoneInfo
    body["day"] = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    _today_override = body
    print(f"[Oura] Today override set: {body}")
    return {"status": "ok", "override": body}


@router.delete("/today/override")
def clear_override():
    """Clear manual override, go back to API data."""
    global _today_override
    _today_override = {}
    return {"status": "ok", "message": "Override cleared"}


@router.get("/today")
async def get_today():
    """
    Freshest available scores — always tries the live Oura API first.

    Data availability in the Oura ecosystem:
    - Sleep score, HRV, avg HR  → computed from last night's session, tagged as yesterday's date.
                                   These are "last night" metrics by nature.
    - Readiness                 → available for today once ring syncs after waking.
    - Stress                    → accumulates throughout the day, available for today.
    - Activity (steps, cals)    → accumulates throughout the day, available for today.
    - Heart rate                → real-time when ring is on and synced.
    - SpO2                      → measured overnight, tagged as yesterday.
    - Vascular age              → updated daily, may lag 1 day.

    Strategy: fetch the last 2 days from the live API for each metric,
    then pick the most recent available record. Return each metric with
    its actual date so the frontend knows exactly what it's showing.
    """
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from .live import has_live_token, fetch_oura

    # If manual override is set, merge it on top of API data
    # (override individual fields, not the whole response)
    override = _today_override

    boston_tz = ZoneInfo("America/New_York")
    now = datetime.now(boston_tz)
    today_str = now.strftime("%Y-%m-%d")
    yesterday_str = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")

    # ── Try live API first for the freshest 2 days ──
    live_sleep_scores = {}
    live_readiness = {}
    live_stress = {}
    live_activity = {}
    live_sleep_sessions = {}

    if has_live_token():
        try:
            params = {"start_date": yesterday_str, "end_date": tomorrow_str}

            raw_daily_sleep = await fetch_oura("/v2/usercollection/daily_sleep", params)
            for d in raw_daily_sleep:
                live_sleep_scores[d["day"]] = d.get("score", 0)

            raw_readiness = await fetch_oura("/v2/usercollection/daily_readiness", params)
            for d in raw_readiness:
                live_readiness[d["day"]] = d

            raw_stress = await fetch_oura("/v2/usercollection/daily_stress", params)
            for d in raw_stress:
                live_stress[d["day"]] = d

            raw_activity = await fetch_oura("/v2/usercollection/daily_activity", params)
            for d in raw_activity:
                live_activity[d["day"]] = d

            raw_sleep = await fetch_oura("/v2/usercollection/sleep", params)
            for s in raw_sleep:
                if s.get("type") == "long_sleep" or s["day"] not in live_sleep_sessions:
                    live_sleep_sessions[s["day"]] = s

        except Exception as e:
            print(f"[Oura Today] Live API fetch failed: {e}")

    # ── Helper: pick freshest value, preferring live API, then in-memory cache ──
    def pick(live_dict: dict, cache_dict: dict):
        """Return (value, day) for today first, then yesterday, from live then cache."""
        for day in [today_str, yesterday_str]:
            if day in live_dict:
                return live_dict[day], day
        for day in [today_str, yesterday_str]:
            if day in cache_dict:
                return cache_dict[day], day
        # Last resort: most recent in cache
        if cache_dict:
            best_day = max(cache_dict.keys())
            return cache_dict[best_day], best_day
        return None, None

    # ── Sleep score (last night's sleep, tagged as yesterday) ──
    sleep_score_val, sleep_day = pick(live_sleep_scores, _score_by_day)

    # ── Readiness (available for today once ring syncs) ──
    readiness_val, readiness_day = pick(live_readiness, _readiness_by_day)

    # ── Stress (accumulates throughout today) ──
    stress_val, stress_day = pick(live_stress, _stress_by_day)

    # ── Activity (accumulates throughout today) ──
    activity_val, activity_day = pick(live_activity, _activity_by_day)

    # ── HRV + avg HR (always from most recent sleep session — "last night") ──
    hrv_value = None
    avg_hr_value = None
    hrv_day = None
    # Check live sleep sessions first
    for day in [today_str, yesterday_str]:
        session = live_sleep_sessions.get(day)
        if session and session.get("average_hrv"):
            hrv_value = session["average_hrv"]
            avg_hr_value = session.get("average_heart_rate")
            hrv_day = day
            break
    # Fallback to cached sessions
    if hrv_value is None and _sleep_by_day:
        for day in sorted(_sleep_by_day.keys(), reverse=True):
            session = _sleep_by_day[day]
            if session.get("average_hrv"):
                hrv_value = session["average_hrv"]
                avg_hr_value = session.get("average_heart_rate")
                hrv_day = day
                break

    # ── Live heart rate ──
    latest_hr = None
    latest_hr_time = None
    latest_hr_source = None

    if has_live_token():
        try:
            start_dt = (now - timedelta(hours=12)).isoformat()
            end_dt = now.isoformat()
            live_hr = await fetch_oura(
                "/v2/usercollection/heartrate",
                {"start_datetime": start_dt, "end_datetime": end_dt}
            )
            if live_hr:
                last_reading = live_hr[-1]
                latest_hr = last_reading.get("bpm")
                latest_hr_time = last_reading.get("timestamp")
                latest_hr_source = last_reading.get("source", "")
        except Exception as e:
            print(f"[Oura Today] Live HR fetch failed: {e}")

    if latest_hr is None:
        for reading in reversed(HEARTRATE):
            if reading.get("bpm"):
                latest_hr = reading["bpm"]
                latest_hr_time = reading["timestamp"]
                latest_hr_source = reading.get("source", "")
                break

    # ── SpO2 (overnight measurement, usually tagged yesterday) ──
    spo2_avg = None
    spo2_day = None
    for day in [today_str, yesterday_str]:
        entry = _spo2_by_day.get(day, {})
        sp = entry.get("spo2_percentage", {})
        if isinstance(sp, dict) and sp.get("average"):
            spo2_avg = sp["average"]
            spo2_day = day
            break

    # ── Vascular age ──
    vasc_age = None
    for day in [today_str, yesterday_str]:
        entry = _cardio_by_day.get(day, {})
        if entry.get("vascular_age"):
            vasc_age = entry["vascular_age"]
            break
    if vasc_age is None and _cardio_by_day:
        best = max(_cardio_by_day.keys())
        vasc_age = _cardio_by_day[best].get("vascular_age")

    # ── Unpack readiness/stress/activity from their dicts ──
    readiness_obj = readiness_val if isinstance(readiness_val, dict) else {}
    stress_obj = stress_val if isinstance(stress_val, dict) else {}
    activity_obj = activity_val if isinstance(activity_val, dict) else {}

    result = {
        # Each metric carries its own date so the frontend knows the source
        "day": today_str,
        "sleepScore": sleep_score_val if not isinstance(sleep_score_val, dict) else sleep_score_val.get("score"),
        "sleepDay": sleep_day,
        "readinessScore": readiness_obj.get("score"),
        "readinessDay": readiness_day,
        "temperatureDeviation": readiness_obj.get("temperature_deviation"),
        "activityScore": activity_obj.get("score"),
        "activityDay": activity_day,
        "steps": activity_obj.get("steps", 0),
        "activeCalories": activity_obj.get("active_calories", 0),
        "stressHigh": stress_obj.get("stress_high"),
        "stressMin": round((stress_obj.get("stress_high", 0) or 0) / 60),
        "stressDay": stress_day,
        "stressSummary": stress_obj.get("day_summary"),
        "hrv": hrv_value,
        "hrvDay": hrv_day,
        "avgHeartRate": avg_hr_value,
        "latestHeartRate": latest_hr,
        "latestHeartRateTime": latest_hr_time,
        "latestHRSource": latest_hr_source,
        "spo2Avg": spo2_avg,
        "vascularAge": vasc_age,
    }

    # Apply manual override on top
    if override:
        for key in override:
            if key in result:
                result[key] = override[key]
        result["day"] = override.get("day", today_str)
        result["overridden"] = True

    return result


@router.get("/contributors")
def get_contributors():
    """
    Latest sleep, readiness, and activity contributor breakdowns.
    Returns the most recent day that has contributor data.
    """
    from datetime import datetime
    from zoneinfo import ZoneInfo
    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")

    # Find most recent day with data
    days_with_data = sorted(set(
        list(_daily_sleep_by_day.keys()) +
        list(_readiness_by_day.keys()) +
        list(_activity_by_day.keys())
    ), reverse=True)

    result = {"day": None, "sleep": None, "readiness": None, "activity": None,
              "resilience": None, "spo2": None, "sleepTime": None}

    for day in days_with_data:
        ds = _daily_sleep_by_day.get(day, {})
        if ds.get("contributors"):
            result["day"] = day
            result["sleep"] = {
                "score": ds.get("score"),
                "contributors": ds["contributors"],
            }
            break

    for day in days_with_data:
        rd = _readiness_by_day.get(day, {})
        if rd.get("contributors"):
            if result["day"] is None:
                result["day"] = day
            result["readiness"] = {
                "score": rd.get("score"),
                "temperatureDeviation": rd.get("temperature_deviation"),
                "temperatureTrendDeviation": rd.get("temperature_trend_deviation"),
                "contributors": rd["contributors"],
            }
            break

    for day in days_with_data:
        act = _activity_by_day.get(day, {})
        if act.get("contributors"):
            result["activity"] = {
                "score": act.get("score"),
                "steps": act.get("steps", 0),
                "activeCalories": act.get("active_calories", 0),
                "totalCalories": act.get("total_calories", 0),
                "contributors": act["contributors"],
            }
            break

    # Resilience contributors
    for day in days_with_data:
        res = _resilience_by_day.get(day, {})
        if isinstance(res, dict) and res.get("contributors"):
            result["resilience"] = {
                "level": res.get("level"),
                "contributors": res["contributors"],
            }
            break

    # SpO2 with breathing disturbance index
    for day in days_with_data:
        sp = _spo2_by_day.get(day, {})
        spo2_pct = sp.get("spo2_percentage", {})
        if isinstance(spo2_pct, dict) and spo2_pct.get("average"):
            result["spo2"] = {
                "average": spo2_pct["average"],
                "breathingDisturbanceIndex": sp.get("breathing_disturbance_index"),
            }
            break

    # Sleep time recommendation
    sleep_times = _load("sleep_time.json")
    if sleep_times:
        latest = sorted(sleep_times, key=lambda x: x.get("day", ""))[-1]
        result["sleepTime"] = {
            "day": latest.get("day"),
            "recommendation": latest.get("recommendation"),
            "status": latest.get("status"),
            "optimalBedtime": latest.get("optimal_bedtime"),
        }

    return result


@router.get("/cardiovascular-age")
def get_cardiovascular_age():
    """Cardiovascular/vascular age history."""
    data = []
    for d in sorted(CARDIO_AGE, key=lambda x: x.get("day", "")):
        data.append({
            "day": d.get("day", ""),
            "vascularAge": d.get("vascular_age", 0),
        })
    return {"data": data, "totalDays": len(data)}


@router.get("/tags")
def get_tags():
    """User tags/annotations."""
    return {"data": TAGS, "total": len(TAGS)}


@router.get("/refresh")
async def refresh_from_oura():
    """Pull fresh data from Oura API and update ALL in-memory stores."""
    from .live import (
        has_live_token, fetch_sleep_live, fetch_daily_sleep_live,
        fetch_daily_stress_live, fetch_daily_readiness_live, fetch_workouts_live,
        fetch_daily_activity_live, fetch_daily_resilience_live,
        fetch_daily_spo2_live, fetch_heartrate_live, fetch_cardiovascular_age_live,
    )

    if not has_live_token():
        return {"status": "error", "message": "No Oura token configured"}

    global SLEEP_SESSIONS, DAILY_SLEEP, DAILY_READINESS, DAILY_STRESS, WORKOUTS
    global DAILY_ACTIVITY, DAILY_RESILIENCE, DAILY_SPO2, HEARTRATE, CARDIO_AGE
    global _sleep_by_day, _score_by_day, _daily_sleep_by_day, _readiness_by_day, _stress_by_day
    global _activity_by_day, _resilience_by_day, _spo2_by_day, _cardio_by_day

    sleep = await fetch_sleep_live()
    daily_sleep = await fetch_daily_sleep_live()
    daily_stress = await fetch_daily_stress_live()
    daily_readiness = await fetch_daily_readiness_live()
    workouts = await fetch_workouts_live()
    daily_activity = await fetch_daily_activity_live()
    daily_resilience = await fetch_daily_resilience_live()
    daily_spo2 = await fetch_daily_spo2_live()
    heartrate = await fetch_heartrate_live()
    cardio_age = await fetch_cardiovascular_age_live()

    if sleep:
        SLEEP_SESSIONS = sleep
        _sleep_by_day.clear()
        for s in sleep:
            if s.get("type") == "long_sleep" or s["day"] not in _sleep_by_day:
                _sleep_by_day[s["day"]] = s

    if daily_sleep:
        DAILY_SLEEP = daily_sleep
        _score_by_day.clear()
        _score_by_day.update({d["day"]: d.get("score", 0) for d in daily_sleep})
        _daily_sleep_by_day.clear()
        _daily_sleep_by_day.update({d["day"]: d for d in daily_sleep})

    if daily_stress:
        DAILY_STRESS = daily_stress
        _stress_by_day.clear()
        _stress_by_day.update({d["day"]: d for d in daily_stress})

    if daily_readiness:
        DAILY_READINESS = daily_readiness
        _readiness_by_day.clear()
        _readiness_by_day.update({d["day"]: d for d in daily_readiness})

    if workouts:
        WORKOUTS = workouts

    if daily_activity:
        DAILY_ACTIVITY = daily_activity
        _activity_by_day.clear()
        _activity_by_day.update({d["day"]: d for d in daily_activity})

    if daily_resilience:
        DAILY_RESILIENCE = daily_resilience
        _resilience_by_day.clear()
        _resilience_by_day.update({d["day"]: d for d in daily_resilience})

    if daily_spo2:
        DAILY_SPO2 = daily_spo2
        _spo2_by_day.clear()
        _spo2_by_day.update({d["day"]: d for d in daily_spo2})

    if heartrate:
        HEARTRATE = heartrate

    if cardio_age:
        CARDIO_AGE = cardio_age
        _cardio_by_day.clear()
        _cardio_by_day.update({d["day"]: d for d in cardio_age})

    return {
        "status": "ok",
        "refreshed": {
            "sleep_sessions": len(SLEEP_SESSIONS),
            "daily_scores": len(DAILY_SLEEP),
            "stress_days": len(DAILY_STRESS),
            "readiness_days": len(DAILY_READINESS),
            "workouts": len(WORKOUTS),
            "activity_days": len(DAILY_ACTIVITY),
            "resilience_days": len(DAILY_RESILIENCE),
            "spo2_days": len(DAILY_SPO2),
            "hr_readings": len(HEARTRATE),
            "cardio_age_days": len(CARDIO_AGE),
        },
        "message": "All Oura data refreshed from live API",
    }


# ── Oura Webhooks ──────────────────────────────────────────────────────

WEBHOOK_VERIFICATION_TOKEN = "yu-restos-oura-2026"

@router.post("/webhook")
async def oura_webhook(request: Request):
    """
    Receive real-time push notifications from Oura when new data is available.
    Oura sends: { event_type, data_type, object_id, ... }
    On receiving a notification, we fetch the updated record from the live API
    and update our in-memory stores immediately.
    """
    from .live import has_live_token, fetch_oura

    body = await request.json()
    event_type = body.get("event_type")  # create | update | delete
    data_type = body.get("data_type")    # daily_sleep | daily_readiness | etc.

    print(f"[Oura Webhook] {event_type} {data_type}")

    if event_type in ("create", "update") and has_live_token():
        # Fetch the last 2 days of the relevant data type to catch today
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        boston_tz = ZoneInfo("America/New_York")
        now = datetime.now(boston_tz)
        start = (now - timedelta(days=2)).strftime("%Y-%m-%d")
        end = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        params = {"start_date": start, "end_date": end}

        if data_type == "daily_sleep":
            records = await fetch_oura("/v2/usercollection/daily_sleep", params)
            for d in records:
                _score_by_day[d["day"]] = d.get("score", 0)
            print(f"[Oura Webhook] Updated sleep scores: {[d['day'] for d in records]}")

        elif data_type == "daily_readiness":
            records = await fetch_oura("/v2/usercollection/daily_readiness", params)
            for d in records:
                _readiness_by_day[d["day"]] = d
            print(f"[Oura Webhook] Updated readiness: {[d['day'] for d in records]}")

        elif data_type == "daily_stress":
            records = await fetch_oura("/v2/usercollection/daily_stress", params)
            for d in records:
                _stress_by_day[d["day"]] = d
            print(f"[Oura Webhook] Updated stress: {[d['day'] for d in records]}")

        elif data_type == "daily_activity":
            records = await fetch_oura("/v2/usercollection/daily_activity", params)
            for d in records:
                _activity_by_day[d["day"]] = d
            print(f"[Oura Webhook] Updated activity: {[d['day'] for d in records]}")

        elif data_type == "sleep":
            records = await fetch_oura("/v2/usercollection/sleep", params)
            for s in records:
                if s.get("type") == "long_sleep" or s["day"] not in _sleep_by_day:
                    _sleep_by_day[s["day"]] = s
            print(f"[Oura Webhook] Updated sleep sessions: {[s['day'] for s in records]}")

        elif data_type == "daily_spo2":
            records = await fetch_oura("/v2/usercollection/daily_spo2", params)
            for d in records:
                _spo2_by_day[d["day"]] = d

        elif data_type == "daily_cardiovascular_age":
            records = await fetch_oura("/v2/usercollection/daily_cardiovascular_age", params)
            for d in records:
                _cardio_by_day[d["day"]] = d

    return {"status": "ok"}


@router.get("/webhook/subscribe")
async def subscribe_webhooks():
    """Subscribe to Oura webhooks for real-time data updates."""
    from .live import has_live_token, TOKEN, BASE
    import httpx

    if not has_live_token():
        return {"status": "error", "message": "No Oura token"}

    # You need to expose this via ngrok or similar for Oura to reach it
    # For local dev, set WEBHOOK_URL env var
    callback_base = os.getenv("OURA_WEBHOOK_URL", "http://localhost:8000")
    callback_url = f"{callback_base}/api/oura/webhook"

    data_types = [
        "daily_sleep", "daily_readiness", "daily_stress",
        "daily_activity", "sleep", "daily_spo2", "daily_cardiovascular_age",
    ]
    event_types = ["create", "update"]

    results = []
    async with httpx.AsyncClient(timeout=15) as client:
        for dt in data_types:
            for et in event_types:
                try:
                    resp = await client.post(
                        f"{BASE}/v2/webhook/subscription",
                        headers={"Authorization": f"Bearer {TOKEN}"},
                        json={
                            "callback_url": callback_url,
                            "verification_token": WEBHOOK_VERIFICATION_TOKEN,
                            "event_type": et,
                            "data_type": dt,
                        }
                    )
                    results.append({
                        "data_type": dt, "event_type": et,
                        "status": resp.status_code,
                        "response": resp.json() if resp.status_code < 300 else resp.text,
                    })
                except Exception as e:
                    results.append({"data_type": dt, "event_type": et, "error": str(e)})

    return {"subscriptions": results}


@router.get("/webhook/list")
async def list_webhooks():
    """List active Oura webhook subscriptions."""
    from .live import has_live_token, TOKEN, BASE
    import httpx

    if not has_live_token():
        return {"status": "error", "message": "No Oura token"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BASE}/v2/webhook/subscription",
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        return resp.json()


@router.get("/workout")
async def get_workout(session_type: str = "crossfit"):
    """Generate AI-powered workout based on real biometrics."""
    from .workout_ai import generate_workout
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import statistics

    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")

    # Build biometrics context from real data
    days = sorted(_sleep_by_day.keys())
    last_30_hrvs = [_sleep_by_day[d].get("average_hrv") for d in days[-30:] if _sleep_by_day[d].get("average_hrv")]
    last_30_rhrs = [_sleep_by_day[d].get("average_heart_rate") for d in days[-30:] if _sleep_by_day[d].get("average_heart_rate")]

    # Today or most recent day
    today_score = _score_by_day.get(today_str)
    if today_score is None and _score_by_day:
        latest_day = max(_score_by_day.keys())
    else:
        latest_day = today_str

    sleep_session = _sleep_by_day.get(latest_day, {})
    readiness = _readiness_by_day.get(latest_day, {})
    stress = _stress_by_day.get(latest_day, {})

    # Last 3 days for trend
    last_3 = []
    for d in days[-3:]:
        s = _sleep_by_day[d]
        last_3.append({
            "day": d,
            "sleep_score": _score_by_day.get(d, 0),
            "hrv": s.get("average_hrv"),
            "rhr": round(s.get("average_heart_rate", 0), 1) if s.get("average_heart_rate") else None,
            "readiness": _readiness_by_day.get(d, {}).get("score"),
            "deep_min": round(s.get("deep_sleep_duration", 0) / 60),
            "total_hrs": round(s.get("total_sleep_duration", 0) / 3600, 1),
        })

    # Recovery context
    hrv_val = sleep_session.get("average_hrv")
    hrv_bl = round(statistics.mean(last_30_hrvs), 1) if last_30_hrvs else None
    readiness_score = readiness.get("score", 0)

    if readiness_score > 80 and hrv_val and hrv_bl and hrv_val >= hrv_bl:
        context = "Fully recovered. Push hard today."
    elif readiness_score > 65:
        context = "Decent recovery. Solid work day."
    elif readiness_score > 50:
        context = "Under-recovered. Go easier today."
    else:
        context = "Low recovery. Active recovery only."

    biometrics = {
        "sleep_score": _score_by_day.get(latest_day),
        "readiness": readiness_score,
        "hrv": hrv_val,
        "hrv_baseline": hrv_bl,
        "rhr": round(sleep_session.get("average_heart_rate", 0), 1) if sleep_session.get("average_heart_rate") else None,
        "rhr_baseline": round(statistics.mean(last_30_rhrs), 1) if last_30_rhrs else None,
        "stress_min": round((stress.get("stress_high", 0) or 0) / 60),
        "deep_min": round(sleep_session.get("deep_sleep_duration", 0) / 60),
        "total_sleep_hrs": round(sleep_session.get("total_sleep_duration", 0) / 3600, 1),
        "last_3_days": last_3,
        "recovery_context": context,
    }

    result = await generate_workout(session_type, biometrics)
    return result


@router.get("/workout/log")
def workout_log(days: int = 7):
    """Recent workout log entries with patterns + closed-loop verdicts."""
    from .workout_brain import recent_log
    return {"entries": recent_log(days)}


@router.post("/workout/regenerate")
async def regenerate_workout(payload: dict):
    """User didn't like the previous workout — mark it rejected and produce
    a different combo locked to the same patterns."""
    from .workout_brain import reject_entry, _load_log
    from .workout_ai import generate_workout

    log_id = (payload or {}).get("log_id")
    session_type = (payload or {}).get("session_type", "crossfit")
    if not log_id:
        return {"error": "log_id required"}

    rejected = reject_entry(log_id, reason=(payload or {}).get("reason", "user_rejected"))
    if not rejected:
        return {"error": "log_id not found"}

    # Rebuild biometrics the same way the /workout route does, so the new
    # generation reasons over the same body state.
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import statistics

    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")
    days = sorted(_sleep_by_day.keys())
    last_30_hrvs = [_sleep_by_day[d].get("average_hrv") for d in days[-30:] if _sleep_by_day[d].get("average_hrv")]
    last_30_rhrs = [_sleep_by_day[d].get("average_heart_rate") for d in days[-30:] if _sleep_by_day[d].get("average_heart_rate")]
    latest_day = today_str if today_str in _score_by_day else (max(_score_by_day.keys()) if _score_by_day else today_str)
    sleep_session = _sleep_by_day.get(latest_day, {})
    readiness = _readiness_by_day.get(latest_day, {})
    stress = _stress_by_day.get(latest_day, {})
    last_3 = []
    for d in days[-3:]:
        s = _sleep_by_day[d]
        last_3.append({
            "day": d,
            "sleep_score": _score_by_day.get(d, 0),
            "hrv": s.get("average_hrv"),
            "rhr": round(s.get("average_heart_rate", 0), 1) if s.get("average_heart_rate") else None,
            "readiness": _readiness_by_day.get(d, {}).get("score"),
        })
    biometrics = {
        "sleep_score": _score_by_day.get(latest_day),
        "readiness": readiness.get("score", 0),
        "hrv": sleep_session.get("average_hrv"),
        "hrv_baseline": round(statistics.mean(last_30_hrvs), 1) if last_30_hrvs else None,
        "rhr": round(sleep_session.get("average_heart_rate", 0), 1) if sleep_session.get("average_heart_rate") else None,
        "rhr_baseline": round(statistics.mean(last_30_rhrs), 1) if last_30_rhrs else None,
        "stress_min": round((stress.get("stress_high", 0) or 0) / 60),
        "deep_min": round(sleep_session.get("deep_sleep_duration", 0) / 60),
        "total_sleep_hrs": round(sleep_session.get("total_sleep_duration", 0) / 3600, 1),
        "last_3_days": last_3,
        "recovery_context": "regeneration after user rejected previous combo",
    }

    return await generate_workout(
        session_type,
        biometrics,
        lock_patterns=rejected.get("patterns") or [],
        avoid_movements=rejected.get("movements") or [],
    )


@router.post("/workout/feedback")
def workout_feedback(payload: dict):
    """User feedback on a generated workout: completed, felt, soreness."""
    from .workout_brain import _load_log, _save_log, _upsert_entry
    log = _load_log()
    target_id = (payload or {}).get("log_id")
    for entry in log:
        if entry["id"] == target_id:
            completed = (payload or {}).get("completed", "unknown")
            entry["user_feedback"] = {
                "completed": completed,
                "felt": (payload or {}).get("felt"),
                "soreness": (payload or {}).get("soreness"),
                "notes": (payload or {}).get("notes", ""),
                "recorded_at": datetime.now(BOSTON_TZ).isoformat(),
            }
            _save_log(log)
            _upsert_entry(entry)
            # Update progression ledger with actual completion status
            try:
                from .workout_progression import record_movements
                full = entry.get("full_workout") or {}
                if full:
                    record_movements(full, completed=completed)
            except Exception:
                pass
            return {"saved": True, "entry": entry}
    return {"saved": False, "reason": "log_id not found"}


@router.get("/workout/progression")
def workout_progression():
    """Progressive overload ledger — per-movement load history + next prescribed."""
    from .workout_progression import get_all_progressions
    return {"movements": get_all_progressions()}


@router.get("/workout/adherence")
def workout_adherence():
    """Adherence profile for the last 14 days."""
    from .workout_adherence import build_adherence_profile
    from .workout_brain import recent_log
    return build_adherence_profile(recent_log(14))


@router.get("/workout/today")
def workout_today():
    """Return the most recent non-rejected workout for today, if any.
    Used by the UI to restore the card after a page refresh."""
    from .workout_brain import recent_log
    entries = recent_log(2)
    today = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    todays = [e for e in entries if e.get("day") == today and not e.get("rejected")]
    if not todays:
        return {"workout": None}
    latest = sorted(todays, key=lambda e: e.get("generated_at", ""))[-1]
    return {"workout": latest}


@router.get("/objectives")
def get_objectives():
    """List available analysis objectives."""
    from .insights import OBJECTIVES
    return {"objectives": {k: {"label": v["label"], "description": v["description"]} for k, v in OBJECTIVES.items()}}


@router.get("/insights")
async def get_insights(model: str = "gemini-2.5-flash", objective: str = "peak_performance"):
    """AI-powered analysis of Oura biometric data via Gemini."""
    from .insights import compute_features, analyze_with_gemini, OBJECTIVES

    # Build sleep history in the same format as /sleep-history endpoint
    days = sorted(_sleep_by_day.keys())
    sleep_history = []
    for day in days:
        s = _sleep_by_day[day]
        score = _score_by_day.get(day, 0)
        readiness = _readiness_by_day.get(day, {})
        stress = _stress_by_day.get(day, {})
        activity = _activity_by_day.get(day, {})
        deep = s.get("deep_sleep_duration", 0)
        rem = s.get("rem_sleep_duration", 0)
        total = s.get("total_sleep_duration", 0)
        stress_high = stress.get("stress_high", 0) or 0

        sleep_history.append({
            "day": day,
            "sleepScore": score,
            "hrv": s.get("average_hrv", 0),
            "avgHeartRate": round(s.get("average_heart_rate", 0), 1),
            "deepSleepMin": round(deep / 60),
            "remSleepMin": round(rem / 60),
            "totalSleepHours": round(total / 3600, 1),
            "efficiency": s.get("efficiency", 0),
            "readinessScore": readiness.get("score", 0),
            "stressMin": round(stress_high / 60),
            "steps": activity.get("steps", 0),
        })

    # Get today's data
    from datetime import datetime
    from zoneinfo import ZoneInfo
    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")
    today_data = {
        "sleepScore": _score_by_day.get(today_str),
        "readinessScore": _readiness_by_day.get(today_str, {}).get("score"),
        "hrv": _sleep_by_day.get(today_str, {}).get("average_hrv"),
        "latestHeartRate": None,
        "stressMin": round((_stress_by_day.get(today_str, {}).get("stress_high", 0) or 0) / 60),
        "steps": _activity_by_day.get(today_str, {}).get("steps", 0),
        "spo2Avg": _spo2_by_day.get(today_str, {}).get("spo2_percentage", {}).get("average")
            if isinstance(_spo2_by_day.get(today_str, {}).get("spo2_percentage"), dict) else None,
    }

    features = compute_features(sleep_history, [], today_data)
    result = await analyze_with_gemini(features, model=model, objective=objective)
    return result


@router.get("/status")
def oura_status():
    """Check Oura data status."""
    from .live import has_live_token
    return {
        "has_data": len(SLEEP_SESSIONS) > 0,
        "has_live_token": has_live_token(),
        "total_days": len(_sleep_by_day),
        "total_sleep_sessions": len(SLEEP_SESSIONS),
        "total_workouts": len(WORKOUTS),
        "source": "live" if has_live_token() else "exported",
    }


# ── Oura OAuth2 ─────────────────────────────────────────────────────

OURA_CLIENT_ID = os.getenv("OURA_CLIENT_ID", "")
OURA_CLIENT_SECRET = os.getenv("OURA_CLIENT_SECRET", "")

@router.get("/oauth/authorize")
def oura_oauth_start(request: Request):
    """Redirect to Oura authorization page."""
    if not OURA_CLIENT_ID:
        return {"error": "OURA_CLIENT_ID not configured"}
    # Build redirect URI — force https (Cloud Run is behind a proxy that reports http)
    base = str(request.base_url).rstrip("/").replace("http://", "https://")
    redirect_uri = os.getenv("OURA_REDIRECT_URI", f"{base}/api/oura/oauth/callback")
    from urllib.parse import quote
    scope = "email personal daily heartrate workout tag session spo2 ring_configuration stress heart_health"
    auth_url = (
        f"https://cloud.ouraring.com/oauth/authorize"
        f"?client_id={OURA_CLIENT_ID}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
        f"&response_type=code"
        f"&scope={quote(scope)}"
        f"&state=yu-restos"
    )
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=auth_url)


@router.get("/oauth/callback")
async def oura_oauth_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """Exchange auth code for access token, store it, and refresh data."""
    import httpx as _httpx
    if error:
        return {"error": f"Oura denied access: {error}"}
    if not code:
        return {"error": "No authorization code received"}
    if not OURA_CLIENT_ID or not OURA_CLIENT_SECRET:
        return {"error": "Oura OAuth credentials not configured"}

    base = str(request.base_url).rstrip("/").replace("http://", "https://")
    redirect_uri = os.getenv("OURA_REDIRECT_URI", f"{base}/api/oura/oauth/callback")

    async with _httpx.AsyncClient(timeout=15) as client:
        resp = await client.post("https://api.ouraring.com/oauth/token", data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": OURA_CLIENT_ID,
            "client_secret": OURA_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
        })

    if resp.status_code != 200:
        return {"error": f"Token exchange failed: {resp.status_code}", "detail": resp.text}

    token_data = resp.json()
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")

    if not access_token:
        return {"error": "No access token in response", "data": token_data}

    # Update live.py's token in memory
    from . import live
    live.TOKEN = access_token
    live.HEADERS = {"Authorization": f"Bearer {access_token}"}

    # Save refresh token in memory
    if refresh_token:
        live.REFRESH_TOKEN = refresh_token

    # Auto-refresh all data with the new token
    result = await refresh_from_oura()

    from fastapi.responses import HTMLResponse
    return HTMLResponse(f"""
    <html><body style="background:#050816;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
    <h1 style="color:#4ADE80">Oura Connected</h1>
    <p>Access token received. Data refreshed: {result.get('refreshed', {}).get('sleep_sessions', 0)} sleep sessions, {result.get('refreshed', {}).get('daily_scores', 0)} daily scores.</p>
    <p style="color:#94A3B8;font-size:12px;margin-top:20px">To persist across deploys, run:</p>
    <code style="background:rgba(255,255,255,0.05);padding:8px 16px;border-radius:8px;font-size:11px;color:#60A5FA;word-break:break-all;max-width:90%">gcloud run services update yu-restos --region us-east1 --update-env-vars "OURA_REFRESH_TOKEN={refresh_token}"</code>
    <a href="/" style="color:#60A5FA;margin-top:20px">Go to app</a>
    </body></html>
    """)


@router.get("/data-status")
def data_status():
    """Returns status of loaded Oura data for live indicators."""
    days = sorted(_sleep_by_day.keys())
    return {
        "source": "Oura Ring API",
        "live": True,
        "sleep_sessions": len(SLEEP_SESSIONS),
        "daily_scores": len(DAILY_SLEEP),
        "workouts": len(WORKOUTS),
        "heart_rate_readings": len(HEARTRATE),
        "date_range": {
            "first": days[0] if days else None,
            "last": days[-1] if days else None,
        },
        "total_days": len(days),
    }
