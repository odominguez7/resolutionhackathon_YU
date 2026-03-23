"""
Live Oura API client — fetches data directly from Oura's API
using the stored access token. Falls back to exported JSON if API fails.
"""

import os
import httpx
from datetime import datetime, timedelta

TOKEN = os.getenv("OURA_ACCESS_TOKEN", "")

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

BASE = "https://api.ouraring.com"
HEADERS = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}


async def fetch_oura(path: str, params: dict = None) -> list:
    """Fetch from Oura API with pagination."""
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


async def fetch_sleep_live(days_back: int = 730) -> list:
    """Fetch full sleep history from Oura API."""
    start = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = datetime.now().strftime("%Y-%m-%d")
    return await fetch_oura("/v2/usercollection/sleep", {"start_date": start, "end_date": end})


async def fetch_daily_sleep_live(days_back: int = 730) -> list:
    start = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = datetime.now().strftime("%Y-%m-%d")
    return await fetch_oura("/v2/usercollection/daily_sleep", {"start_date": start, "end_date": end})


async def fetch_daily_stress_live(days_back: int = 730) -> list:
    start = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = datetime.now().strftime("%Y-%m-%d")
    return await fetch_oura("/v2/usercollection/daily_stress", {"start_date": start, "end_date": end})


async def fetch_daily_readiness_live(days_back: int = 730) -> list:
    start = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = datetime.now().strftime("%Y-%m-%d")
    return await fetch_oura("/v2/usercollection/daily_readiness", {"start_date": start, "end_date": end})


async def fetch_workouts_live(days_back: int = 730) -> list:
    start = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    end = datetime.now().strftime("%Y-%m-%d")
    return await fetch_oura("/v2/usercollection/workout", {"start_date": start, "end_date": end})


def has_live_token() -> bool:
    return bool(TOKEN)
