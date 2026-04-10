"""
Daily Action Engine — the core agent decision.

Given the full AthleteContext (HRV, readiness, sleep, adherence, calendar,
progression, closed-loop verdicts), decides TODAY'S ACTION:

  workout (full program)  |  walk (Zone 2)  |  stretch (mobility + breathwork)  |  rest (active recovery protocol)

This replaces the user choosing "Home Workout / Yoga / Rest". The agent
chooses. The user can override, but the agent's choice is the default.

Also handles:
- Override protocol (user rebels against rest → agent warns consequences)
- Time-of-day adaptation (missed morning → evening protocol)
- Fuel context (did you eat enough to push?)
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


def pick_daily_action(ctx: dict) -> dict:
    """The agent's daily decision. Returns the action type + reasoning.

    Returns:
    {
        "action": "workout" | "walk" | "stretch" | "rest",
        "intensity": "push" | "work" | "easy" | "recovery",
        "reasoning": str (why this action, referencing real numbers),
        "duration_min": int,
        "override_warning": str | None (shown if user overrides),
        "fuel_prompt": bool (should we ask about nutrition?),
    }
    """
    bio = ctx.get("biometrics") or {}
    adherence = ctx.get("adherence_profile") or {}
    intensity = ctx.get("intensity_tier", "work")
    readiness = bio.get("readiness", 0)
    hrv = bio.get("hrv")
    hrv_bl = bio.get("hrv_baseline")
    overtraining = ctx.get("overtraining_risk", "none")
    streak = adherence.get("streak", 0)
    skipped_7d = adherence.get("skipped_7d", 0)
    streak_rebuild = adherence.get("streak_rebuild", False)
    last_feedback = adherence.get("last_feedback")
    calendar_load = ctx.get("calendar_cognitive_load", 0)

    # Decision tree — HRV as northstar
    action = "workout"
    duration = 55
    reasoning_parts = []
    override_warning = None
    fuel_prompt = False

    # VETO: overtraining detected
    if overtraining in ("veto", "elevated"):
        action = "rest" if overtraining == "veto" else "stretch"
        duration = 30
        reasoning_parts.append(
            f"Your HRV is below your control limit. "
            f"{'Multiple signals are flagging overtraining.' if overtraining == 'veto' else 'Recovery is lagging.'} "
            f"Today is not a push day. This is how you train harder next week."
        )
        override_warning = (
            f"You're overriding the {'rest' if overtraining == 'veto' else 'recovery'} protocol. "
            f"Expect a steep drop in tomorrow's readiness. Hydrate aggressively tonight. "
            f"The agent will track how your body responds."
        )
    # STREAK REBUILD: too many skips
    elif streak_rebuild:
        action = "workout"
        intensity = "easy"
        duration = 35
        reasoning_parts.append(
            f"You've skipped {skipped_7d} sessions this week. "
            f"Today's session is shorter and lighter. The goal is showing up, not suffering. "
            f"Momentum matters more than volume."
        )
    # PUSH DAY: HRV above baseline + high readiness
    elif intensity == "push":
        action = "workout"
        duration = 60
        hrv_delta = round(hrv - hrv_bl, 1) if hrv and hrv_bl else 0
        reasoning_parts.append(
            f"HRV {hrv}ms (+{hrv_delta} vs baseline). Readiness {readiness}. "
            f"Your body absorbed yesterday's load. Today you push."
        )
        fuel_prompt = True  # pushing hard — should check if fueled
    # WORK DAY: decent recovery
    elif intensity == "work":
        action = "workout"
        duration = 50
        reasoning_parts.append(
            f"Readiness {readiness}. Solid recovery. "
            f"Not a peak day, but your body can handle a real session."
        )
    # EASY DAY: under-recovered
    elif intensity == "easy":
        action = "walk" if calendar_load >= 7 else "workout"
        duration = 40 if action == "workout" else 30
        if action == "walk":
            reasoning_parts.append(
                f"Readiness {readiness} and your calendar is heavy today (cognitive load {calendar_load}/10). "
                f"A 30-minute Zone 2 walk protects your HRV better than a workout right now."
            )
        else:
            reasoning_parts.append(
                f"Readiness {readiness}. Under-recovered. "
                f"Lower intensity, more rest between sets. Focus on movement quality."
            )
    # RECOVERY: very low readiness
    else:
        action = "stretch"
        duration = 25
        reasoning_parts.append(
            f"Readiness {readiness}. Your body needs space. "
            f"Mobility flow + breathwork. This is not a skip. This is the work."
        )
        override_warning = (
            "You're overriding the recovery protocol. "
            "Based on your data, intense training today has a high likelihood of "
            "crashing your HRV tomorrow. If you must move, keep it Zone 2."
        )

    # Calendar modifier
    if calendar_load >= 8 and action == "workout" and intensity in ("push", "work"):
        reasoning_parts.append(
            f"Calendar load is high ({calendar_load}/10). "
            f"Your sympathetic nervous system will already be activated. "
            f"Session shortened by 10 minutes."
        )
        duration = max(30, duration - 10)

    # Streak context
    if streak >= 5:
        reasoning_parts.append(f"Streak: {streak} days. Locked in.")
    elif streak >= 3:
        reasoning_parts.append(f"Building momentum: {streak} in a row.")

    return {
        "action": action,
        "intensity": intensity,
        "reasoning": " ".join(reasoning_parts),
        "duration_min": duration,
        "override_warning": override_warning,
        "fuel_prompt": fuel_prompt,
        "readiness": readiness,
        "hrv": hrv,
        "hrv_baseline": hrv_bl,
        "overtraining_risk": overtraining,
    }


def adapt_for_time_of_day(action: dict, planned_hour: int = 7) -> dict:
    """Silent intervention: if the user opens the app late, adapt the action.
    No push notification — just rewrite what they see.

    If they planned a morning push workout but it's now evening,
    downgrade to walk/stretch because late intense training hurts sleep."""
    now_hour = datetime.now(BOSTON_TZ).hour

    if now_hour < planned_hour + 3:
        return action  # within window, no change

    hours_late = now_hour - planned_hour

    if action["action"] == "workout" and action["intensity"] in ("push", "work"):
        if now_hour >= 20:  # after 8pm
            return {
                **action,
                "action": "stretch",
                "intensity": "recovery",
                "duration_min": 25,
                "reasoning": (
                    f"You missed your training window by {hours_late} hours. "
                    f"An intense workout this late will likely suppress your deep sleep tonight "
                    f"based on your sleep patterns. "
                    f"A stretch and breathwork session protects tomorrow's HRV. "
                    f"This is the disciplined call."
                ),
                "time_adapted": True,
            }
        elif now_hour >= 17:  # after 5pm
            return {
                **action,
                "intensity": "easy",
                "duration_min": max(30, action["duration_min"] - 15),
                "reasoning": (
                    action["reasoning"] + f" Adjusted: session shortened by 15 min "
                    f"because training after 5pm has a higher sleep impact for you."
                ),
                "time_adapted": True,
            }

    return action


def compute_calendar_cognitive_load(events: list[dict]) -> int:
    """Parse calendar events and assign a cognitive load score 0-10.
    High-stress keywords (pitch, presentation, exam, interview, deadline)
    get extra weight. Pure duration also matters."""
    if not events:
        return 0

    HIGH_STRESS_KEYWORDS = {
        "pitch", "presentation", "exam", "interview", "deadline",
        "review", "defense", "demo", "investor", "board", "final",
        "negotiation", "conflict", "firing", "layoff",
    }
    MODERATE_KEYWORDS = {
        "meeting", "sync", "standup", "call", "workshop", "class",
        "lecture", "seminar", "office hours",
    }

    total_hours = 0
    stress_score = 0

    for event in events:
        title = (event.get("summary") or event.get("title") or "").lower()
        duration_min = event.get("duration_min", 60)
        total_hours += duration_min / 60

        # Keyword scoring
        for kw in HIGH_STRESS_KEYWORDS:
            if kw in title:
                stress_score += 3
                break
        else:
            for kw in MODERATE_KEYWORDS:
                if kw in title:
                    stress_score += 1
                    break

    # Blend: total hours (0-10 scale) + keyword stress (0-10 scale)
    hour_score = min(10, total_hours * 1.5)
    keyword_score = min(10, stress_score)
    combined = round((hour_score * 0.4 + keyword_score * 0.6))
    return min(10, max(0, combined))
