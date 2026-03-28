"""
Google Calendar client — OAuth2 + event fetcher + mock fallback.
"""
import os
from datetime import datetime, timedelta

# In-memory token storage (hackathon scope)
_google_token = None
_google_credentials = None

# Load from .env file (same pattern as oura/live.py)
_ENV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".env"
)
_env_vars = {}
if os.path.exists(_ENV_PATH):
    with open(_ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                _env_vars[k.strip()] = v.strip()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", _env_vars.get("GOOGLE_CLIENT_ID", ""))
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", _env_vars.get("GOOGLE_CLIENT_SECRET", ""))
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/optimize/google/callback")
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


_pending_flow = None  # Store flow between auth URL and callback


def has_google_token() -> bool:
    return _google_credentials is not None


def _make_client_config():
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }


def get_auth_url() -> str:
    """Generate Google OAuth2 consent URL."""
    global _pending_flow
    if not GOOGLE_CLIENT_ID:
        return ""
    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_config(_make_client_config(), scopes=SCOPES)
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        url, _ = flow.authorization_url(prompt="consent", access_type="offline")
        _pending_flow = flow  # Store to reuse in callback
        return url
    except Exception as e:
        print(f"[Google Calendar] Auth URL error: {e}")
        return ""


def exchange_code(code: str) -> bool:
    """Exchange authorization code for credentials."""
    global _google_credentials, _pending_flow
    try:
        if _pending_flow:
            flow = _pending_flow
            _pending_flow = None
        else:
            # Fallback: create new flow without PKCE
            from google_auth_oauthlib.flow import Flow
            flow = Flow.from_client_config(_make_client_config(), scopes=SCOPES)
            flow.redirect_uri = GOOGLE_REDIRECT_URI
        flow.fetch_token(code=code)
        _google_credentials = flow.credentials
        print(f"[Google Calendar] Token acquired successfully")
        return True
    except Exception as e:
        print(f"[Google Calendar] Token exchange error: {e}")
        return False


def get_today_events() -> list[dict]:
    """Fetch today's calendar events. Tries: iCloud → Google → mock."""
    # Try iCloud first
    icloud = fetch_icloud_events()
    if icloud:
        return icloud
    # Then Google
    if has_google_token():
        return _fetch_real_events()
    return _mock_events()


