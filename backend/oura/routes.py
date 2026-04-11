"""
Oura Ring API — serves REAL biometric data from Omar's Oura Ring.
All data loaded from scripts/oura_data/ JSON exports.
Webhooks push real-time updates from Oura cloud.
"""

import json
import os
from datetime import datetime, timedelta
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

    # Atomic swap pattern: build new dicts, then assign in one step.
    # Prevents concurrent reads from seeing empty state between clear+update.
    if sleep:
        SLEEP_SESSIONS = sleep
        new_sleep = {}
        for s in sleep:
            if s.get("type") == "long_sleep" or s["day"] not in new_sleep:
                new_sleep[s["day"]] = s
        _sleep_by_day.clear()
        _sleep_by_day.update(new_sleep)

    if daily_sleep:
        DAILY_SLEEP = daily_sleep
        new_scores = {d["day"]: d.get("score", 0) for d in daily_sleep}
        new_daily = {d["day"]: d for d in daily_sleep}
        _score_by_day.clear()
        _score_by_day.update(new_scores)
        _daily_sleep_by_day.clear()
        _daily_sleep_by_day.update(new_daily)

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


@router.post("/checkin")
async def morning_checkin(request: Request, payload: dict = {}):
    """Morning self-report BEFORE biometrics. Stores the subjective energy
    score and returns a fused insight comparing felt state to body data."""
    from backend.wearable.user_data import load_user_biometrics
    user_id = getattr(request.state, "user_id", "omar")
    energy = int((payload or {}).get("energy", 3))  # 1-5 scale

    # Store the check-in
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        db.collection("morning_checkins").document(f"{user_id}_{datetime.now(BOSTON_TZ).strftime('%Y-%m-%d')}").set({
            "user_id": user_id,
            "energy": energy,
            "day": datetime.now(BOSTON_TZ).strftime("%Y-%m-%d"),
            "timestamp": datetime.now(BOSTON_TZ).isoformat(),
        })
    except Exception:
        pass

    # Get body data for fusion
    data = load_user_biometrics(user_id)
    days = sorted(data["sleep_by_day"].keys())
    latest_day = days[-1] if days else None
    hrv = data["sleep_by_day"].get(latest_day, {}).get("average_hrv") if latest_day else None
    readiness = (data["readiness_by_day"].get(latest_day, {}) or {}).get("score") if latest_day else None

    # Fuse: compare subjective to objective
    fusion = None
    if hrv and readiness:
        body_score = readiness / 20  # normalize to 1-5 scale
        gap = energy - body_score
        if abs(gap) < 0.8:
            fusion = {"alignment": "confirmed", "message": f"Your body agrees. Recovery at {readiness}, and you feel it."}
        elif gap > 0:
            fusion = {"alignment": "mismatch_high", "message": f"You feel strong ({energy}/5) but your HRV is {hrv}ms, below your baseline. Accumulated stress your body hasn't expressed yet. Trust the data today."}
        else:
            fusion = {"alignment": "mismatch_low", "message": f"You rated yourself low ({energy}/5) but readiness is {readiness} and HRV is holding. Your body is more recovered than you think. You can push."}

    return {"energy": energy, "fusion": fusion, "stored": True}


