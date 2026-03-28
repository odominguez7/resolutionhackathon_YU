"""
Algorithmic optimizer — computes 24-hour schedule + 8 KPIs from real Oura data.
No AI dependency. Instant results.
"""
from datetime import datetime
import math


def _get_oura_data():
    """Import pre-loaded Oura dictionaries."""
    from oura.routes import (
        _sleep_by_day, _score_by_day, _readiness_by_day,
        _stress_by_day, _activity_by_day, _spo2_by_day,
        _resilience_by_day, _cardio_by_day,
    )
    return {
        "sleep": _sleep_by_day,
        "score": _score_by_day,
        "readiness": _readiness_by_day,
        "stress": _stress_by_day,
        "activity": _activity_by_day,
        "spo2": _spo2_by_day,
        "resilience": _resilience_by_day,
        "cardio": _cardio_by_day,
    }


def _sorted_days(d: dict, n: int = 30) -> list[str]:
    """Get last N days sorted ascending."""
    return sorted(d.keys())[-n:]


def _avg(vals: list) -> float:
    return sum(vals) / len(vals) if vals else 0


def _trend(vals_7d: list, vals_30d: list) -> tuple[str, float]:
    """Compare 7-day avg to 30-day avg. Returns (trend_label, pct_change)."""
    avg7 = _avg(vals_7d)
    avg30 = _avg(vals_30d)
    if avg30 == 0:
        return "stable", 0.0
    pct = ((avg7 - avg30) / avg30) * 100
    if pct > 5:
        return "improving", round(pct, 1)
    elif pct < -5:
        return "declining", round(pct, 1)
    return "stable", round(pct, 1)


def _trend_inverted(vals_7d: list, vals_30d: list) -> tuple[str, float]:
    """For metrics where lower is better (stress, HR)."""
    label, pct = _trend(vals_7d, vals_30d)
    if label == "improving":
        return "declining", pct
    elif label == "declining":
        return "improving", pct
    return label, pct


def _parse_bedtime_hour(iso_str: str) -> float:
    """Parse bedtime ISO string to hour (e.g., 22.5 for 10:30 PM). Handles post-midnight."""
    try:
        dt = datetime.fromisoformat(iso_str)
        h = dt.hour + dt.minute / 60
        if h < 12:
            h += 24  # e.g., 1:30 AM → 25.5
        return h
    except Exception:
        return 22.5  # fallback


def _hour_to_time(h: float) -> str:
    """Convert decimal hour to HH:MM string."""
    h = h % 24
    return f"{int(h):02d}:{int((h % 1) * 60):02d}"


def _hour_to_display(h: float) -> str:
    """Convert decimal hour to readable time like '10:15 PM'."""
    h = h % 24
    hr = int(h)
    mn = int((h % 1) * 60)
    ampm = "AM" if hr < 12 else "PM"
    hr12 = hr % 12 or 12
    return f"{hr12}:{mn:02d} {ampm}"


# ─── SCHEDULE GENERATOR ─────────────────────────────────────────────

def get_hero(readiness: int, mood: str = "balanced") -> dict:
    """Generate hero section with motivational headline."""
    if mood == "push":
        if readiness >= 75:
            return {"headline": "Your body is primed. Don't waste it.", "emoji": "🔥"}
        return {"headline": "Pushing through. Respect the grind.", "emoji": "💪"}
    elif mood == "recovery":
        return {"headline": "Recovery is the play. Trust the process.", "emoji": "🌙"}
    else:
        if readiness >= 85:
            return {"headline": "Your body is primed. Don't waste it.", "emoji": "🔥"}
        elif readiness >= 75:
            return {"headline": "Solid foundation. Build on it.", "emoji": "⚡"}
        elif readiness >= 65:
            return {"headline": "Not your peak day. Play it smart.", "emoji": "🎯"}
        return {"headline": "Recovery is the play. Trust the process.", "emoji": "🌙"}


