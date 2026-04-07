"""
Live Oura API client — fetches data directly from Oura's API
using the stored access token. Falls back to exported JSON if API fails.
"""

import os
import httpx
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

TOKEN = os.getenv("OURA_ACCESS_TOKEN", "")
REFRESH_TOKEN = os.getenv("OURA_REFRESH_TOKEN", "")

# Also try loading from .env file if not in environment
if not TOKEN:
    env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env"
    )
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("OURA_ACCESS_TOKEN="):
                    TOKEN = line.split("=", 1)[1].strip()
                elif line.startswith("OURA_REFRESH_TOKEN="):
                    REFRESH_TOKEN = line.split("=", 1)[1].strip()

BASE = "https://api.ouraring.com"
HEADERS = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
_token_refreshed = False


def _ensure_token():
    """Refresh the access token from refresh token if needed. Called before each API request."""
    global TOKEN, REFRESH_TOKEN, HEADERS, _token_refreshed
    if TOKEN or _token_refreshed:
        return
    _token_refreshed = True  # only try once per container lifetime

    rt = REFRESH_TOKEN
    # Try loading a fresher token from storage
    stored_rt = _load_persisted_refresh_token()
    if stored_rt:
        rt = stored_rt
        REFRESH_TOKEN = stored_rt
    if not rt:
        return

    _client_id = os.getenv("OURA_CLIENT_ID", "")
    _client_secret = os.getenv("OURA_CLIENT_SECRET", "")
    if not _client_id or not _client_secret:
        return

    try:
        resp = httpx.post("https://api.ouraring.com/oauth/token", data={
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": _client_id,
            "client_secret": _client_secret,
        }, timeout=15)
        print(f"[Oura] Token refresh response: {resp.status_code}")
        if resp.status_code == 200:
            td = resp.json()
            TOKEN = td.get("access_token", "")
            new_rt = td.get("refresh_token", "")
            if new_rt:
                REFRESH_TOKEN = new_rt
                # Persist the rotated refresh token to Cloud Run env var
                _persist_refresh_token(new_rt)
            HEADERS = {"Authorization": f"Bearer {TOKEN}"}
            print(f"[Oura] Auto-refreshed access token successfully")
        else:
            print(f"[Oura] Failed to refresh token: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[Oura] Token refresh error: {e}")


def _persist_refresh_token(new_token: str):
    """Save refresh token to Cloud Storage so it survives cold starts."""
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket("yu-restos-tokens")
        # Create bucket if it doesn't exist
        if not bucket.exists():
            bucket = client.create_bucket("yu-restos-tokens", location="us-east1")
        blob = bucket.blob("oura_refresh_token")
        blob.upload_from_string(new_token)
        print(f"[Oura] Saved refresh token to Cloud Storage")
    except Exception as e:
        print(f"[Oura] Could not persist refresh token to GCS: {e}")
        # Fallback: save to /tmp (survives within same container instance)
        try:
            with open("/tmp/oura_refresh_token", "w") as f:
                f.write(new_token)
            print(f"[Oura] Saved refresh token to /tmp fallback")
        except Exception:
            pass


def _load_persisted_refresh_token() -> str:
    """Load refresh token from Cloud Storage or /tmp fallback."""
    # Try GCS first
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket("yu-restos-tokens")
        blob = bucket.blob("oura_refresh_token")
        if blob.exists():
            token = blob.download_as_text().strip()
            if token:
                print(f"[Oura] Loaded refresh token from Cloud Storage")
                return token
    except Exception as e:
        print(f"[Oura] Could not load from GCS: {e}")

    # Try /tmp fallback
    try:
        with open("/tmp/oura_refresh_token") as f:
            token = f.read().strip()
            if token:
                print(f"[Oura] Loaded refresh token from /tmp")
                return token
    except Exception:
        pass

    return ""


async def fetch_oura(path: str, params: dict = None) -> list:
    """Fetch from Oura API with pagination."""
    _ensure_token()
    if not TOKEN:
        return []

    all_data = []
    next_token = None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                p = dict(params or {})
                if next_token:
                    p["next_token"] = next_token

                resp = await client.get(f"{BASE}{path}", headers=HEADERS, params=p)
                if resp.status_code != 200:
                    break

                data = resp.json()
                items = data.get("data", [])
                all_data.extend(items)

                next_token = data.get("next_token")
                if not next_token:
                    break
    except Exception as e:
        print(f"[Oura Live] Error fetching {path}: {e}")

    return all_data


def _date_range(days_back: int = 730):
    """Return start/end dates in Boston time. end_date is tomorrow to include today (Oura uses exclusive end)."""
    now = datetime.now(BOSTON_TZ)
    start = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    return start, end


async def fetch_sleep_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/sleep", {"start_date": start, "end_date": end})


async def fetch_daily_sleep_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_sleep", {"start_date": start, "end_date": end})


async def fetch_daily_stress_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_stress", {"start_date": start, "end_date": end})


async def fetch_daily_readiness_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_readiness", {"start_date": start, "end_date": end})


async def fetch_workouts_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/workout", {"start_date": start, "end_date": end})


async def fetch_daily_activity_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_activity", {"start_date": start, "end_date": end})


async def fetch_daily_resilience_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_resilience", {"start_date": start, "end_date": end})


async def fetch_daily_spo2_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_spo2", {"start_date": start, "end_date": end})


async def fetch_heartrate_live(days_back: int = 30) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/heartrate", {"start_date": start, "end_date": end})


async def fetch_cardiovascular_age_live(days_back: int = 730) -> list:
    start, end = _date_range(days_back)
    return await fetch_oura("/v2/usercollection/daily_cardiovascular_age", {"start_date": start, "end_date": end})


def has_live_token() -> bool:
    _ensure_token()
    return bool(TOKEN)