@router.get("/daily-action")
async def get_daily_action(request: Request):
    """THE endpoint. Returns today's agent-chosen action + workout if applicable.
    Adapts based on time of day (silent intervention)."""
    from .athlete_context import build_athlete_context
    from backend.wearable.user_data import load_user_biometrics
    from backend.agent.daily_action import pick_daily_action, adapt_for_time_of_day, compute_calendar_cognitive_load
    from .workout_brain import recent_log

    user_id = getattr(request.state, "user_id", "omar")
    data = load_user_biometrics(user_id)

    # Get calendar events for cognitive load scoring
    try:
        from backend.calendar.routes import get_today_events
        events = get_today_events() or []
    except Exception:
        events = []

    try:
        calendar_load = compute_calendar_cognitive_load(events)
    except Exception:
        calendar_load = 0

    ctx = build_athlete_context(
        sleep_by_day=data["sleep_by_day"],
        score_by_day=data["score_by_day"],
        readiness_by_day=data["readiness_by_day"],
        stress_by_day=data["stress_by_day"],
        user_id=user_id,
    )
    ctx["calendar_cognitive_load"] = calendar_load

    # Build universal normalized context (hardware-agnostic)
    from .normalize import build_universal_context
    from .workout_brain import recent_log as _recent
    all_log = _recent(28)  # 28 days for ACWR
    universal = build_universal_context(ctx, all_log)

    # ACWR-based throttling: if danger zone, force recovery
    acwr = universal.get("load_ledger", {}).get("acwr", {})
    if acwr.get("zone") == "danger_zone":
        ctx["overtraining_risk"] = "veto"
    elif acwr.get("zone") == "elevated_risk":
        ctx["overtraining_risk"] = max(ctx.get("overtraining_risk", "none"), "elevated")

    # Confidence-based degradation: low confidence → safe defaults
    confidence = universal.get("meta", {}).get("data_confidence_score", 0.5)
    if confidence < 0.4:
        ctx["intensity_tier"] = "easy"  # don't push when data is unreliable

    # HRV OPTIMIZATION LOOP — the strategic layer
    from .hrv_optimizer import compute_hrv_trend, compute_strategy, apply_strategy_to_action
    hrv_trend = compute_hrv_trend(data["sleep_by_day"], window_days=30)
    acwr_data = universal.get("load_ledger", {}).get("acwr", {})
    strategy = compute_strategy(hrv_trend, ctx.get("adherence_profile", {}), acwr_data)

    # Count push days this week from Oura real workouts
    from .normalize import get_oura_workout_history
    this_week = [w for w in get_oura_workout_history() if w.get("intensity") == "push"
                 and w.get("day", "") >= (datetime.now(BOSTON_TZ) - timedelta(days=7)).strftime("%Y-%m-%d")]
    weekly_push_count = len(this_week)

    # Agent picks the action (tactical)
    action = pick_daily_action(ctx)
    action = adapt_for_time_of_day(action)

    # Strategy overrides tactical if needed (HRV is the northstar)
    action = apply_strategy_to_action(action, strategy, weekly_push_count)

    # Check if a workout is already generated today
    entries = _recent(2)
    today_str = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    todays = [e for e in entries if e.get("day") == today_str and not e.get("rejected")]
    existing_workout = None
    if todays:
        latest = sorted(todays, key=lambda e: e.get("generated_at", ""))[-1]
        existing_workout = latest

    # Weekly summary
    completed_7d = ctx.get("adherence_profile", {}).get("completed_7d", 0)
    streak = ctx.get("adherence_profile", {}).get("streak", 0)
    total_7d = ctx.get("adherence_profile", {}).get("total_7d", 0)

    return {
        "action": action,
        "existing_workout": existing_workout,
        "body": {
            "readiness": ctx["biometrics"].get("readiness"),
            "hrv": ctx["biometrics"].get("hrv"),
            "hrv_baseline": (ctx.get("baseline", {}).get("hrv", {}) or {}).get("ewma"),
            "sleep_score": ctx["biometrics"].get("sleep_score"),
            "stress_min": ctx["biometrics"].get("stress_min"),
        },
        "week": {
            "completed": completed_7d,
            "streak": streak,
            "total": total_7d,
        },
        "calendar_cognitive_load": calendar_load,
        "strategy": strategy,
        "universal_context": universal,
        "last_trained": _get_last_trained(),
        "user_id": user_id,
    }


