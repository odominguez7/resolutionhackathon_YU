import os
import httpx
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from .engine import generate_schedule, compute_kpis, get_hero
from .workout import generate_workout
from .energy import compute_energy_curve, audit_calendar, find_focus_blocks, find_peak_windows, find_dip_windows
from .nutrition import compute_nutrition_timeline
from .recovery import compute_recovery_items
from .calendar_client import get_today_events, has_google_token, get_auth_url, exchange_code

router = APIRouter()


def _get_today_workout_status() -> dict:
    """Check if the user already worked out today based on Oura data."""
    try:
        from backend.oura.routes import WORKOUTS, DAILY_ACTIVITY, _activity_by_day
    except ImportError:
        from oura.routes import WORKOUTS, DAILY_ACTIVITY, _activity_by_day
    boston_tz = ZoneInfo("America/New_York")
    today_str = datetime.now(boston_tz).strftime("%Y-%m-%d")

    # Check workouts
    today_workouts = [w for w in WORKOUTS if w.get("day") == today_str]
    if today_workouts:
        w = today_workouts[0]
        return {
            "worked_out": True,
            "activity": w.get("activity", "workout"),
            "calories": w.get("calories", 0),
            "duration_min": round(w.get("duration", 0) / 60) if w.get("duration") else 0,
        }

    # Check activity score — if steps are high, movement happened
    activity = _activity_by_day.get(today_str, {})
    steps = activity.get("steps", 0)
    active_cal = activity.get("active_calories", 0)
    if steps > 8000 or active_cal > 300:
        return {
            "worked_out": True,
            "activity": "active_day",
            "calories": active_cal,
            "duration_min": 0,
            "steps": steps,
        }

    return {"worked_out": False}


def _current_hour() -> float:
    """Current hour as decimal in Boston time."""
    boston_tz = ZoneInfo("America/New_York")
    now = datetime.now(boston_tz)
    return now.hour + now.minute / 60


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

    # 10. Current context
    now_hour = _current_hour()
    workout_status = _get_today_workout_status()

    # Mark timeline items as done/current/upcoming
    for item in timeline:
        item_h = int(item["time"].split(":")[0]) + int(item["time"].split(":")[1]) / 60
        if item_h < 5:
            item_h += 24
        end_h = item_h
        if item.get("end_time"):
            end_h = int(item["end_time"].split(":")[0]) + int(item["end_time"].split(":")[1]) / 60
            if end_h < 5:
                end_h += 24

        if item["type"] == "workout" and workout_status["worked_out"]:
            item["status"] = "done"
            item["done_detail"] = f"{workout_status.get('activity', 'workout')} - {workout_status.get('duration_min', 0)}min, {workout_status.get('calories', 0)} cal"
        elif item["type"] == "wake":
            item["status"] = "done" if now_hour > item_h + 0.5 else "current"
        elif now_hour >= end_h:
            item["status"] = "done"
        elif now_hour >= item_h:
            item["status"] = "current"
        else:
            item["status"] = "upcoming"

    # Sleep experiments based on KPI data
    sleep_experiments = []
    sleep_kpi = kpi_map.get("sleep_score", {})
    deep_kpi = kpi_map.get("deep_sleep", {})
    eff_kpi = kpi_map.get("efficiency", {})
    consistency_kpi = kpi_map.get("consistency", {})
    hrv_kpi = kpi_map.get("hrv", {})

    if deep_kpi.get("status") != "green":
        sleep_experiments.append({
            "id": "cool_room",
            "title": "Cool your room to 65F tonight",
            "why": f"Deep sleep at {deep_kpi.get('current', 0)}% (target 20%). Cooler temps increase deep sleep.",
            "duration": "1 week",
            "metric": "deep_sleep",
        })
    if eff_kpi.get("status") != "green":
        sleep_experiments.append({
            "id": "no_screens",
            "title": "No screens 45min before bed",
            "why": f"Efficiency at {eff_kpi.get('current', 0)}% (target 85%). Blue light delays sleep onset.",
            "duration": "5 days",
            "metric": "efficiency",
        })
    if consistency_kpi.get("status") != "green":
        sleep_experiments.append({
            "id": "fixed_bedtime",
            "title": f"Fixed bedtime within 30min window",
            "why": f"Bedtime varies by {consistency_kpi.get('current', 0)}min. Consistency trains your circadian rhythm.",
            "duration": "2 weeks",
            "metric": "consistency",
        })
    if hrv_kpi.get("status") != "green":
        sleep_experiments.append({
            "id": "breathwork",
            "title": "5min breathwork before bed",
            "why": f"HRV at {hrv_kpi.get('current', 0)}ms (baseline {hrv_kpi.get('baseline', 0)}ms). Breathwork activates parasympathetic recovery.",
            "duration": "1 week",
            "metric": "hrv",
        })
    if not sleep_experiments:
        sleep_experiments.append({
            "id": "maintain",
            "title": "Keep doing what you're doing",
            "why": "All sleep metrics are green. Your current routine is working.",
            "duration": "ongoing",
            "metric": "all",
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
        "now_hour": round(now_hour, 2),
        "workout_status": workout_status,
        "sleep_experiments": sleep_experiments,
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
    if tool_id == "block_calendar":
        result["api_call"] = "POST /calendar/v3/calendars/primary/events"
        result["sponsor"] = "Google Calendar"
    return result


# ─── Share to Sage (OpenClaw) ───

class ShareWorkoutRequest(BaseModel):
    workout_text: str
    format: str = ""
    duration_min: int = 0
    note: str = ""

@router.post("/share-workout")
async def share_workout(req: ShareWorkoutRequest):
    """Share workout to Sage via OpenClaw Gateway Tools Invoke API."""
    gateway_url = os.getenv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:18789")
    gateway_token = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")

    # Build the message
    message = f"**Tomorrow's Workout Plan**\n\n"
    if req.format:
        message += f"Format: {req.format}"
    if req.duration_min:
        message += f" | {req.duration_min} min"
    message += f"\n\n{req.workout_text}"
    if req.note:
        message += f"\n\n_{req.note}_"

    # If Gateway token is configured, send via Tools Invoke API
    if gateway_token:
        try:
            invoke_url = f"{gateway_url.rstrip('/')}/tools/invoke"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {gateway_token}",
            }
            payload = {
                "tool": "message.send",
                "input": {
                    "text": message,
                    "metadata": {
                        "source": "yu-restos",
                        "type": "workout_share",
                        "timestamp": datetime.now(ZoneInfo("America/New_York")).isoformat(),
                    },
                },
            }
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(invoke_url, json=payload, headers=headers)
                return {"status": "sent", "gateway_status": resp.status_code}
        except Exception as e:
            return {"status": "error", "detail": str(e), "message": message}

    # If not configured, return the formatted message so user can copy
    return {"status": "not_configured", "message": message, "hint": "Set OPENCLAW_GATEWAY_TOKEN env var to enable auto-send to Sage"}


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
