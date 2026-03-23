"""
Oura Data Export — Pull all available data from your Oura Ring.

Usage:
    python scripts/oura_export.py

Reads OURA_ACCESS_TOKEN from .env file.
Exports everything to scripts/oura_data/ as JSON files.
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta

# Load token from .env
ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
TOKEN = None

if os.path.exists(ENV_PATH):
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if line.startswith("OURA_ACCESS_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip()

if not TOKEN:
    if len(sys.argv) > 1:
        TOKEN = sys.argv[1]
    else:
        print("ERROR: No OURA_ACCESS_TOKEN found in .env or as argument")
        print("Run: python scripts/oura_auth.py <client_id> <client_secret>")
        sys.exit(1)

BASE = "https://api.ouraring.com"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# Date range: FULL HISTORY (go back 2 years)
END_DATE = datetime.now().strftime("%Y-%m-%d")
START_DATE = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

# For heartrate, use datetime format (last 30 days — too much data otherwise)
END_DT = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
START_DT = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oura_data")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def fetch_paginated(url, params=None):
    """Fetch all pages of a paginated endpoint."""
    all_data = []
    next_token = None

    while True:
        p = dict(params or {})
        if next_token:
            p["next_token"] = next_token

        resp = requests.get(url, headers=HEADERS, params=p)
        if resp.status_code != 200:
            print(f"  ERROR {resp.status_code}: {resp.text[:200]}")
            break

        data = resp.json()
        items = data.get("data", [])
        all_data.extend(items)

        next_token = data.get("next_token")
        if not next_token:
            break

    return all_data


def export_endpoint(name, path, params, filename):
    """Export a single endpoint to JSON."""
    print(f"Fetching {name}...", end=" ", flush=True)
    data = fetch_paginated(f"{BASE}{path}", params)
    print(f"{len(data)} records")

    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

    return data


print(f"=== Oura Data Export ===")
print(f"Date range: {START_DATE} to {END_DATE}")
print(f"Output: {OUTPUT_DIR}\n")

# ── Personal Info ──
print("Fetching personal_info...", end=" ", flush=True)
resp = requests.get(f"{BASE}/v2/usercollection/personal_info", headers=HEADERS)
if resp.status_code == 200:
    pi = resp.json()
    print("OK")
    with open(os.path.join(OUTPUT_DIR, "personal_info.json"), "w") as f:
        json.dump(pi, f, indent=2)
else:
    print(f"ERROR {resp.status_code}")

# ── Sleep (detailed sessions) ──
sleep_data = export_endpoint(
    "sleep sessions",
    "/v2/usercollection/sleep",
    {"start_date": START_DATE, "end_date": END_DATE},
    "sleep.json"
)

# ── Daily Sleep (scores) ──
export_endpoint(
    "daily sleep scores",
    "/v2/usercollection/daily_sleep",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_sleep.json"
)

# ── Daily Readiness ──
export_endpoint(
    "daily readiness",
    "/v2/usercollection/daily_readiness",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_readiness.json"
)

# ── Daily Activity ──
export_endpoint(
    "daily activity",
    "/v2/usercollection/daily_activity",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_activity.json"
)

# ── Daily Stress ──
export_endpoint(
    "daily stress",
    "/v2/usercollection/daily_stress",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_stress.json"
)

# ── Daily Resilience ──
export_endpoint(
    "daily resilience",
    "/v2/usercollection/daily_resilience",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_resilience.json"
)

# ── Daily SpO2 ──
export_endpoint(
    "daily SpO2",
    "/v2/usercollection/daily_spo2",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_spo2.json"
)

# ── Daily Cardiovascular Age ──
export_endpoint(
    "cardiovascular age",
    "/v2/usercollection/daily_cardiovascular_age",
    {"start_date": START_DATE, "end_date": END_DATE},
    "daily_cardiovascular_age.json"
)

# ── VO2 Max ──
export_endpoint(
    "VO2 max",
    "/v2/usercollection/vO2_max",
    {"start_date": START_DATE, "end_date": END_DATE},
    "vo2_max.json"
)

# ── Heart Rate (14 days, uses datetime) ──
export_endpoint(
    "heart rate",
    "/v2/usercollection/heartrate",
    {"start_datetime": START_DT, "end_datetime": END_DT},
    "heartrate.json"
)

# ── Workouts ──
export_endpoint(
    "workouts",
    "/v2/usercollection/workout",
    {"start_date": START_DATE, "end_date": END_DATE},
    "workouts.json"
)

# ── Sessions ──
export_endpoint(
    "sessions",
    "/v2/usercollection/session",
    {"start_date": START_DATE, "end_date": END_DATE},
    "sessions.json"
)

# ── Sleep Time ──
export_endpoint(
    "sleep time",
    "/v2/usercollection/sleep_time",
    {"start_date": START_DATE, "end_date": END_DATE},
    "sleep_time.json"
)

# ── Ring Configuration ──
export_endpoint(
    "ring configuration",
    "/v2/usercollection/ring_configuration",
    {"start_date": START_DATE, "end_date": END_DATE},
    "ring_configuration.json"
)

# ── Tags ──
export_endpoint(
    "tags",
    "/v2/usercollection/tag",
    {"start_date": START_DATE, "end_date": END_DATE},
    "tags.json"
)

# ── Enhanced Tags ──
export_endpoint(
    "enhanced tags",
    "/v2/usercollection/enhanced_tag",
    {"start_date": START_DATE, "end_date": END_DATE},
    "enhanced_tags.json"
)

# ── Summary ──
print(f"\n=== Export Complete ===")
print(f"Files saved to: {OUTPUT_DIR}")
files = os.listdir(OUTPUT_DIR)
for f in sorted(files):
    size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
    print(f"  {f:40} {size:>10,} bytes")

# ── Quick data summary ──
if sleep_data:
    print(f"\n=== Sleep Data Summary (last 30 days) ===")
    for s in sleep_data[-5:]:
        day = s.get("day", "?")
        score = s.get("readiness", {}).get("score", "?") if "readiness" in s else "?"
        avg_hr = s.get("average_heart_rate", "?")
        avg_hrv = s.get("average_hrv", "?")
        deep = s.get("deep_sleep_duration", 0)
        rem = s.get("rem_sleep_duration", 0)
        total = s.get("total_sleep_duration", 0)
        print(f"  {day}: HR={avg_hr}, HRV={avg_hrv}, Deep={deep//60}m, REM={rem//60}m, Total={total//3600}h{(total%3600)//60}m")