def generate_schedule(mood: str = "balanced") -> dict:
    data = _get_oura_data()
    all_days = _sorted_days(data["score"])
    if not all_days:
        return {"error": "No Oura data available", "schedule": []}

    # Use today if it has a score, otherwise latest available
    from zoneinfo import ZoneInfo
    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")
    latest_day = today_str if today_str in data["score"] else all_days[-1]
    days_14 = all_days[-14:]
    days_30 = all_days[-30:]

    # Latest night's data — use the latest score day for scores/readiness,
    # but find the actual latest sleep SESSION (may be a different day key)
    latest_sleep = data["sleep"].get(latest_day, {})
    # If no sleep session for latest_day, walk backwards to find one
    if not latest_sleep.get("total_sleep_duration"):
        for d in reversed(all_days):
            s = data["sleep"].get(d, {})
            if s.get("total_sleep_duration") and s.get("type") != "late_nap":
                latest_sleep = s
                break

    latest_score = data["score"].get(latest_day, 0)
    latest_readiness = data["readiness"].get(latest_day, {}).get("score", 0)
    latest_hrv = latest_sleep.get("average_hrv") or 0
    latest_hr = latest_sleep.get("average_heart_rate") or 0
    latest_total_seconds = latest_sleep.get("total_sleep_duration", 0)
    latest_hours = round(latest_total_seconds / 3600, 1)
    latest_efficiency = latest_sleep.get("efficiency", 0)
    latest_latency = latest_sleep.get("latency", 0)
    latest_deep = latest_sleep.get("deep_sleep_duration", 0)
    latest_total_stages = (
        latest_sleep.get("deep_sleep_duration", 0) +
        latest_sleep.get("rem_sleep_duration", 0) +
        latest_sleep.get("light_sleep_duration", 0) +
        latest_sleep.get("awake_time", 0)
    ) or 1
    latest_deep_pct = round(latest_deep / latest_total_stages * 100, 1)

    # Baselines — use 14-day window to avoid old anomalies
    # Only include real sleep sessions (>3h) to filter out naps and partial data
    def _valid_sleep(d):
        s = data["sleep"].get(d, {})
        dur = s.get("total_sleep_duration", 0) / 3600
        return dur >= 3 and s.get("type") != "late_nap"

    valid_days_14 = [d for d in days_14 if _valid_sleep(d)]
    valid_days_30 = [d for d in days_30 if _valid_sleep(d)]

    hrvs = [data["sleep"][d].get("average_hrv") for d in valid_days_14 if data["sleep"].get(d, {}).get("average_hrv")]
    baseline_hrv = round(_avg(hrvs), 1) if hrvs else 40

    sleep_hours_14 = [data["sleep"][d].get("total_sleep_duration", 0) / 3600 for d in valid_days_14]
    avg_sleep_hours = round(_avg(sleep_hours_14), 1) if sleep_hours_14 else 7.0

    latencies_14 = [data["sleep"][d].get("latency", 0) for d in valid_days_14 if data["sleep"].get(d, {}).get("latency") is not None]
    avg_latency_sec = _avg(latencies_14) if latencies_14 else 600

    # Bedtime patterns — use MEDIAN to filter outliers (post-midnight crash nights)
    bedtimes = []
    for d in valid_days_14:
        s = data["sleep"].get(d, {})
        bt = s.get("bedtime_start")
        if bt:
            bedtimes.append(_parse_bedtime_hour(bt))

    if bedtimes:
        bedtimes_sorted = sorted(bedtimes)
        mid = len(bedtimes_sorted) // 2
        avg_bedtime = bedtimes_sorted[mid]  # median, not mean
    else:
        avg_bedtime = 22.75

    # Cap bedtime to reasonable range — OPTIMIZE toward earlier sleep
    # If median is past midnight, pull it back toward 11:30 PM (23.5)
    # This is intentional: the engine should IMPROVE bedtime, not mirror bad habits
    if avg_bedtime > 24.5:  # past 12:30 AM → pull back to 11:30 PM
        avg_bedtime = 23.5
    elif avg_bedtime > 24.0:  # past midnight → pull back to 11:45 PM
        avg_bedtime = 23.75
    elif avg_bedtime < 21:
        avg_bedtime = 22.0

    # Wake times — median
    waketimes = []
    for d in valid_days_14:
        s = data["sleep"].get(d, {})
        wt = s.get("bedtime_end")
        if wt:
            waketimes.append(datetime.fromisoformat(wt).hour + datetime.fromisoformat(wt).minute / 60)

    if waketimes:
        waketimes_sorted = sorted(waketimes)
        mid = len(waketimes_sorted) // 2
        avg_waketime = waketimes_sorted[mid]  # median
    else:
        avg_waketime = 7.0

    # Deep sleep % (7-day)
    deep_pcts_7 = []
    for d in all_days[-7:]:
        s = data["sleep"].get(d, {})
        total = (s.get("deep_sleep_duration", 0) + s.get("rem_sleep_duration", 0) +
                 s.get("light_sleep_duration", 0) + s.get("awake_time", 0))
        if total > 0:
            deep_pcts_7.append(s.get("deep_sleep_duration", 0) / total)
    avg_deep_pct_7 = _avg(deep_pcts_7) if deep_pcts_7 else 0.18

    # Stress
    latest_stress = data["stress"].get(latest_day, {})
    stress_min = round((latest_stress.get("stress_high", 0) or 0) / 60)

    # ─── BUILD SCHEDULE ───

    schedule = []
    sleep_debt = round(avg_sleep_hours - latest_hours, 1)

    # 1. Wake Up
    schedule.append({
        "time": _hour_to_time(avg_waketime),
        "end_time": None,
        "type": "wake",
        "title": "Wake Up",
        "description": f"Your avg wake time is {_hour_to_display(avg_waketime)}.",
        "icon": "sunrise",
        "color": "amber",
        "action": None,
    })

    # 2. Workout Window + Intensity
    if latest_readiness >= 80 and latest_hrv >= baseline_hrv:
        workout_time = avg_waketime + 1
        intensity = "high"
        intensity_label = "High Intensity OK"
        desc = f"Readiness {latest_readiness}, HRV {latest_hrv}ms (above {baseline_hrv}ms baseline). Go hard."
    elif latest_readiness >= 60:
        workout_time = avg_waketime + 1
        intensity = "moderate"
        intensity_label = "Moderate Workout"
        desc = f"Readiness {latest_readiness}, HRV {latest_hrv}ms. Steady state cardio or moderate weights."
    else:
        workout_time = 15.0  # 3 PM
        intensity = "light"
        intensity_label = "Light Movement Only"
        desc = f"Readiness {latest_readiness}, HRV {latest_hrv}ms (below {baseline_hrv}ms baseline). Walk, yoga, or stretch only."

    schedule.append({
        "time": _hour_to_time(workout_time),
        "end_time": _hour_to_time(workout_time + 1),
        "type": "workout",
        "title": intensity_label,
        "description": desc,
        "icon": "dumbbell",
        "color": "blue",
        "intensity": intensity,
        "action": None,
    })

    # 3. Recovery Block (if readiness < 70)
    if latest_readiness < 70:
        schedule.append({
            "time": "12:00",
            "end_time": "13:00",
            "type": "recovery",
            "title": "Recovery Block",
            "description": f"Readiness {latest_readiness} (below 70). Protect this hour for rest.",
            "icon": "shield",
            "color": "green",
            "action": {
                "tool_id": "block_calendar",
                "event_title": "Recovery Time (YU RestOS)",
                "start_time": "12:00",
                "end_time": "13:00",
            },
        })

    # 4. Caffeine Cutoff
    avg_latency_min = avg_latency_sec / 60
    if avg_latency_min > 60:
        cutoff = 11.0
    elif avg_latency_min > 40:
        cutoff = 12.0
    elif avg_latency_min > 30:
        cutoff = 13.0
    else:
        cutoff = 14.0

    schedule.append({
        "time": _hour_to_time(cutoff),
        "end_time": None,
        "type": "caffeine_cutoff",
        "title": "Last Caffeine",
        "description": f"Avg sleep latency {round(avg_latency_min)}min. {'Cut early — you take too long to fall asleep.' if avg_latency_min > 30 else 'Standard cutoff.'}",
        "icon": "coffee",
        "color": "amber",
        "action": None,
    })

    # 5. Nap (if sleep debt)
    if latest_hours < 6.0 or sleep_debt > 1.5:
        schedule.append({
            "time": "14:00",
            "end_time": "14:20",
            "type": "nap",
            "title": "20-Min Power Nap",
            "description": f"{latest_hours}h last night vs {avg_sleep_hours}h avg. Sleep debt: {sleep_debt}h.",
            "icon": "moon",
            "color": "purple",
            "action": {
                "tool_id": "block_calendar",
                "event_title": "Power Nap (YU RestOS)",
                "start_time": "14:00",
                "end_time": "14:20",
            },
        })

    # 6. Wind-Down
    # Calculate target bedtime first
    if sleep_debt > 2:
        bedtime_shift = 0.75  # 45 min earlier
    elif sleep_debt > 1:
        bedtime_shift = 0.5  # 30 min earlier
    else:
        bedtime_shift = 0

    target_bedtime = avg_bedtime - bedtime_shift
    wind_down_start = target_bedtime - 1.25  # 75 min before bed

    schedule.append({
        "time": _hour_to_time(wind_down_start),
        "end_time": _hour_to_time(wind_down_start + 0.75),
        "type": "wind_down",
        "title": "Wind-Down",
        "description": f"75min before target bedtime. No screens, dim lights.",
        "icon": "wind",
        "color": "purple",
        "action": {
            "tool_id": "block_calendar",
            "event_title": "Wind-Down (YU RestOS)",
            "start_time": _hour_to_time(wind_down_start),
            "end_time": _hour_to_time(wind_down_start + 0.75),
        },
    })

    # 7. Eight Sleep Bed Temp
    if avg_deep_pct_7 < 0.15:
        temp = -30
        temp_reason = f"Deep sleep {round(avg_deep_pct_7 * 100, 1)}% (target 20%). Aggressive cooling."
    elif avg_deep_pct_7 < 0.20:
        temp = -25
        temp_reason = f"Deep sleep {round(avg_deep_pct_7 * 100, 1)}% (target 20%). Moderate cooling."
    else:
        temp = -15
        temp_reason = f"Deep sleep {round(avg_deep_pct_7 * 100, 1)}%. Maintaining good levels."

    schedule.append({
        "time": _hour_to_time(target_bedtime - 0.5),
        "end_time": None,
        "type": "bed_temp",
        "title": f"Bed Cooling to {temp}",
        "description": temp_reason,
        "icon": "thermometer",
        "color": "blue",
        "action": {
            "tool_id": "adjust_temperature",
            "heatingLevel": temp,
            "stage": "initialSleepLevel",
        },
    })

    # 8. Target Bedtime
    bedtime_desc = f"{_hour_to_display(target_bedtime)}"
    if bedtime_shift > 0:
        bedtime_desc += f" ({round(bedtime_shift * 60)}min earlier than avg to recover sleep debt)"
    else:
        bedtime_desc += " (on schedule)"

    schedule.append({
        "time": _hour_to_time(target_bedtime),
        "end_time": None,
        "type": "bedtime",
        "title": "Target Bedtime",
        "description": bedtime_desc,
        "icon": "bed",
        "color": "purple",
        "action": None,
    })

    # Sort by time
    schedule.sort(key=lambda x: x["time"])

    return {
        "based_on_day": latest_day,
        "readiness_score": latest_readiness,
        "sleep_score": latest_score,
        "sleep_hours": latest_hours,
        "hrv": latest_hrv,
        "baseline_hrv": baseline_hrv,
        "deep_sleep_pct": latest_deep_pct,
        "sleep_debt": sleep_debt,
        "avg_sleep_hours": avg_sleep_hours,
        "stress_min": stress_min,
        "schedule": schedule,
    }


