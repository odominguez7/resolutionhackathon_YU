from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse
from .engine import generate_schedule, compute_kpis, get_hero
from .workout import generate_workout
from .energy import compute_energy_curve, audit_calendar, find_focus_blocks, find_peak_windows, find_dip_windows
from .nutrition import compute_nutrition_timeline
from .recovery import compute_recovery_items
from .calendar_client import get_today_events, has_google_token, get_auth_url, exchange_code

router = APIRouter()


@router.get("/full-day")
def get_full_day(mood: str = "balanced"):
    """Mega endpoint — returns the complete 24-hour performance plan."""
    if mood not in ("push", "balanced", "recovery"):
        mood = "balanced"

    # 1. Core schedule + KPIs
    schedule = generate_schedule(mood)
    kpis = compute_kpis()
    kpi_map = {k["id"]: k for k in kpis.get("kpis", [])}

    readiness = schedule.get("readiness_score", 75)
    hrv = schedule.get("hrv", 30)
    baseline_hrv = schedule.get("baseline_hrv", 40)
    sleep_hours = schedule.get("sleep_hours", 7)
    stress_min = schedule.get("stress_min", 60)

    # 2. Hero
    hero = get_hero(readiness, mood)
    hero.update({
        "readiness": readiness,
        "sleep_score": schedule.get("sleep_score", 80),
        "sleep_hours": sleep_hours,
        "hrv": hrv,
    })

    # 3. Energy curve
    # Extract wake time as float
    wake_items = [i for i in schedule.get("schedule", []) if i["type"] == "wake"]
    wake_time_str = wake_items[0]["time"] if wake_items else "07:00"
    wh, wm = map(int, wake_time_str.split(":"))
    wake_hour = wh + wm / 60

    energy_curve = compute_energy_curve(wake_hour, readiness, hrv, baseline_hrv, sleep_hours, stress_min)

    # 4. Calendar
    events = get_today_events()
    audited_events = audit_calendar(events, energy_curve)
    focus_blocks = find_focus_blocks(events, energy_curve)

    # 5. Workout
    biometrics = {
        "readiness": readiness, "hrv": hrv, "baseline_hrv": baseline_hrv,
        "sleep_score": schedule.get("sleep_score", 80), "sleep_hours": sleep_hours,
        "avg_sleep_hours": schedule.get("avg_sleep_hours", 7), "stress_min": stress_min,
        "resting_hr": kpi_map.get("resting_hr", {}).get("current", 55),
        "baseline_rhr": kpi_map.get("resting_hr", {}).get("baseline", 55),
        "deep_sleep_pct": schedule.get("deep_sleep_pct", 18),
    }
    workout = generate_workout(biometrics)

    # 6. Nutrition
    # Extract times from schedule
    workout_items = [i for i in schedule.get("schedule", []) if i["type"] == "workout"]
    caffeine_items = [i for i in schedule.get("schedule", []) if i["type"] == "caffeine_cutoff"]
    bedtime_items = [i for i in schedule.get("schedule", []) if i["type"] == "bedtime"]
    winddown_items = [i for i in schedule.get("schedule", []) if i["type"] == "wind_down"]

    workout_time = workout_items[0]["time"] if workout_items else "09:00"
    workout_end = workout_items[0].get("end_time", "10:00") if workout_items else "10:00"
    caffeine_cutoff = caffeine_items[0]["time"] if caffeine_items else "14:00"
    bedtime = bedtime_items[0]["time"] if bedtime_items else "22:30"
    wind_down = winddown_items[0]["time"] if winddown_items else "21:30"

    nutrition = compute_nutrition_timeline(
        wake_time=wake_time_str, workout_time=workout_time, workout_end=workout_end,
        caffeine_cutoff=caffeine_cutoff, bedtime=bedtime, wind_down=wind_down,
        stress_min=stress_min,
    )

    # 7. Recovery
    recovery = compute_recovery_items(
        readiness=readiness, stress_min=stress_min, hrv=hrv, baseline_hrv=baseline_hrv,
        wind_down_time=wind_down, events=events, energy_curve=energy_curve,
    )

    # 8. Build unified timeline — merge schedule + nutrition + recovery + focus + calendar
    timeline = []
    seen_types = set()  # deduplicate

    # Add schedule items (skip caffeine_cutoff — nutrition has a better one)
    for item in schedule.get("schedule", []):
        if item["type"] == "caffeine_cutoff":
            continue  # nutrition version has personality
        timeline.append({
            "time": item["time"],
            "end_time": item.get("end_time"),
            "type": item["type"],
            "title": item["title"],
            "description": item.get("description", ""),
            "icon": item.get("icon", "circle"),
            "color": item.get("color", "blue"),
            "action": item.get("action"),
            "source": "schedule",
        })

    # Add nutrition items
    for item in nutrition:
        timeline.append({
            "time": item["time"],
            "end_time": None,
            "type": item["type"],
            "title": item["title"],
            "description": item.get("description", ""),
            "icon": item.get("icon", "utensils"),
            "color": item.get("color", "green"),
            "action": item.get("action"),
            "source": "nutrition",
        })

    # Add recovery items
    for item in recovery:
        timeline.append({
            "time": item["time"],
            "end_time": None,
            "type": item["type"],
            "title": item["title"],
            "description": item.get("description", ""),
            "icon": item.get("icon", "heart"),
            "color": item.get("color", "purple"),
            "action": item.get("action"),
            "source": "recovery",
        })

    # Add focus blocks
    for block in focus_blocks:
        timeline.append({
            "time": block["start"],
            "end_time": block["end"],
            "type": "focus",
            "title": f"{block['label']} ({block['duration_min']}min)",
            "description": f"Energy avg {block['energy_avg']}%. Your brain peaks now. Ship something great.",
            "icon": "target",
            "color": "blue",
            "action": block.get("action"),
            "source": "focus",
        })

    # Add calendar events inline
    for event in audited_events:
        energy_info = f" {event.get('energy_emoji','')} {event.get('energy_level','')}%"
        timeline.append({
            "time": event["start"],
            "end_time": event.get("end"),
            "type": "calendar",
            "title": event["summary"],
            "description": (event.get("suggestion") or f"Energy: {event.get('energy_level','')}% ({event.get('energy_zone','')})") + (f" | {event.get('calendar','')}" if event.get("calendar") else ""),
            "icon": "calendar" if not event.get("flag") else "alert-triangle",
            "color": "gray" if not event.get("flag") else ("amber" if event.get("flag") == "optimize" else "red"),
            "action": None,
            "source": "calendar",
            "flag": event.get("flag"),
        })

    # Sort: post-midnight items (00:xx - 05:xx) go to END of day
    def sort_key(item):
        t = item["time"]
        h = int(t.split(":")[0])
        if h < 5:  # post-midnight → treat as 24+
            return f"{24 + h:02d}:{t.split(':')[1]}"
        return t

    timeline.sort(key=sort_key)

    # 9. Interactive questions
    questions = []
    # Find afternoon gaps
    afternoon_gaps = [b for b in focus_blocks if "15" <= b["start"] <= "18"]
    if afternoon_gaps:
        questions.append({
            "id": "afternoon_gap",
            "text": f"You have a {afternoon_gaps[0]['duration_min']}min window at {afternoon_gaps[0]['start']}. What do you want?",
            "options": ["Deep work", "Active recovery", "Let RestOS decide"],
        })

    return {
        "based_on_day": schedule.get("based_on_day"),
        "mood": mood,
        "hero": hero,
        "energy_curve": energy_curve,
        "timeline": timeline,
        "calendar": {
            "events": audited_events,
            "focus_blocks": focus_blocks,
            "peak_windows": find_peak_windows(energy_curve),
            "dip_windows": find_dip_windows(energy_curve),
            "connected": has_google_token(),
        },
        "workout": workout,
        "kpis": kpis.get("kpis", []),
        "recovery": recovery,
        "interactive": {
            "greeting": f"{hero['headline']} {hero['emoji']}",
            "questions": questions,
        },
    }


