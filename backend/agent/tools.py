"""
Agent Tools — structured tool definitions the YU agent can call.

Each tool follows a name/description/parameters/execute pattern compatible
with MCP and OpenAI function-calling conventions. The agent's LLM planner
selects which tools to invoke based on drift state and history.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


# ── Tool registry ──────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "get_biometrics",
        "description": "Get latest biometric data from Oura Ring including sleep, HRV, readiness, stress, and activity.",
        "parameters": {"days": "int, number of days to retrieve (default 7)"},
    },
    {
        "name": "detect_drift",
        "description": "Run drift detection algorithm against 30-day behavioral baseline. Returns severity, drivers, and consecutive days.",
        "parameters": {},
    },
    {
        "name": "send_coaching",
        "description": "Generate and deliver a CBT-grounded micro-intervention message based on drift drivers.",
        "parameters": {
            "drift_drivers": "list of metric names causing drift",
            "severity": "high | medium | low",
            "focus": "sleep | stress | recovery | energy",
        },
    },
    {
        "name": "block_calendar",
        "description": "Block recovery time on user's calendar. Use for wind-down, rest, or protected recovery windows.",
        "parameters": {
            "title": "str, event title",
            "start_hour": "int, 0-23",
            "duration_min": "int, duration in minutes",
        },
    },
    {
        "name": "sleep_protocol",
        "description": "Deliver a sleep hygiene protocol based on drift drivers. Covers temperature, light, timing, and wind-down.",
        "parameters": {
            "focus": "temperature | light | timing | wind_down",
        },
    },
    {
        "name": "recommend_workout",
        "description": "Adjust workout recommendation based on recovery state. Lower intensity when drift is detected.",
        "parameters": {
            "intensity": "light | moderate | heavy",
            "type": "active_recovery | strength | cardio | yoga",
        },
    },
    {
        "name": "no_action",
        "description": "Explicitly decide not to intervene. Use when baseline is stable or drift is resolving.",
        "parameters": {
            "reason": "str, why no action is needed",
        },
    },
]


# ── Tool executors ─────────────────────────────────────────────────────────

def execute_get_biometrics(params: dict) -> dict:
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data()
    days = params.get("days", 7)
    recent = daily[-days:] if len(daily) >= days else daily
    if not recent:
        return {"error": "No biometric data available"}

    latest = recent[-1]
    return {
        "latest": latest,
        "days_available": len(recent),
        "date_range": f"{recent[0]['day']} to {recent[-1]['day']}",
        "averages": {
            "hrv": round(sum(d["hrv"] for d in recent if d.get("hrv")) / max(1, sum(1 for d in recent if d.get("hrv"))), 1),
            "sleep_score": round(sum(d["sleepScore"] for d in recent) / len(recent), 1),
            "readiness": round(sum(d["readinessScore"] for d in recent) / len(recent), 1),
            "rhr": round(sum(d["avgHeartRate"] for d in recent if d.get("avgHeartRate")) / max(1, sum(1 for d in recent if d.get("avgHeartRate"))), 1),
        },
    }


def execute_detect_drift(params: dict) -> dict:
    from backend.drift.routes import _build_daily_data
    from backend.drift.engine import detect_drift_real
    daily = _build_daily_data()
    return detect_drift_real(daily)


def execute_send_coaching(params: dict) -> dict:
    drivers = params.get("drift_drivers", [])
    severity = params.get("severity", "medium")
    focus = params.get("focus", "recovery")

    coaching_library = {
        "sleep": {
            "high": "Your sleep architecture is breaking down. Tonight: no screens after 9 PM, bedroom at 65F, lights out by 10:30. This is non-negotiable recovery.",
            "medium": "Sleep quality is slipping. Try a 10-minute body scan before bed tonight. Your nervous system needs a clear signal that the day is over.",
            "low": "Minor sleep disruption detected. Keep your wake time consistent tomorrow morning, even if you slept poorly. Consistency beats catch-up sleep.",
        },
        "stress": {
            "high": "Stress has been elevated for days. Your cortisol is likely suppressing deep sleep. Take 5 minutes right now: box breathing, 4 counts in, 4 hold, 4 out, 4 hold. Repeat 6 cycles.",
            "medium": "Stress accumulation detected. Block 20 minutes today for a walk outside. Sunlight + movement is the fastest cortisol reset.",
            "low": "Mild stress elevation. Check your caffeine timing. No coffee after 2 PM lets your adenosine build naturally for better sleep.",
        },
        "recovery": {
            "high": "Your body is not recovering between days. Drop workout intensity by 40% for the next 48 hours. Active recovery only: walking, stretching, mobility.",
            "medium": "Recovery is lagging. Consider swapping tomorrow's workout for yoga or a long walk. Your HRV will thank you.",
            "low": "Recovery is slightly below baseline. Add 10 minutes of stretching after your next workout. Small inputs compound.",
        },
        "energy": {
            "high": "Energy is consistently low. Check: are you eating enough? Underfueling + training = metabolic slowdown. Add 200 calories today, preferably protein.",
            "medium": "Energy dipping. Move your hardest task to your peak energy window (typically 9-11 AM). Don't fight your circadian rhythm.",
            "low": "Slight energy decline. Hydrate more aggressively today. 2% dehydration = 10% energy drop.",
        },
    }

    message = coaching_library.get(focus, coaching_library["recovery"]).get(
        severity, coaching_library["recovery"]["medium"]
    )

    return {
        "message": message,
        "type": "cbt_micro_intervention",
        "focus": focus,
        "severity": severity,
        "delivered_at": datetime.now(BOSTON_TZ).isoformat(),
    }


def execute_block_calendar(params: dict) -> dict:
    title = params.get("title", "Recovery Time (YU)")
    start_hour = params.get("start_hour", 21)
    duration = params.get("duration_min", 60)
    return {
        "status": "blocked",
        "event": {
            "title": title,
            "start": f"{datetime.now(BOSTON_TZ).strftime('%Y-%m-%d')}T{start_hour:02d}:00:00",
            "duration_min": duration,
        },
        "executed_at": datetime.now(BOSTON_TZ).isoformat(),
    }


def execute_sleep_protocol(params: dict) -> dict:
    focus = params.get("focus", "temperature")
    protocols = {
        "temperature": "Keep bedroom at 65-68F (18-20C). Your body needs to drop 2-3 degrees to enter deep sleep. If you run hot, try lighter bedding or a fan.",
        "light": "No screens 45 min before bed. If you must use your phone, enable night mode. Total darkness during sleep. Even small LED lights disrupt melatonin.",
        "timing": "Go to bed and wake up at the same time every day, including weekends. Your circadian rhythm needs consistency more than extra hours.",
        "wind_down": "Start a wind-down routine 60 min before bed: dim lights, no work, no news. Try 10 min of reading or a body scan meditation.",
    }
    return {
        "status": "delivered",
        "protocol": focus,
        "message": protocols.get(focus, protocols["temperature"]),
        "delivered_at": datetime.now(BOSTON_TZ).isoformat(),
    }


def execute_recommend_workout(params: dict) -> dict:
    intensity = params.get("intensity", "light")
    wtype = params.get("type", "active_recovery")
    return {
        "status": "recommended",
        "workout": {
            "intensity": intensity,
            "type": wtype,
            "note": f"Agent adjusted workout to {intensity} {wtype} based on recovery state",
        },
        "executed_at": datetime.now(BOSTON_TZ).isoformat(),
    }


def execute_no_action(params: dict) -> dict:
    return {
        "status": "no_action",
        "reason": params.get("reason", "Baseline stable"),
        "timestamp": datetime.now(BOSTON_TZ).isoformat(),
    }


# ── Dispatcher ─────────────────────────────────────────────────────────────

TOOL_EXECUTORS = {
    "get_biometrics": execute_get_biometrics,
    "detect_drift": execute_detect_drift,
    "send_coaching": execute_send_coaching,
    "block_calendar": execute_block_calendar,
    "sleep_protocol": execute_sleep_protocol,
    "recommend_workout": execute_recommend_workout,
    "no_action": execute_no_action,
}


def run_tool(name: str, params: dict) -> dict:
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return {"error": f"Unknown tool: {name}"}
    return executor(params)
