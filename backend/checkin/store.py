"""
Check-in storage with pre-seeded data.
When real Oura data is available, generates check-ins aligned with actual sleep dates
using stress data from Oura and deriving mood/energy from sleep + readiness scores.
"""

import json
import os
from datetime import datetime, timedelta


def _load_oura_file(filename):
    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "scripts", "oura_data", filename
    )
    if not os.path.exists(path):
        return []
    with open(path) as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _generate_oura_checkins():
    """Generate realistic check-ins from real Oura data."""
    daily_sleep = _load_oura_file("daily_sleep.json")
    daily_stress = _load_oura_file("daily_stress.json")
    daily_readiness = _load_oura_file("daily_readiness.json")
    sleep_sessions = _load_oura_file("sleep.json")

    if not daily_sleep:
        return None

    score_by_day = {d["day"]: d.get("score", 70) for d in daily_sleep}
    stress_by_day = {d["day"]: d for d in daily_stress}
    readiness_by_day = {d["day"]: d.get("score", 70) for d in daily_readiness}

    # Build HRV lookup from sleep sessions
    hrv_by_day = {}
    for s in sleep_sessions:
        if s.get("type") == "long_sleep" or s["day"] not in hrv_by_day:
            hrv_by_day[s["day"]] = s.get("average_hrv", 0)

    days = sorted(score_by_day.keys())[-14:]

    checkins = []
    for day in days:
        sleep_score = score_by_day.get(day, 70)
        readiness = readiness_by_day.get(day, 70)
        stress_data = stress_by_day.get(day, {})
        hrv = hrv_by_day.get(day, 35)

        # Derive mood from readiness + sleep score (1-10)
        mood = max(1, min(10, round((readiness + sleep_score) / 20)))

        # Derive energy from readiness (1-10)
        energy = max(1, min(10, round(readiness / 10)))

        # Derive stress from Oura stress data (1-10, inverted)
        stress_high = stress_data.get("stress_high", 0) or 0
        summary = stress_data.get("day_summary", "normal")
        if summary == "stressful":
            stress = max(7, min(10, 7 + int(stress_high / 7200)))
        elif summary == "normal":
            stress = max(3, min(6, 3 + int(stress_high / 5400)))
        else:
            stress = 3

        # Sleep quality self-report correlates with sleep score
        sleep_quality = max(1, min(10, round(sleep_score / 10)))

        checkins.append({
            "date": day,
            "mood": mood,
            "energy": energy,
            "stress": stress,
            "sleep_quality_self": sleep_quality,
            "notes": "",
        })

    return checkins


# Try to load from Oura, fall back to mock
_oura_checkins = _generate_oura_checkins()

if _oura_checkins:
    print(f"[YU RestOS] Using Oura-derived check-ins ({len(_oura_checkins)} days)")
    _STATIC_CHECKINS = _oura_checkins
else:
    print("[YU RestOS] Using mock check-in data")
    BASE_DATE = datetime(2026, 3, 14)
    MOCK_CHECKINS = {
        1:  (8, 8, 3, 8),
        2:  (7, 8, 3, 8),
        3:  (8, 9, 2, 9),
        4:  (7, 7, 4, 7),
        5:  (8, 8, 3, 8),
        6:  (7, 7, 4, 7),
        7:  (7, 6, 5, 7),
        8:  (6, 6, 6, 6),
        9:  (6, 5, 7, 5),
        10: (5, 4, 7, 5),
        11: (4, 4, 8, 4),
        12: (4, 3, 8, 3),
        13: (3, 3, 9, 3),
        14: (3, 2, 9, 2),
    }
    _STATIC_CHECKINS = []
    for day_num, (mood, energy, stress, sq) in MOCK_CHECKINS.items():
        day_date = BASE_DATE + timedelta(days=day_num - 1)
        _STATIC_CHECKINS.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "mood": mood,
            "energy": energy,
            "stress": stress,
            "sleep_quality_self": sq,
            "notes": "",
        })


def get_all_checkins() -> list[dict]:
    return _STATIC_CHECKINS


_live_checkins = {}


def save_checkin(data: dict):
    _live_checkins[data["date"]] = data


def get_checkin(date: str) -> dict | None:
    return _live_checkins.get(date)
