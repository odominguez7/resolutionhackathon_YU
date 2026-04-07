"""
Team Simulation — generates anonymous team-level wellness data.

Takes one real user's Oura data and creates a simulated team of N employees
with realistic noise injection. ~20% will show drift at any given time.
Used for the employer dashboard demo.
"""

import random
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


def generate_team_stats(real_daily_data: list[dict], team_size: int = 24) -> dict:
    """Generate anonymous team wellness metrics from one real user's data."""

    if not real_daily_data:
        return {"error": "No biometric data available"}

    recent = real_daily_data[-7:] if len(real_daily_data) >= 7 else real_daily_data

    # Real user's latest metrics as the seed
    seed = recent[-1]
    seed_hrv = seed.get("hrv", 35)
    seed_sleep = seed.get("sleepScore", 78)
    seed_readiness = seed.get("readinessScore", 73)
    seed_stress = seed.get("stressMin", 45)

    # Generate team members with realistic variation
    random.seed(42)  # Deterministic for consistent demo
    employees = []
    drifting = 0
    readiness_dist = {"high": 0, "moderate": 0, "low": 0}

    for i in range(team_size):
        # Add noise (std dev ~15% of seed value)
        hrv = max(15, seed_hrv + random.gauss(0, seed_hrv * 0.2))
        sleep = max(40, min(100, seed_sleep + random.gauss(0, 8)))
        readiness = max(30, min(100, seed_readiness + random.gauss(0, 10)))
        stress = max(0, seed_stress + random.gauss(0, 20))

        # ~22% chance of drift (realistic burnout rate)
        is_drifting = random.random() < 0.22
        if is_drifting:
            hrv *= 0.78
            sleep *= 0.85
            readiness *= 0.80
            stress *= 1.4
            drifting += 1

        if readiness >= 75:
            readiness_dist["high"] += 1
        elif readiness >= 55:
            readiness_dist["moderate"] += 1
        else:
            readiness_dist["low"] += 1

        employees.append({
            "id": f"emp_{i:03d}",
            "hrv": round(hrv, 1),
            "sleep_score": round(sleep),
            "readiness": round(readiness),
            "stress_min": round(stress),
            "drifting": is_drifting,
        })

    # Intervention effectiveness (simulated from agent history)
    interventions_sent = drifting * 3  # ~3 per drifting employee
    interventions_effective = round(interventions_sent * 0.63)  # 63% effective

    # Weekly trend (simulate 4 weeks of drift rate)
    random.seed(7)
    weekly_trend = []
    base_rate = 18
    for w in range(4):
        rate = base_rate + random.gauss(0, 3) + (w * 1.2)  # slight uptrend
        weekly_trend.append({
            "week": f"W{w + 1}",
            "drift_rate": round(max(5, min(40, rate)), 1),
            "avg_readiness": round(73 - w * 1.5 + random.gauss(0, 2), 1),
        })

    # Top drift drivers across team
    drivers = [
        {"metric": "Sleep Quality", "pct": 41, "color": "#3b82f6"},
        {"metric": "HRV Decline", "pct": 33, "color": "#8b5cf6"},
        {"metric": "Stress Elevation", "pct": 26, "color": "#f59e0b"},
    ]

    return {
        "company": "Demo Corp",
        "team_size": team_size,
        "generated_at": datetime.now(BOSTON_TZ).isoformat(),
        "summary": {
            "drift_rate": round(drifting / team_size * 100),
            "drifting_count": drifting,
            "avg_readiness": round(sum(e["readiness"] for e in employees) / team_size, 1),
            "avg_sleep": round(sum(e["sleep_score"] for e in employees) / team_size, 1),
            "avg_hrv": round(sum(e["hrv"] for e in employees) / team_size, 1),
            "interventions_sent": interventions_sent,
            "interventions_effective": interventions_effective,
            "effectiveness_rate": round(interventions_effective / max(1, interventions_sent) * 100),
        },
        "readiness_distribution": readiness_dist,
        "weekly_trend": weekly_trend,
        "top_drivers": drivers,
        "privacy_note": "No individual employee data is exposed. All metrics are aggregated and anonymous.",
    }
