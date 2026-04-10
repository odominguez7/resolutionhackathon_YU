"""
Adherence feedback loop (v2.1 week 8-10).

Tracks the athlete's workout completion pattern and adjusts the next
generation when adherence drops. The v2.1 doc calls this the moat:
"knowing when the athlete actually trains, why they skip, and what
unlocks the next session."

Reads from the workout_log to build an adherence profile. Injects
constraints into the Gemini prompt when skips accumulate.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

SKIP_THRESHOLD_7D = 2  # 2+ skips in 7 days triggers streak-rebuild mode
DURATION_CUT_MIN = 15  # how much to shorten sessions in streak-rebuild


def build_adherence_profile(recent_entries: list[dict]) -> dict:
    """Analyze the last 14 days of workout log entries.
    Returns a profile dict with skip count, completion rate, streak info,
    and any prompt constraints that should be injected."""

    today = datetime.now(BOSTON_TZ).date()
    cutoff_7d = today - timedelta(days=7)
    cutoff_14d = today - timedelta(days=14)

    entries_7d = []
    entries_14d = []
    for e in recent_entries:
        if e.get("rejected"):
            continue
        try:
            day = datetime.fromisoformat(e.get("generated_at", "")).date()
        except Exception:
            continue
        if day >= cutoff_7d:
            entries_7d.append(e)
        if day >= cutoff_14d:
            entries_14d.append(e)

    # Count feedback
    completed_7d = sum(1 for e in entries_7d if (e.get("user_feedback") or {}).get("completed") == "yes")
    partial_7d = sum(1 for e in entries_7d if (e.get("user_feedback") or {}).get("completed") == "partial")
    skipped_7d = sum(1 for e in entries_7d if (e.get("user_feedback") or {}).get("completed") == "no")
    no_feedback_7d = sum(1 for e in entries_7d if not (e.get("user_feedback") or {}).get("completed"))
    total_7d = len(entries_7d)

    completed_14d = sum(1 for e in entries_14d if (e.get("user_feedback") or {}).get("completed") == "yes")
    total_14d = len(entries_14d)
    completion_rate_14d = round(completed_14d / total_14d * 100) if total_14d else None

    # Streak: consecutive completed sessions (most recent first)
    streak = 0
    for e in sorted(entries_14d, key=lambda x: x.get("generated_at", ""), reverse=True):
        fb = (e.get("user_feedback") or {}).get("completed")
        if fb == "yes":
            streak += 1
        elif fb in ("no", "partial"):
            break
        else:
            break  # no feedback = unknown, stop counting

    # Skip reasons (from user_feedback.notes or future classification)
    skip_reasons = []
    for e in entries_7d:
        fb = e.get("user_feedback") or {}
        if fb.get("completed") == "no":
            reason = fb.get("notes") or fb.get("reason") or "unknown"
            skip_reasons.append(reason)

    # Determine mode
    streak_rebuild = skipped_7d >= SKIP_THRESHOLD_7D
    last_intensity = None
    last_feedback = None
    if entries_7d:
        last = sorted(entries_7d, key=lambda x: x.get("generated_at", ""))[-1]
        last_intensity = last.get("intensity")
        last_feedback = (last.get("user_feedback") or {}).get("completed")

    # Skip taxonomy — categorize skip reasons
    skip_taxonomy: dict[str, int] = {}
    for e in entries_14d:
        fb = e.get("user_feedback") or {}
        if fb.get("completed") == "no":
            reason = fb.get("skip_reason") or "unknown"
            skip_taxonomy[reason] = skip_taxonomy.get(reason, 0) + 1

    # Temporal profile — compute preferred training window from feedback timestamps
    training_times: list[int] = []  # hour of day
    for e in entries_14d:
        fb = e.get("user_feedback") or {}
        tod = fb.get("time_of_day")
        if tod and fb.get("completed") in ("yes", "partial"):
            try:
                hour = int(tod.split(":")[0])
                training_times.append(hour)
            except Exception:
                pass

    preferred_window = None
    if len(training_times) >= 5:
        from statistics import mean, stdev
        avg_hour = round(mean(training_times), 1)
        spread = round(stdev(training_times), 1) if len(training_times) >= 3 else 2.0
        preferred_window = {
            "avg_hour": avg_hour,
            "spread_hours": spread,
            "label": f"{int(avg_hour)}:00 - {int(avg_hour + 1)}:00",
            "n": len(training_times),
        }

    return {
        "total_7d": total_7d,
        "completed_7d": completed_7d,
        "partial_7d": partial_7d,
        "skipped_7d": skipped_7d,
        "no_feedback_7d": no_feedback_7d,
        "completion_rate_14d": completion_rate_14d,
        "streak": streak,
        "skip_reasons": skip_reasons,
        "skip_taxonomy": skip_taxonomy,
        "preferred_training_window": preferred_window,
        "streak_rebuild": streak_rebuild,
        "last_intensity": last_intensity,
        "last_feedback": last_feedback,
    }


def build_adherence_block(recent_entries: list[dict]) -> str:
    """Build the ADHERENCE INTELLIGENCE block injected into the Gemini prompt."""
    profile = build_adherence_profile(recent_entries)

    lines = [
        "",
        "=" * 60,
        "ADHERENCE INTELLIGENCE",
        "=" * 60,
    ]

    lines.append(f"Last 7 days: {profile['total_7d']} sessions generated, "
                 f"{profile['completed_7d']} completed, "
                 f"{profile['skipped_7d']} skipped, "
                 f"{profile['partial_7d']} partial")
    if profile["completion_rate_14d"] is not None:
        lines.append(f"14-day completion rate: {profile['completion_rate_14d']}%")
    lines.append(f"Current streak: {profile['streak']} consecutive completed sessions")

    if profile["skip_reasons"]:
        lines.append(f"Recent skip reasons: {', '.join(profile['skip_reasons'])}")

    # Constraints
    if profile["streak_rebuild"]:
        lines.append("")
        lines.append("*** STREAK REBUILD MODE ***")
        lines.append(f"The athlete skipped {profile['skipped_7d']} sessions in the last 7 days.")
        lines.append(f"HARD RULES for this session:")
        lines.append(f"  1. Cut total duration by {DURATION_CUT_MIN} minutes (shorter = more likely to start)")
        lines.append(f"  2. Drop intensity one tier (the goal is COMPLETION, not output)")
        lines.append(f"  3. Make the warmup feel easy and inviting — momentum matters more than volume")
        lines.append(f"  4. The mental challenge should be about SHOWING UP, not suffering")
        lines.append(f"  5. End on a high — the last movement should feel good, not crushing")
    elif profile["streak"] >= 5:
        lines.append("")
        lines.append(f"STREAK MOMENTUM: {profile['streak']} in a row. The athlete is locked in.")
        lines.append("You can push a little harder today — they've earned the trust.")
    elif profile["last_feedback"] == "partial":
        lines.append("")
        lines.append("Last session was PARTIAL — the athlete started but didn't finish.")
        lines.append("Slightly shorter today. Remove the weakest movement. Keep the flow tight.")

    return "\n".join(lines)
