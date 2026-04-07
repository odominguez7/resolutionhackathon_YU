"""
Effectiveness Intelligence for YU Cortex.

- Intervention-driver pairing: tracks which interventions work for which drift drivers
- Action verification: records whether user followed through
- Intervention rotation: detects habituation and suggests alternatives
- Longitudinal insights: 6-month pattern analysis
"""

from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

# Equivalent interventions for rotation
INTERVENTION_EQUIVALENTS = {
    "send_coaching": ["send_coaching"],  # coaching content rotates internally
    "sleep_protocol": ["sleep_protocol"],
    "block_calendar": ["block_calendar"],
    "recommend_workout": ["recommend_workout"],
}


def build_driver_pairing(intervention_log: list[dict], drift_history: list[dict]) -> dict:
    """Build a map of which interventions work for which drift drivers."""
    pairings = {}

    for entry in intervention_log:
        if entry.get("effectiveness_score") is None:
            continue

        # Find the drift record closest to this intervention
        ts = entry.get("timestamp", "")
        drivers = []
        for drift in drift_history:
            if drift.get("timestamp", "") <= ts and drift.get("detected"):
                drivers = drift.get("drivers", [])

        score = entry["effectiveness_score"]
        action = entry.get("action_type", "unknown")

        for driver in drivers:
            key = f"{action}|{driver}"
            if key not in pairings:
                pairings[key] = {"action": action, "driver": driver, "scores": [], "total": 0, "positive": 0}
            pairings[key]["scores"].append(score)
            pairings[key]["total"] += 1
            if score > 0:
                pairings[key]["positive"] += 1

    # Build readable output
    results = []
    for key, p in pairings.items():
        rate = round(p["positive"] / p["total"] * 100) if p["total"] > 0 else 0
        results.append({
            "intervention": p["action"],
            "driver": p["driver"],
            "effectiveness_rate": rate,
            "total_uses": p["total"],
            "positive_outcomes": p["positive"],
        })

    results.sort(key=lambda x: x["effectiveness_rate"], reverse=True)
    return {"pairings": results, "total_tracked": len(intervention_log)}


def check_habituation(intervention_log: list[dict]) -> list[dict]:
    """Detect interventions showing diminishing returns."""
    by_type = {}
    for entry in intervention_log:
        if entry.get("effectiveness_score") is None:
            continue
        atype = entry.get("action_type", "unknown")
        by_type.setdefault(atype, []).append(entry["effectiveness_score"])

    alerts = []
    for atype, scores in by_type.items():
        if len(scores) < 4:
            continue
        # Compare first half vs second half
        mid = len(scores) // 2
        first_rate = sum(1 for s in scores[:mid] if s > 0) / mid * 100 if mid > 0 else 0
        second_rate = sum(1 for s in scores[mid:] if s > 0) / (len(scores) - mid) * 100 if len(scores) - mid > 0 else 0

        if first_rate - second_rate > 20:
            alerts.append({
                "intervention": atype,
                "early_effectiveness": round(first_rate),
                "recent_effectiveness": round(second_rate),
                "decline": round(first_rate - second_rate),
                "recommendation": f"Consider rotating away from {atype}. Effectiveness dropped {round(first_rate - second_rate)}% over time.",
                "times_delivered": len(scores),
            })

    return alerts


def get_rotation_suggestion(intervention_log: list[dict], current_action: str) -> str | None:
    """Suggest an alternative if current intervention is showing habituation."""
    recent = [e for e in intervention_log if e.get("action_type") == current_action]
    if len(recent) < 3:
        return None

    recent_scores = [e["effectiveness_score"] for e in recent[-3:] if e.get("effectiveness_score") is not None]
    if recent_scores and sum(1 for s in recent_scores if s > 0) == 0:
        return f"{current_action} has been ineffective for the last {len(recent_scores)} uses. Consider switching approach."
    return None