def _get_last_trained() -> dict | None:
    """Get the most recent real workout from Oura (not test generations)."""
    try:
        from backend.oura.normalize import get_oura_workout_history
        workouts = get_oura_workout_history()
        if workouts:
            latest = sorted(workouts, key=lambda w: w.get("day", ""), reverse=True)[0]
            return {"day": latest["day"], "activity": latest.get("activity"), "calories": latest.get("calories")}
    except Exception:
        pass
    return None


@router.post("/workout/generate")
@router.get("/workout")  # keep GET for backwards compat, prefer POST
async def get_workout(request: Request, session_type: str = "crossfit", travel: bool = False):
    """Generate AI-powered workout based on real biometrics.
    Uses the typed AthleteContext — single assembly point for all state.
    Reads from per-user biometric data (Firestore) or Omar's global cache."""
    from .workout_ai import generate_workout
    from .athlete_context import build_athlete_context
    from backend.wearable.user_data import load_user_biometrics

    user_id = getattr(request.state, "user_id", "omar")
    data = load_user_biometrics(user_id)
    ctx = build_athlete_context(
        sleep_by_day=data["sleep_by_day"],
        score_by_day=data["score_by_day"],
        readiness_by_day=data["readiness_by_day"],
        stress_by_day=data["stress_by_day"],
        session_type=session_type,
        travel_mode=travel,
        user_id=user_id,
    )
    result = await generate_workout(session_type, ctx["biometrics"], athlete_context=ctx)
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

    from .athlete_context import build_athlete_context

    ctx = build_athlete_context(
        sleep_by_day=_sleep_by_day,
        score_by_day=_score_by_day,
        readiness_by_day=_readiness_by_day,
        stress_by_day=_stress_by_day,
        session_type=session_type,
        lock_patterns=rejected.get("patterns") or [],
        avoid_movements=rejected.get("movements") or [],
    )
    return await generate_workout(
        session_type,
        ctx["biometrics"],
        lock_patterns=rejected.get("patterns") or [],
        avoid_movements=rejected.get("movements") or [],
        athlete_context=ctx,
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
            skip_reason = (payload or {}).get("skip_reason")  # travel / illness / work_overload / low_motivation
            entry["user_feedback"] = {
                "completed": completed,
                "skip_reason": skip_reason,
                "felt": (payload or {}).get("felt"),
                "soreness": (payload or {}).get("soreness"),
                "notes": (payload or {}).get("notes", ""),
                "recorded_at": datetime.now(BOSTON_TZ).isoformat(),
                "time_of_day": datetime.now(BOSTON_TZ).strftime("%H:%M"),
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
            # Emit Pub/Sub event
            try:
                from .events import publish_workout_event
                evt = "workout.completed" if completed == "yes" else "session.skipped" if completed == "no" else "session.partial"
                publish_workout_event(evt, {
                    "log_id": target_id,
                    "completed": completed,
                    "skip_reason": skip_reason,
                    "day": entry.get("day"),
                    "intensity": entry.get("intensity"),
                    "patterns": entry.get("patterns"),
                })
            except Exception:
                pass
            return {"saved": True, "entry": entry}
    return {"saved": False, "reason": "log_id not found"}


@router.post("/workout/rpe")
def workout_rpe(payload: dict):
    """Per-set RPE tracking. Accepts:
    {log_id, movement_name, set_number, reps_actual, load_actual, rpe (1-10)}
    Stores in Firestore. RPE <= 8 counts as 'clean' for progression bumps.
    RPE 9-10 resets the consecutive_clean counter."""
    from .workout_progression import _normalize_name, _get_db
    db = _get_db()
    if not db:
        return {"saved": False, "reason": "Firestore unavailable"}

    log_id = (payload or {}).get("log_id", "")
    movement = (payload or {}).get("movement_name", "")
    set_num = int((payload or {}).get("set_number", 0))
    reps = (payload or {}).get("reps_actual")
    load = (payload or {}).get("load_actual")
    rpe = float((payload or {}).get("rpe", 5))

    if not movement:
        return {"saved": False, "reason": "movement_name required"}

    # Store the RPE entry
    doc_id = _normalize_name(movement)
    try:
        ref = db.collection("rpe_log").document(f"{log_id}_{doc_id}_s{set_num}")
        entry = {
            "log_id": log_id,
            "movement_name": movement,
            "set_number": set_num,
            "reps_actual": reps,
            "load_actual": load,
            "rpe": rpe,
            "recorded_at": datetime.now(BOSTON_TZ).isoformat(),
        }
        ref.set(entry)

        # Update progression ledger based on RPE
        prog_ref = db.collection("progression").document(doc_id)
        prog_doc = prog_ref.get()
        if prog_doc.exists:
            rec = prog_doc.to_dict()
            if rpe <= 8:
                # Clean set — counts toward progression bump
                pass  # progression already counted on generation; RPE confirms
            else:
                # Hard set — reset consecutive_clean (shouldn't bump)
                rec["consecutive_clean"] = 0
                rec["next_prescribed_lbs"] = rec.get("current_load_lbs")
                prog_ref.set(rec)

        return {"saved": True, **entry}
    except Exception as e:
        return {"saved": False, "reason": str(e)[:100]}


@router.get("/workout/rpe/{log_id}")
def workout_rpe_history(log_id: str):
    """Get all RPE entries for a specific workout."""
    from .workout_progression import _get_db
    db = _get_db()
    if not db:
        return {"entries": []}
    try:
        docs = db.collection("rpe_log").where("log_id", "==", log_id).stream()
        return {"entries": [d.to_dict() for d in docs]}
    except Exception:
        return {"entries": []}


@router.get("/workout/progression")
def workout_progression():
    """Progressive overload ledger — per-movement load history + next prescribed."""
    from .workout_progression import get_all_progressions
    return {"movements": get_all_progressions()}


@router.get("/workout/competency")
def workout_competency():
    """Get the user's movement competency matrix (blocked movements + reasons)."""
    from .athlete_context import load_competency
    return load_competency()


@router.post("/workout/competency/block")
def workout_block_movement(payload: dict):
    """Block a movement (e.g. due to injury). {movement_name, reason}"""
    from .athlete_context import block_movement
    name = (payload or {}).get("movement_name", "")
    reason = (payload or {}).get("reason", "injury")
    if not name:
        return {"error": "movement_name required"}
    return block_movement(name, reason)


@router.post("/workout/competency/unblock")
def workout_unblock_movement(payload: dict):
    """Unblock a previously blocked movement. {movement_name}"""
    from .athlete_context import unblock_movement
    name = (payload or {}).get("movement_name", "")
    if not name:
        return {"error": "movement_name required"}
    return unblock_movement(name)


@router.get("/hrv-strategy")
async def get_hrv_strategy(request: Request):
    """The HRV optimization strategy — multi-week view.
    Shows whether HRV is improving/flat/declining and what the system
    is doing about it."""
    from backend.wearable.user_data import load_user_biometrics
    from .hrv_optimizer import compute_hrv_trend, compute_strategy
    from .normalize import build_universal_context, get_oura_workout_history
    from .athlete_context import build_athlete_context

    user_id = getattr(request.state, "user_id", "omar")
    data = load_user_biometrics(user_id)
    hrv_trend = compute_hrv_trend(data["sleep_by_day"], window_days=30)
    ctx = build_athlete_context(
        sleep_by_day=data["sleep_by_day"], score_by_day=data["score_by_day"],
        readiness_by_day=data["readiness_by_day"], stress_by_day=data["stress_by_day"],
        user_id=user_id,
    )
    oura_log = get_oura_workout_history()
    uc = build_universal_context(ctx, oura_log)
    acwr = uc.get("load_ledger", {}).get("acwr", {})
    strategy = compute_strategy(hrv_trend, ctx.get("adherence_profile", {}), acwr)
    return strategy


@router.get("/universal-context")
async def get_universal_context(request: Request):
    """The full normalized AthleteContext — hardware-agnostic, 0-1 scales.
    This is what the THINK layer reads. Good for debugging and demos."""
    from .athlete_context import build_athlete_context
    from backend.wearable.user_data import load_user_biometrics
    from .normalize import build_universal_context
    from .workout_brain import recent_log

    user_id = getattr(request.state, "user_id", "omar")
    data = load_user_biometrics(user_id)
    ctx = build_athlete_context(
        sleep_by_day=data["sleep_by_day"], score_by_day=data["score_by_day"],
        readiness_by_day=data["readiness_by_day"], stress_by_day=data["stress_by_day"],
        user_id=user_id,
    )
    return build_universal_context(ctx, recent_log(28))


@router.get("/ml/readiness")
def ml_readiness():
    """ML readiness prediction for current biometrics."""
    from .athlete_context import build_athlete_context
    ctx = build_athlete_context(_sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day)
    return ctx.get("readiness_ml") or {"score": ctx.get("readiness"), "source": "oura_passthrough"}


@router.post("/ml/readiness/train")
def ml_train_readiness():
    """Train the readiness model from historical Oura data.
    Uses each day's biometrics as features and Oura readiness as the label."""
    from .ml_models import train_readiness_model, _build_readiness_features
    from .athlete_context import compute_baseline_with_limits
    days = sorted(_sleep_by_day.keys())
    if len(days) < 30:
        return {"error": "Need at least 30 days of data"}

    hrvs = [_sleep_by_day[d].get("average_hrv") for d in days if _sleep_by_day[d].get("average_hrv")]
    rhrs = [_sleep_by_day[d].get("average_heart_rate") for d in days if _sleep_by_day[d].get("average_heart_rate")]
    hrv_bl = compute_baseline_with_limits(hrvs)
    rhr_bl = compute_baseline_with_limits(rhrs)

    training_data = []
    for d in days:
        s = _sleep_by_day.get(d, {})
        r = _readiness_by_day.get(d, {})
        st = _stress_by_day.get(d, {})
        readiness = r.get("score") if isinstance(r, dict) else None
        if readiness is None:
            continue
        bio = {
            "hrv": s.get("average_hrv"),
            "rhr": s.get("average_heart_rate"),
            "sleep_score": _score_by_day.get(d),
            "deep_min": round(s.get("deep_sleep_duration", 0) / 60) if s.get("deep_sleep_duration") else 0,
            "total_sleep_hrs": round(s.get("total_sleep_duration", 0) / 3600, 1) if s.get("total_sleep_duration") else 7,
            "stress_min": round((st.get("stress_high", 0) or 0) / 60) if isinstance(st, dict) else 0,
        }
        features = _build_readiness_features(bio, {"hrv": hrv_bl, "rhr": rhr_bl})
        training_data.append({"features": features, "label": float(readiness)})

    return train_readiness_model(training_data)


@router.get("/ml/overtraining")
def ml_overtraining():
    """Current multi-signal overtraining risk assessment."""
    from .athlete_context import build_athlete_context
    ctx = build_athlete_context(_sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day)
    return ctx.get("overtraining_detail") or {"level": "none"}


@router.get("/ml/dosage")
def ml_dosage(movement: str = "db_front_squat"):
    """Get a dosage recommendation for a movement from the LinUCB policy."""
    from .ml_models import get_dosage_recommendation
    from .athlete_context import build_athlete_context
    ctx = build_athlete_context(_sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day)
    bio = ctx.get("biometrics") or {}
    baseline = ctx.get("baseline") or {}
    hrv_z = 0
    if bio.get("hrv") and baseline.get("hrv", {}).get("ewma"):
        std = baseline["hrv"].get("std") or 5
        hrv_z = (bio["hrv"] - baseline["hrv"]["ewma"]) / max(1, std)
    # Look up progression for this movement
    prog = ctx.get("progression_ledger", {}).get(movement, {})
    return get_dosage_recommendation(
        readiness=bio.get("readiness", 70),
        hrv_z=round(hrv_z, 2),
        days_since_heavy=1,
        consecutive_clean=prog.get("consecutive_clean", 0),
    )


@router.post("/catalog/seed")
def catalog_seed():
    """Seed the Firestore catalog from CF Movements.md. Run once."""
    from .catalog_svc import seed_catalog
    return seed_catalog()


@router.get("/catalog")
def catalog_list():
    """List all active movements in the catalog."""
    from .catalog_svc import get_catalog_movements, get_catalog_sha
    return {"sha": get_catalog_sha(), "movements": get_catalog_movements()}


@router.post("/catalog/add")
def catalog_add(payload: dict):
    """Add a movement to the catalog. {name, section, notes?}"""
    from .catalog_svc import add_movement
    return add_movement(
        (payload or {}).get("name", ""),
        (payload or {}).get("section", "Other"),
        (payload or {}).get("notes", ""),
    )


@router.post("/catalog/deactivate")
def catalog_deactivate(payload: dict):
    """Deactivate a movement. {name}"""
    from .catalog_svc import deactivate_movement
    name = (payload or {}).get("name", "")
    return {"deactivated": deactivate_movement(name)}


@router.get("/workout/adherence")
def workout_adherence():
    """Adherence profile for the last 14 days."""
    from .workout_adherence import build_adherence_profile
    from .workout_brain import recent_log
    return build_adherence_profile(recent_log(14))


@router.get("/workout/weekly-summary")
def workout_weekly_summary():
    """Weekly training summary: sessions, patterns, completion rate, intensity distribution, HRV trend."""
    from .workout_brain import recent_log
    from .workout_adherence import build_adherence_profile
    entries = recent_log(7)
    adherence = build_adherence_profile(recent_log(14))

    completed = [e for e in entries if (e.get("user_feedback") or {}).get("completed") == "yes"]
    skipped = [e for e in entries if (e.get("user_feedback") or {}).get("completed") == "no"]
    partial = [e for e in entries if (e.get("user_feedback") or {}).get("completed") == "partial"]

    # Pattern distribution
    pattern_counts: dict[str, int] = {}
    for e in completed:
        for p in (e.get("patterns") or []):
            pattern_counts[p] = pattern_counts.get(p, 0) + 1

    # Intensity distribution
    intensity_counts: dict[str, int] = {}
    for e in entries:
        i = e.get("intensity", "unknown")
        intensity_counts[i] = intensity_counts.get(i, 0) + 1

    # HRV trend from last 7 days
    days = sorted(_sleep_by_day.keys())[-7:]
    hrvs = [_sleep_by_day[d].get("average_hrv") for d in days if _sleep_by_day[d].get("average_hrv")]
    hrv_trend = "stable"
    if len(hrvs) >= 3:
        first_half = sum(hrvs[:len(hrvs)//2]) / max(1, len(hrvs)//2)
        second_half = sum(hrvs[len(hrvs)//2:]) / max(1, len(hrvs) - len(hrvs)//2)
        if second_half > first_half + 2: hrv_trend = "improving"
        elif second_half < first_half - 2: hrv_trend = "declining"

    # Verdicts
    too_much = sum(1 for e in entries if e.get("load_verdict") == "too_much")
    ok = sum(1 for e in entries if e.get("load_verdict") == "ok")

    return {
        "total_sessions": len(entries),
        "completed": len(completed),
        "skipped": len(skipped),
        "partial": len(partial),
        "completion_rate": round(len(completed) / max(1, len(entries)) * 100),
        "pattern_counts": pattern_counts,
        "intensity_distribution": intensity_counts,
        "hrv_trend": hrv_trend,
        "hrv_values": hrvs,
        "verdicts": {"too_much": too_much, "ok": ok},
        "streak": adherence.get("streak", 0),
        "preferred_window": adherence.get("preferred_training_window"),
    }


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
