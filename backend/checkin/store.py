"""
Check-in storage with pre-seeded mock data matching the burnout arc.
Self-report scores correlate with (but slightly lag) Eight Sleep data.
"""

from datetime import datetime, timedelta

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


def get_all_checkins() -> list[dict]:
    results = []
    for day_num, (mood, energy, stress, sq) in MOCK_CHECKINS.items():
        day_date = BASE_DATE + timedelta(days=day_num - 1)
        results.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "mood": mood,
            "energy": energy,
            "stress": stress,
            "sleep_quality_self": sq,
            "notes": "",
        })
    return results


_live_checkins = {}


def save_checkin(data: dict):
    _live_checkins[data["date"]] = data


def get_checkin(date: str) -> dict | None:
    return _live_checkins.get(date)