def build_longitudinal_insights(daily_data: list[dict]) -> dict:
    """Analyze 6 months of data for patterns."""
    if len(daily_data) < 30:
        return {"insights": [], "message": "Need at least 30 days for longitudinal analysis."}

    insights = []

    # Monthly averages
    months = {}
    for d in daily_data:
        month = d["day"][:7]  # "2026-03"
        months.setdefault(month, []).append(d)

    monthly_stats = []
    for month, days in sorted(months.items()):
        hrv_vals = [d["hrv"] for d in days if d.get("hrv")]
        sleep_vals = [d["sleepScore"] for d in days if d.get("sleepScore")]
        readiness_vals = [d["readinessScore"] for d in days if d.get("readinessScore")]
        monthly_stats.append({
            "month": month,
            "days": len(days),
            "avg_hrv": round(sum(hrv_vals) / len(hrv_vals), 1) if hrv_vals else 0,
            "avg_sleep": round(sum(sleep_vals) / len(sleep_vals), 1) if sleep_vals else 0,
            "avg_readiness": round(sum(readiness_vals) / len(readiness_vals), 1) if readiness_vals else 0,
        })

    # Best and worst weeks
    weeks = []
    for i in range(0, len(daily_data) - 6, 7):
        week = daily_data[i:i + 7]
        readiness_vals = [d["readinessScore"] for d in week if d.get("readinessScore")]
        hrv_vals = [d["hrv"] for d in week if d.get("hrv")]
        if readiness_vals:
            weeks.append({
                "start": week[0]["day"],
                "end": week[-1]["day"],
                "avg_readiness": round(sum(readiness_vals) / len(readiness_vals), 1),
                "avg_hrv": round(sum(hrv_vals) / len(hrv_vals), 1) if hrv_vals else 0,
            })

    best_week = max(weeks, key=lambda w: w["avg_readiness"]) if weeks else None
    worst_week = min(weeks, key=lambda w: w["avg_readiness"]) if weeks else None

    if best_week:
        insights.append({
            "type": "best_week",
            "insight": f"Your best recovery week was {best_week['start']} to {best_week['end']} (readiness {best_week['avg_readiness']}, HRV {best_week['avg_hrv']}ms).",
        })
    if worst_week:
        insights.append({
            "type": "worst_week",
            "insight": f"Your toughest week was {worst_week['start']} to {worst_week['end']} (readiness {worst_week['avg_readiness']}, HRV {worst_week['avg_hrv']}ms).",
        })

    # HRV trend over full period
    if len(daily_data) >= 60:
        first_30_hrv = [d["hrv"] for d in daily_data[:30] if d.get("hrv")]
        last_30_hrv = [d["hrv"] for d in daily_data[-30:] if d.get("hrv")]
        if first_30_hrv and last_30_hrv:
            hrv_change = round(sum(last_30_hrv) / len(last_30_hrv) - sum(first_30_hrv) / len(first_30_hrv), 1)
            direction = "improved" if hrv_change > 0 else "declined"
            insights.append({
                "type": "hrv_trend",
                "insight": f"Your HRV has {direction} by {abs(hrv_change)}ms over the full tracking period.",
            })

    # Sleep consistency
    sleep_hours = [d.get("totalSleepHours", 0) for d in daily_data[-30:] if d.get("totalSleepHours")]
    if len(sleep_hours) >= 14:
        import statistics
        sleep_std = statistics.stdev(sleep_hours)
        if sleep_std > 1.2:
            insights.append({
                "type": "sleep_inconsistency",
                "insight": f"Your sleep duration varies a lot (std dev: {sleep_std:.1f}h). Consistency matters more than total hours.",
            })
        elif sleep_std < 0.5:
            insights.append({
                "type": "sleep_consistency",
                "insight": f"Your sleep timing is very consistent (std dev: {sleep_std:.1f}h). This supports circadian stability.",
            })

    return {
        "monthly_stats": monthly_stats,
        "best_week": best_week,
        "worst_week": worst_week,
        "insights": insights,
        "total_days_analyzed": len(daily_data),
    }
