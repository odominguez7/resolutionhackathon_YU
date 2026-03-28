"""
iCloud Calendar integration via CalDAV.
Pulls events from the user's iCloud calendar for planning.
"""

import os
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Request

router = APIRouter()

BOSTON_TZ = ZoneInfo("America/New_York")


def _load_creds():
    env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env"
    )
    apple_id = os.getenv("APPLE_ID", "")
    apple_pw = os.getenv("APPLE_APP_PASSWORD", "")
    if not apple_id and os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("APPLE_ID="):
                    apple_id = line.split("=", 1)[1].strip()
                elif line.startswith("APPLE_APP_PASSWORD="):
                    apple_pw = line.split("=", 1)[1].strip()
    return apple_id, apple_pw


def _connect():
    import caldav
    apple_id, apple_pw = _load_creds()
    if not apple_id or not apple_pw:
        return None
    return caldav.DAVClient(
        url="https://caldav.icloud.com",
        username=apple_id,
        password=apple_pw,
    )


def _parse_event(event):
    """Parse a caldav event into a simple dict."""
    try:
        vevent = event.vobject_instance.vevent
        summary = str(vevent.summary.value) if hasattr(vevent, "summary") else "No title"
        dtstart = vevent.dtstart.value
        dtend = vevent.dtend.value if hasattr(vevent, "dtend") else None
        location = str(vevent.location.value) if hasattr(vevent, "location") else None
        description = str(vevent.description.value) if hasattr(vevent, "description") else None

        if isinstance(dtstart, datetime):
            start_str = dtstart.astimezone(BOSTON_TZ).isoformat()
            end_str = dtend.astimezone(BOSTON_TZ).isoformat() if dtend and isinstance(dtend, datetime) else None
            all_day = False
        elif isinstance(dtstart, date):
            start_str = dtstart.isoformat()
            end_str = dtend.isoformat() if dtend else None
            all_day = True
        else:
            start_str = str(dtstart)
            end_str = str(dtend) if dtend else None
            all_day = False

        return {
            "title": summary,
            "start": start_str,
            "end": end_str,
            "allDay": all_day,
            "location": location,
            "description": description,
        }
    except Exception as e:
        print(f"[Calendar] Failed to parse event: {e}")
        return None


@router.get("/status")
def calendar_status():
    apple_id, apple_pw = _load_creds()
    return {
        "configured": bool(apple_id and apple_pw),
        "apple_id": apple_id[:3] + "***" if apple_id else None,
    }