# ─── KPI CALCULATOR ──────────────────────────────────────────────────

def compute_kpis() -> dict:
    data = _get_oura_data()
    all_days = _sorted_days(data["score"])
    if not all_days:
        return {"kpis": []}

    # Use today if it has a score
    from zoneinfo import ZoneInfo
    today_str = datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")
    latest_day = today_str if today_str in data["score"] else all_days[-1]
    days_7 = all_days[-7:]
    days_10 = all_days[-10:]
    days_14 = all_days[-14:]
    days_30 = all_days[-30:]

    latest_sleep = data["sleep"].get(latest_day, {})
    # If no sleep session for latest_day, walk backwards to find one
    if not latest_sleep.get("total_sleep_duration"):
        for d in reversed(all_days):
            s = data["sleep"].get(d, {})
            if s.get("total_sleep_duration") and s.get("type") != "late_nap":
                latest_sleep = s
                break

    def _safe(d, day, *keys, default=None):
        obj = d.get(day, {})
        for k in keys:
            if isinstance(obj, dict):
                obj = obj.get(k)
            else:
                return default
        return obj if obj is not None else default

    # Helper to collect values
    def _collect(days, extractor):
        vals = []
        for d in days:
            v = extractor(d)
            if v is not None:
                vals.append(v)
        return vals

    kpis = []

    # 1. Sleep Score
    scores_7 = _collect(days_7, lambda d: data["score"].get(d))
    scores_30 = _collect(days_30, lambda d: data["score"].get(d))
    current_score = data["score"].get(latest_day, 0)
    baseline_score = round(_avg(scores_30), 1)
    trend_label, trend_pct = _trend(scores_7, scores_30)
    sparkline = [data["score"].get(d, 0) for d in days_10]
    status = "green" if current_score >= 80 else "amber" if current_score >= 70 else "red"

    kpis.append({
        "id": "sleep_score", "name": "Sleep Score", "icon": "moon",
        "current": current_score, "baseline": baseline_score, "target": 80, "unit": "/100",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "action": "Maintain sleep consistency and target 7+ hours." if status == "green" else f"Go to bed {30 if current_score >= 70 else 45}min earlier tonight.",
    })

    # 2. HRV
    hrvs_7 = _collect(days_7, lambda d: _safe(data["sleep"], d, "average_hrv"))
    hrvs_30 = _collect(days_30, lambda d: _safe(data["sleep"], d, "average_hrv"))
    current_hrv = latest_sleep.get("average_hrv") or _safe(data["sleep"], latest_day, "average_hrv", default=0)
    baseline_hrv = round(_avg(hrvs_30), 1) if hrvs_30 else 40
    trend_label, trend_pct = _trend(hrvs_7, hrvs_30)
    sparkline = [_safe(data["sleep"], d, "average_hrv", default=0) for d in days_10]
    status = "green" if current_hrv >= baseline_hrv else "amber" if current_hrv >= baseline_hrv * 0.85 else "red"

    kpis.append({
        "id": "hrv", "name": "HRV", "icon": "activity",
        "current": round(current_hrv, 1), "baseline": baseline_hrv, "target": baseline_hrv, "unit": "ms",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": [round(v, 1) for v in sparkline],
        "action": "HRV is healthy. Keep current routine." if status == "green" else "Reduce evening stress. Try 10min breathwork before bed.",
    })

    # 3. Deep Sleep %
    def _deep_pct(d):
        s = data["sleep"].get(d, {})
        total = (s.get("deep_sleep_duration", 0) + s.get("rem_sleep_duration", 0) +
                 s.get("light_sleep_duration", 0) + s.get("awake_time", 0))
        if total > 0:
            return round(s.get("deep_sleep_duration", 0) / total * 100, 1)
        return None

    deep_7 = _collect(days_7, _deep_pct)
    deep_30 = _collect(days_30, _deep_pct)
    # Use latest_sleep session for current deep pct
    _ls_total = (latest_sleep.get("deep_sleep_duration", 0) + latest_sleep.get("rem_sleep_duration", 0) +
                 latest_sleep.get("light_sleep_duration", 0) + latest_sleep.get("awake_time", 0))
    current_deep = round(latest_sleep.get("deep_sleep_duration", 0) / _ls_total * 100, 1) if _ls_total > 0 else (_deep_pct(latest_day) or 0)
    baseline_deep = round(_avg(deep_30), 1) if deep_30 else 18
    trend_label, trend_pct = _trend(deep_7, deep_30)
    sparkline = [_deep_pct(d) or 0 for d in days_10]
    status = "green" if current_deep >= 20 else "amber" if current_deep >= 15 else "red"

    kpis.append({
        "id": "deep_sleep", "name": "Deep Sleep", "icon": "brain",
        "current": current_deep, "baseline": baseline_deep, "target": 20, "unit": "%",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "action": "Deep sleep on target." if status == "green" else "Cool your bed temp. Avoid alcohol 3h before bed.",
    })

    # 4. Readiness
    readiness_7 = _collect(days_7, lambda d: _safe(data["readiness"], d, "score"))
    readiness_30 = _collect(days_30, lambda d: _safe(data["readiness"], d, "score"))
    current_readiness = _safe(data["readiness"], latest_day, "score", default=0)
    baseline_readiness = round(_avg(readiness_30), 1) if readiness_30 else 75
    trend_label, trend_pct = _trend(readiness_7, readiness_30)
    sparkline = [_safe(data["readiness"], d, "score", default=0) for d in days_10]
    status = "green" if current_readiness >= 75 else "amber" if current_readiness >= 65 else "red"

    kpis.append({
        "id": "readiness", "name": "Readiness", "icon": "zap",
        "current": current_readiness, "baseline": baseline_readiness, "target": 75, "unit": "/100",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "action": "Readiness is strong." if status == "green" else "Prioritize recovery today. Light activity only.",
    })

    # 5. Stress Minutes (inverted — lower is better)
    def _stress_min(d):
        s = data["stress"].get(d, {})
        v = s.get("stress_high")
        return round(v / 60) if v else None

    stress_7 = _collect(days_7, _stress_min)
    stress_30 = _collect(days_30, _stress_min)
    current_stress = _stress_min(latest_day) or 0
    baseline_stress = round(_avg(stress_30)) if stress_30 else 60
    trend_label, trend_pct = _trend_inverted(stress_7, stress_30)
    sparkline = [_stress_min(d) or 0 for d in days_10]
    status = "green" if current_stress <= baseline_stress else "amber" if current_stress <= baseline_stress * 1.2 else "red"

    kpis.append({
        "id": "stress", "name": "Stress", "icon": "flame",
        "current": current_stress, "baseline": baseline_stress, "target": baseline_stress, "unit": "min",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "inverted": True,
        "action": "Stress is manageable." if status == "green" else "Schedule a recovery session. Try 15min meditation.",
    })

    # 6. Sleep Efficiency
    eff_7 = _collect(days_7, lambda d: _safe(data["sleep"], d, "efficiency"))
    eff_30 = _collect(days_30, lambda d: _safe(data["sleep"], d, "efficiency"))
    current_eff = latest_sleep.get("efficiency") or _safe(data["sleep"], latest_day, "efficiency", default=0)
    baseline_eff = round(_avg(eff_30), 1) if eff_30 else 85
    trend_label, trend_pct = _trend(eff_7, eff_30)
    sparkline = [_safe(data["sleep"], d, "efficiency", default=0) for d in days_10]
    status = "green" if current_eff >= 85 else "amber" if current_eff >= 75 else "red"

    kpis.append({
        "id": "efficiency", "name": "Sleep Efficiency", "icon": "target",
        "current": current_eff, "baseline": baseline_eff, "target": 85, "unit": "%",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "action": "Efficiency is good." if status == "green" else "Only go to bed when sleepy. Reduce screen time in bed.",
    })

    # 7. Resting Heart Rate (inverted — lower is better)
    rhr_7 = _collect(days_7, lambda d: _safe(data["sleep"], d, "lowest_heart_rate"))
    rhr_30 = _collect(days_30, lambda d: _safe(data["sleep"], d, "lowest_heart_rate"))
    current_rhr = latest_sleep.get("lowest_heart_rate") or _safe(data["sleep"], latest_day, "lowest_heart_rate", default=0)
    baseline_rhr = round(_avg(rhr_30), 1) if rhr_30 else 55
    trend_label, trend_pct = _trend_inverted(rhr_7, rhr_30)
    sparkline = [_safe(data["sleep"], d, "lowest_heart_rate", default=0) for d in days_10]
    status = "green" if current_rhr <= baseline_rhr else "amber" if current_rhr <= baseline_rhr * 1.05 else "red"

    kpis.append({
        "id": "resting_hr", "name": "Resting HR", "icon": "heart",
        "current": current_rhr, "baseline": baseline_rhr, "target": baseline_rhr, "unit": "bpm",
        "trend": trend_label, "trend_pct": trend_pct, "status": status,
        "sparkline": sparkline,
        "inverted": True,
        "action": "Resting HR is healthy." if status == "green" else "Elevated HR. Avoid late meals and alcohol tonight.",
    })

    # 8. Sleep Consistency (stdev of bedtime hour, last 14 days)
    bedtimes = []
    for d in days_14:
        bt = data["sleep"].get(d, {}).get("bedtime_start")
        if bt:
            bedtimes.append(_parse_bedtime_hour(bt))

    if len(bedtimes) >= 3:
        avg_bt = _avg(bedtimes)
        variance = _avg([(b - avg_bt) ** 2 for b in bedtimes])
        stdev_min = round(math.sqrt(variance) * 60)  # convert hours to minutes
    else:
        stdev_min = 0

    sparkline_bt = [round(_parse_bedtime_hour(data["sleep"].get(d, {}).get("bedtime_start", "")) % 24 * 60) if data["sleep"].get(d, {}).get("bedtime_start") else 0 for d in days_10]
    status = "green" if stdev_min < 30 else "amber" if stdev_min < 45 else "red"

    kpis.append({
        "id": "consistency", "name": "Sleep Consistency", "icon": "clock",
        "current": stdev_min, "baseline": 30, "target": 30, "unit": "min stdev",
        "trend": "stable", "trend_pct": 0, "status": status,
        "sparkline": sparkline_bt,
        "inverted": True,
        "action": "Bedtime is consistent." if status == "green" else f"Bedtime varies by {stdev_min}min. Aim for same time +/-30min.",
    })

    return {"based_on_day": latest_day, "kpis": kpis}