def _fetch_real_events() -> list[dict]:
    """Fetch from Google Calendar API."""
    try:
        from googleapiclient.discovery import build
        service = build("calendar", "v3", credentials=_google_credentials)

        from zoneinfo import ZoneInfo
        boston_tz = ZoneInfo("America/New_York")
        now_boston = datetime.now(boston_tz)
        start_of_day = now_boston.replace(hour=0, minute=0, second=0).astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_of_day = now_boston.replace(hour=23, minute=59, second=59).astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")

        result = service.events().list(
            calendarId="primary",
            timeMin=start_of_day,
            timeMax=end_of_day,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = []
        for item in result.get("items", []):
            start = item.get("start", {})
            end = item.get("end", {})
            start_time = start.get("dateTime", start.get("date", ""))
            end_time = end.get("dateTime", end.get("date", ""))

            # Parse to HH:MM in Boston time
            try:
                from zoneinfo import ZoneInfo
                boston_tz = ZoneInfo("America/New_York")
                st = datetime.fromisoformat(start_time.replace("Z", "+00:00")).astimezone(boston_tz)
                et = datetime.fromisoformat(end_time.replace("Z", "+00:00")).astimezone(boston_tz)
                start_hm = st.strftime("%H:%M")
                end_hm = et.strftime("%H:%M")
            except Exception:
                continue

            attendees = len(item.get("attendees", []))
            events.append({
                "summary": item.get("summary", "No Title"),
                "start": start_hm,
                "end": end_hm,
                "attendees": attendees,
                "is_recurring": item.get("recurringEventId") is not None,
                "organizer": item.get("organizer", {}).get("email", ""),
            })

        return events
    except Exception as e:
        print(f"[Google Calendar] Fetch error: {e}")
        return _mock_events()


def _mock_events() -> list[dict]:
    """Realistic entrepreneur calendar for demo."""
    return [
        {"summary": "Morning Standup", "start": "09:00", "end": "09:15", "attendees": 4, "is_recurring": True, "organizer": "omar@yu.health"},
        {"summary": "YC Application Review", "start": "09:30", "end": "10:30", "attendees": 1, "is_recurring": False, "organizer": "omar@yu.health"},
        {"summary": "Sync", "start": "11:00", "end": "11:30", "attendees": 2, "is_recurring": True, "organizer": "team@yu.health"},
        {"summary": "Lunch", "start": "12:30", "end": "13:00", "attendees": 0, "is_recurring": False, "organizer": "omar@yu.health"},
        {"summary": "Investor Check-in", "start": "14:00", "end": "14:30", "attendees": 2, "is_recurring": True, "organizer": "investor@vc.com"},
        {"summary": "Product Sprint", "start": "15:00", "end": "16:30", "attendees": 3, "is_recurring": False, "organizer": "omar@yu.health"},
        {"summary": "1:1 with Co-founder", "start": "17:00", "end": "17:30", "attendees": 1, "is_recurring": True, "organizer": "omar@yu.health"},
    ]


# ─── iCloud Calendar Integration ───

ICLOUD_FEEDS = [
    "https://p159-caldav.icloud.com/published/2/MTUzNTQwOTA0MTE1MzU0MD8Z8Mp2aN73kFCTtS5H42-75ckNnegXSi2FZNGkoxla",
    "https://p159-caldav.icloud.com/published/2/MTUzNTQwOTA0MTE1MzU0MD8Z8Mp2aN73kFCTtS5H428kOw9_poKX4F0HJ8LFQRYiIqdW0aYHnSj00dL2PJ1j1xNyGZ8jglLpt0Vq48-RLb0",
    "https://p159-caldav.icloud.com/published/2/MTUzNTQwOTA0MTE1MzU0MD8Z8Mp2aN73kFCTtS5H429vzg5wO0i-Dhe6Sduasyx3IYyqXHXU1l4HzgylU2ugwQyvTHtzLo7mTwPEj-dDWOc",
]

_icloud_cache: dict = {"events": None, "fetched_at": None}
LOCAL_TZ = "America/New_York"


def fetch_icloud_events() -> list[dict]:
    """Fetch today's events from iCloud public calendar feeds."""
    from datetime import date
    import requests

    # Cache for 5 minutes
    from zoneinfo import ZoneInfo
    boston_tz = ZoneInfo("America/New_York")
    now = datetime.now(boston_tz)
    if _icloud_cache["events"] is not None and _icloud_cache["fetched_at"]:
        if (now - _icloud_cache["fetched_at"]).seconds < 300:
            return _icloud_cache["events"]

    try:
        from icalendar import Calendar as ICal
    except ImportError:
        print("[iCloud] icalendar not installed")
        return []

    today = datetime.now(boston_tz).date()
    all_events = []

    for feed_url in ICLOUD_FEEDS:
        try:
            resp = requests.get(feed_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
            if resp.status_code != 200 or len(resp.text) < 50:
                continue

            cal = ICal.from_ical(resp.text)
            cal_name = str(cal.get("X-WR-CALNAME", "iCloud"))

            from zoneinfo import ZoneInfo
            boston_tz = ZoneInfo("America/New_York")

            for comp in cal.walk():
                if comp.name == "VEVENT":
                    dtstart = comp.get("dtstart")
                    if not dtstart:
                        continue
                    dt = dtstart.dt

                    # Convert to Boston time
                    if isinstance(dt, datetime):
                        if dt.tzinfo is not None:
                            dt_local = dt.astimezone(boston_tz)
                        else:
                            # Naive datetimes from iCal are typically UTC
                            from zoneinfo import ZoneInfo as ZI
                            dt_local = dt.replace(tzinfo=ZI("UTC")).astimezone(boston_tz)
                        d = dt_local.date()
                    else:
                        dt_local = dt
                        d = dt

                    if d != today:
                        continue

                    summary = str(comp.get("summary", "No Title"))
                    dtend = comp.get("dtend")
                    end_dt = dtend.dt if dtend else None

                    # Convert end time to Boston too
                    if end_dt and isinstance(end_dt, datetime):
                        if end_dt.tzinfo is not None:
                            end_local = end_dt.astimezone(boston_tz)
                        else:
                            end_local = end_dt.replace(tzinfo=boston_tz)
                    else:
                        end_local = end_dt

                    attendees = comp.get("attendee", [])
                    if not isinstance(attendees, list):
                        attendees = [attendees] if attendees else []

                    if isinstance(dt_local, datetime):
                        start_hm = dt_local.strftime("%H:%M")
                        end_hm = end_local.strftime("%H:%M") if end_local and isinstance(end_local, datetime) else ""
                    else:
                        start_hm = "00:00"
                        end_hm = "23:59"

                    all_events.append({
                        "summary": summary,
                        "start": start_hm,
                        "end": end_hm,
                        "attendees": len(attendees),
                        "is_recurring": comp.get("rrule") is not None,
                        "organizer": str(comp.get("organizer", "")),
                        "calendar": cal_name,
                    })
        except Exception as e:
            print(f"[iCloud] Error fetching {feed_url[:60]}...: {e}")

    all_events.sort(key=lambda x: x["start"])
    _icloud_cache["events"] = all_events
    _icloud_cache["fetched_at"] = now
    print(f"[iCloud] Loaded {len(all_events)} events from {len(ICLOUD_FEEDS)} feeds")
    return all_events