@router.get("/calendars")
def list_calendars():
    client = _connect()
    if not client:
        return {"error": "No iCloud credentials. Add APPLE_ID and APPLE_APP_PASSWORD to .env"}
    try:
        principal = client.principal()
        calendars = principal.calendars()
        return {
            "calendars": [
                {"name": cal.get_display_name(), "url": str(cal.url)}
                for cal in calendars
            ]
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/events")
def get_events(days: int = 7, calendar_name: str = None):
    """Get events for the next N days."""
    client = _connect()
    if not client:
        return {"error": "No iCloud credentials configured."}

    try:
        principal = client.principal()
        calendars = principal.calendars()

        now = datetime.now(BOSTON_TZ)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=days)

        all_events = []

        for cal in calendars:
            cal_name = cal.get_display_name()
            if calendar_name and cal_name != calendar_name:
                continue
            try:
                events = cal.search(start=start, end=end, event=True, expand=True)
                for event in events:
                    parsed = _parse_event(event)
                    if parsed:
                        parsed["calendar"] = cal_name
                        all_events.append(parsed)
            except Exception as e:
                print(f"[Calendar] Error fetching from {cal_name}: {e}")

        all_events.sort(key=lambda e: e["start"])

        return {
            "events": all_events,
            "totalEvents": len(all_events),
            "dateRange": {"start": start.isoformat(), "end": end.isoformat()},
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/today")
def get_today_events():
    return get_events(days=1)


@router.get("/week")
def get_week_events():
    return get_events(days=7)


@router.get("/analyze")
async def analyze_week():
    """Use Gemini to analyze the upcoming week and generate actionable insights."""
    import httpx

    # Get events
    week = get_events(days=7)
    events = week.get("events", [])
    if not events:
        return {"insight": "No events found. Your week is wide open.", "events": []}

    # Build event summary for Gemini
    event_lines = []
    for e in events:
        day = e.get("start", "")[:10]
        time = ""
        if not e.get("allDay") and "T" in e.get("start", ""):
            from datetime import datetime as dt
            try:
                t = dt.fromisoformat(e["start"])
                time = t.strftime("%-I:%M %p")
            except:
                time = ""
        event_lines.append(f"- {day} {time}: {e['title']}")

    events_text = "\n".join(event_lines)

    # Load Gemini key
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            ".env"
        )
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.strip().startswith("GEMINI_API_KEY="):
                        gemini_key = line.strip().split("=", 1)[1].strip()

    if not gemini_key:
        return {"error": "No Gemini API key configured"}

    prompt = f"""You are YU, an AI wellness planner for a busy MIT grad student and startup founder.

Here are their calendar events for the next 7 days:

{events_text}

Analyze this schedule and provide:

1. **Week Overview** (1-2 sentences): How intense is this week? What's the vibe?
2. **Busiest Day**: Which day is the most packed and what should they watch out for?
3. **Recovery Windows**: When are the best gaps to schedule workouts and recovery?
4. **Sleep Strategy**: Based on this schedule, what nights are critical for good sleep and why?
5. **One Action**: The single most impactful thing they should do this week to stay on top of everything.

Rules:
- Write in plain, direct language. No medical jargon. Talk like a smart friend.
- Keep the total response under 200 words.
- Be specific about days and events, not generic.
- This person pushes themselves hard. Acknowledge that while helping them recover.
- Format as JSON with keys: weekOverview, busiestDay, recoveryWindows, sleepStrategy, oneAction (all strings)"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"},
                }
            )
            if resp.status_code != 200:
                return {"error": f"Gemini API error: {resp.status_code}"}

            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]

            import json as json_mod
            analysis = json_mod.loads(text)
            return {"analysis": analysis, "eventCount": len(events)}

    except Exception as e:
        return {"error": str(e)}


@router.post("/chat")
async def chat_with_calendar(request: Request):
    """Interactive chat about your calendar, powered by Gemini."""
    import httpx

    body = await request.json()
    user_message = body.get("message", "")
    if not user_message:
        return {"error": "No message provided"}

    # Get events and biometric context
    week = get_events(days=7)
    events = week.get("events", [])

    event_lines = []
    for e in events:
        day = e.get("start", "")[:10]
        time = ""
        if not e.get("allDay") and "T" in e.get("start", ""):
            from datetime import datetime as dt
            try:
                t = dt.fromisoformat(e["start"])
                time = t.strftime("%-I:%M %p")
            except:
                time = ""
        event_lines.append(f"- {day} {time}: {e['title']}" + (f" @ {e['location']}" if e.get('location') else ""))
    events_text = "\n".join(event_lines) if event_lines else "No events this week."

    # Get biometric context
    biometric_context = body.get("biometrics", "")

    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            ".env"
        )
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.strip().startswith("GEMINI_API_KEY="):
                        gemini_key = line.strip().split("=", 1)[1].strip()

    if not gemini_key:
        return {"error": "No Gemini API key"}

    prompt = f"""You are YU, an AI wellness assistant for a busy MIT grad student and startup founder (YC applicant). Today is {datetime.now(BOSTON_TZ).strftime('%A, %B %d, %Y')}.

CALENDAR (next 7 days):
{events_text}

BIOMETRICS:
{biometric_context}

USER QUESTION: {user_message}

Rules:
- You are the user's advocate. Your #1 job is protecting their health and performance.
- Be direct and specific. Reference actual events by name.
- If they're overloaded, suggest what to cancel or reschedule. Be bold about it.
- Connect everything to sleep: late events hurt tomorrow's performance.
- If suggesting canceling, explain what they gain (recovery time, better sleep, sharper mind tomorrow).
- Keep responses under 120 words. Be punchy, not preachy.
- Never use medical jargon. Talk like a smart friend who genuinely cares.
- You can suggest rescheduling, adding recovery blocks, or skipping optional events.
- Always end with a concrete action they can take right now."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}",
                json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.8}},
            )
            if resp.status_code != 200:
                return {"error": f"Gemini error: {resp.status_code}"}
            data = resp.json()
            reply = data["candidates"][0]["content"]["parts"][0]["text"]
            return {"reply": reply}
    except Exception as e:
        return {"error": str(e)}


@router.post("/credentials")
async def set_credentials(request: Request):
    body = await request.json()
    apple_id = body.get("apple_id", "")
    apple_pw = body.get("apple_app_password", "")

    if not apple_id or not apple_pw:
        return {"error": "Both apple_id and apple_app_password are required"}

    env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env"
    )

    existing = ""
    if os.path.exists(env_path):
        with open(env_path) as f:
            existing = f.read()

    lines = [l for l in existing.splitlines()
             if not l.startswith("APPLE_ID=") and not l.startswith("APPLE_APP_PASSWORD=")]
    lines.append(f"APPLE_ID={apple_id}")
    lines.append(f"APPLE_APP_PASSWORD={apple_pw}")

    with open(env_path, "w") as f:
        f.write("\n".join(lines) + "\n")

    os.environ["APPLE_ID"] = apple_id
    os.environ["APPLE_APP_PASSWORD"] = apple_pw

    try:
        client = _connect()
        principal = client.principal()
        cals = principal.calendars()
        return {
            "status": "ok",
            "message": f"Connected. Found {len(cals)} calendars.",
            "calendars": [c.get_display_name() for c in cals],
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