# ─── Legacy endpoints (keep for backwards compat) ───

@router.get("/schedule")
def get_schedule():
    return generate_schedule()

@router.get("/kpis")
def get_kpis_route():
    return compute_kpis()

@router.get("/workout")
def get_workout():
    schedule = generate_schedule()
    kpis = compute_kpis()
    kpi_map = {k["id"]: k for k in kpis.get("kpis", [])}
    biometrics = {
        "readiness": schedule.get("readiness_score", 75),
        "hrv": schedule.get("hrv", 35), "baseline_hrv": schedule.get("baseline_hrv", 40),
        "sleep_score": schedule.get("sleep_score", 80), "sleep_hours": schedule.get("sleep_hours", 7),
        "avg_sleep_hours": schedule.get("avg_sleep_hours", 7), "stress_min": schedule.get("stress_min", 60),
        "resting_hr": kpi_map.get("resting_hr", {}).get("current", 55),
        "baseline_rhr": kpi_map.get("resting_hr", {}).get("baseline", 55),
        "deep_sleep_pct": schedule.get("deep_sleep_pct", 18),
    }
    return generate_workout(biometrics)

@router.post("/execute/{item_index}")
def execute_action(item_index: int):
    full_day = get_full_day()
    items = full_day.get("timeline", [])
    if item_index < 0 or item_index >= len(items):
        raise HTTPException(status_code=404, detail="Timeline item not found")
    item = items[item_index]
    action = item.get("action")
    if not action:
        raise HTTPException(status_code=400, detail="This item has no executable action")
    tool_id = action.get("tool_id", "")
    result = {
        "item_index": item_index, "title": item["title"], "tool": tool_id,
        "status": "executed", "parameters": {k: v for k, v in action.items() if k != "tool_id"},
        "result": f"{item['title']} executed successfully.",
    }
    if tool_id == "adjust_temperature":
        result["api_call"] = "PUT /v1/users/{id}/temperature"
        result["sponsor"] = "Eight Sleep"
    elif tool_id == "block_calendar":
        result["api_call"] = "POST /calendar/v3/calendars/primary/events"
        result["sponsor"] = "Google Calendar"
    return result


# ─── Google Calendar OAuth ───

@router.get("/google/auth-url")
def google_auth_url():
    url = get_auth_url()
    if not url:
        return {"url": None, "error": "Google Calendar not configured. Add GOOGLE_CLIENT_ID to .env"}
    return {"url": url}

@router.get("/google/callback")
def google_callback(code: str):
    success = exchange_code(code)
    if success:
        return RedirectResponse(url="http://localhost:5173/optimize?calendar=connected")
    raise HTTPException(status_code=400, detail="Failed to exchange Google token")
