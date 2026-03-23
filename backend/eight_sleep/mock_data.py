"""
Mock data generator for Eight Sleep integration.
Generates a 14-day "burnout arc" — healthy baseline degrading into
detectable drift, which triggers YU RestOS intervention.

Data structures match pyEight V2 API exactly.
"""

from datetime import datetime, timedelta
import random
import math

BASE_DATE = datetime(2026, 3, 14)  # 14 days before hackathon

# ── THE BURNOUT ARC ──────────────────────────────────────────
# Days 1-5:   Healthy baseline (sleep score 80-90, HRV 45-55ms)
# Days 6-8:   Stress onset (sleep score 70-78, HRV 38-42)
# Days 9-11:  Degradation (sleep score 55-68, HRV 30-36)
# Days 12-14: Drift alert zone (sleep score <60, HRV <30)

BURNOUT_ARC = {
    1:  (87, 52, 0.22, 0.25, 4,  0.0),
    2:  (85, 50, 0.21, 0.24, 5,  0.0),
    3:  (89, 54, 0.23, 0.26, 3,  0.0),
    4:  (83, 48, 0.20, 0.23, 6,  0.0),
    5:  (86, 51, 0.22, 0.25, 4,  0.0),
    6:  (78, 42, 0.18, 0.22, 8,  0.5),
    7:  (74, 40, 0.16, 0.20, 10, 0.8),
    8:  (70, 38, 0.15, 0.19, 12, 1.0),
    9:  (65, 35, 0.13, 0.17, 14, 1.2),
    10: (62, 33, 0.12, 0.16, 16, 1.5),
    11: (58, 31, 0.11, 0.15, 18, 1.8),
    12: (55, 28, 0.10, 0.14, 20, 2.0),
    13: (52, 26, 0.09, 0.13, 22, 2.2),
    14: (48, 24, 0.08, 0.12, 24, 2.5),
}


def _generate_timeseries(base_date: datetime, base_val: float, noise: float, count: int = 120):
    """Generate sleep-session timeseries (one point every ~3-4 min over 7hrs)."""
    points = []
    start = base_date.replace(hour=23, minute=30)
    for i in range(count):
        ts = start + timedelta(minutes=i * 3.5)
        val = base_val + random.gauss(0, noise)
        points.append([int(ts.timestamp() * 1000), round(val, 1)])
    return points


def _generate_stages(deep_pct: float, rem_pct: float, total_seconds: int = 27000):
    """Generate sleep stage breakdown from target percentages."""
    awake_pct = random.uniform(0.03, 0.06)
    out_pct = random.uniform(0.01, 0.03)
    light_pct = 1.0 - deep_pct - rem_pct - awake_pct - out_pct

    return [
        {"stage": "awake", "duration": int(total_seconds * awake_pct)},
        {"stage": "light", "duration": int(total_seconds * light_pct)},
        {"stage": "deep", "duration": int(total_seconds * deep_pct)},
        {"stage": "rem", "duration": int(total_seconds * rem_pct)},
        {"stage": "out", "duration": int(total_seconds * out_pct)},
    ]


def generate_intervals() -> list[dict]:
    """Generate 14 days of sleep interval data matching pyEight format."""
    intervals = []
    for day_num, (score, hrv, deep_pct, rem_pct, tnt, temp_off) in BURNOUT_ARC.items():
        day_date = BASE_DATE + timedelta(days=day_num - 1)
        base_hr = 58 + (14 - score / 10)
        base_rr = 14.0 + (14 - score / 20)
        base_bed = 27.5 + temp_off
        base_room = 21.0 + temp_off * 0.3

        intervals.append({
            "ts": day_date.replace(hour=23, minute=30).isoformat() + "Z",
            "score": score,
            "incomplete": False,
            "stages": _generate_stages(deep_pct, rem_pct),
            "heartRate": _generate_timeseries(day_date, base_hr, 2.0),
            "respiratoryRate": _generate_timeseries(day_date, base_rr, 0.5),
            "tempBedC": _generate_timeseries(day_date, base_bed, 0.3),
            "tempRoomC": _generate_timeseries(day_date, base_room, 0.2),
            "tnt": tnt,
            "hrv": hrv,
        })
    return intervals


def generate_trends() -> list[dict]:
    """Generate 14 days of trend data matching pyEight format."""
    trends = []
    for day_num, (score, hrv, deep_pct, rem_pct, tnt, temp_off) in BURNOUT_ARC.items():
        day_date = BASE_DATE + timedelta(days=day_num - 1)

        duration_score = max(40, score + random.randint(-5, 5))
        latency_asleep = max(35, score - random.randint(0, 10))
        latency_out = max(38, score - random.randint(0, 8))
        wakeup_consistency = max(30, score - random.randint(5, 15))

        trends.append({
            "day": day_date.strftime("%Y-%m-%d"),
            "sleepFitnessScore": {
                "total": int((duration_score + latency_asleep + latency_out + wakeup_consistency) / 4),
                "sleepDurationSeconds": {"score": duration_score},
                "latencyAsleepSeconds": {"score": latency_asleep},
                "latencyOutSeconds": {"score": latency_out},
                "wakeupConsistency": {"score": wakeup_consistency},
            },
            "sleepScore": score,
            "hrv": hrv,
            "avgHeartRate": round(58 + (14 - score / 10) + random.gauss(0, 1), 1),
            "avgRespRate": round(14.0 + (14 - score / 20) + random.gauss(0, 0.3), 1),
            "avgBedTempC": round(27.5 + temp_off + random.gauss(0, 0.2), 1),
            "avgRoomTempC": round(21.0 + temp_off * 0.3 + random.gauss(0, 0.1), 1),
            "tnt": tnt,
            "deepSleepPct": round(deep_pct, 3),
            "remSleepPct": round(rem_pct, 3),
            "lightSleepPct": round(1.0 - deep_pct - rem_pct - 0.05, 3),
            "awakePct": round(0.05, 3),
            "totalSleepSeconds": 27000 + random.randint(-1800, 600),
        })
    return trends


def generate_current_night() -> dict:
    """Simulate current night (day 14 — worst night, mid-sleep)."""
    return {
        "sleepStage": "light",
        "heartRate": 68.2,
        "respiratoryRate": 16.1,
        "bedTempC": 30.0,
        "roomTempC": 22.3,
        "heatingLevel": -5,
        "bedPresence": True,
        "sessionProcessing": True,
    }


# Use real Oura data if available, otherwise fall back to mock
from .oura_adapter import has_oura_data, OURA_TRENDS, OURA_INTERVALS, OURA_CURRENT

if has_oura_data() and OURA_TRENDS:
    print(f"[YU RestOS] Using REAL Oura Ring data ({len(OURA_TRENDS)} days)")
    MOCK_INTERVALS = OURA_INTERVALS
    MOCK_TRENDS = OURA_TRENDS
    MOCK_CURRENT = OURA_CURRENT
else:
    print("[YU RestOS] Using mock Eight Sleep data (no Oura data found)")
    MOCK_INTERVALS = generate_intervals()
    MOCK_TRENDS = generate_trends()
    MOCK_CURRENT = generate_current_night()
