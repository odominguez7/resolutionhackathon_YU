"""
HRV Optimization Loop — the strategic layer.

The daily action picker makes tactical decisions (today: push/easy/rest).
This module makes STRATEGIC decisions (this week: increase stimulus,
maintain, or pull back) based on whether HRV is actually improving.

HRV is the northstar. Every other decision serves this one number.

Runs on every daily-action call and injects a strategy directive
that overrides or modifies the tactical decision.
"""

from __future__ import annotations

import statistics
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


def compute_hrv_trend(sleep_by_day: dict, window_days: int = 30) -> dict:
    """Compute the HRV trend over a window.

    Returns:
    {
        "direction": "improving" | "flat" | "declining",
        "slope_ms_per_week": float (positive = improving),
        "current_ewma": float,
        "baseline_ewma": float,
        "delta_from_baseline": float,
        "last_7_avg": float,
        "prev_7_avg": float,
        "values": [float] (daily HRV for the window),
        "confidence": "high" | "medium" | "low" (based on data density),
    }
    """
    days = sorted(sleep_by_day.keys())[-window_days:]
    hrvs = []
    for d in days:
        h = sleep_by_day[d].get("average_hrv")
        if h is not None:
            hrvs.append({"day": d, "hrv": float(h)})

    if len(hrvs) < 7:
        return {
            "direction": "insufficient_data",
            "slope_ms_per_week": 0,
            "confidence": "low",
            "values": [h["hrv"] for h in hrvs],
        }

    values = [h["hrv"] for h in hrvs]

    # Split into halves for trend detection
    mid = len(values) // 2
    first_half = values[:mid]
    second_half = values[mid:]
    first_avg = statistics.mean(first_half)
    second_avg = statistics.mean(second_half)

    # Last 7 vs previous 7 for recent momentum
    last_7 = values[-7:] if len(values) >= 7 else values
    prev_7 = values[-14:-7] if len(values) >= 14 else first_half
    last_7_avg = statistics.mean(last_7)
    prev_7_avg = statistics.mean(prev_7) if prev_7 else last_7_avg

    # Linear regression slope (ms per day)
    n = len(values)
    x_mean = (n - 1) / 2
    y_mean = statistics.mean(values)
    numerator = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    slope_per_day = numerator / denominator if denominator > 0 else 0
    slope_per_week = round(slope_per_day * 7, 2)

    # Direction classification
    if slope_per_week > 0.5 and last_7_avg > prev_7_avg:
        direction = "improving"
    elif slope_per_week < -0.5 and last_7_avg < prev_7_avg:
        direction = "declining"
    else:
        direction = "flat"

    # Confidence
    confidence = "high" if len(values) >= 21 else "medium" if len(values) >= 14 else "low"

    return {
        "direction": direction,
        "slope_ms_per_week": slope_per_week,
        "current_ewma": round(last_7_avg, 1),
        "first_half_avg": round(first_avg, 1),
        "second_half_avg": round(second_avg, 1),
        "last_7_avg": round(last_7_avg, 1),
        "prev_7_avg": round(prev_7_avg, 1),
        "delta_week_over_week": round(last_7_avg - prev_7_avg, 1),
        "n_days": len(values),
        "confidence": confidence,
        "values": [round(v, 1) for v in values[-14:]],
    }


def compute_strategy(hrv_trend: dict, adherence: dict, acwr: dict) -> dict:
    """The strategic decision. Runs once per day. Overrides or modifies
    the tactical daily action based on the multi-week HRV trend.

    Returns:
    {
        "strategy": "increase_stimulus" | "maintain" | "pull_back" | "recover",
        "reasoning": str (human-readable, references real numbers),
        "intensity_modifier": float (multiply the daily intensity by this),
        "max_push_days_this_week": int,
        "force_rest_days": int (0 = no forced rest),
    }
    """
    direction = hrv_trend.get("direction", "flat")
    slope = hrv_trend.get("slope_ms_per_week", 0)
    delta_wow = hrv_trend.get("delta_week_over_week", 0)
    last_7 = hrv_trend.get("last_7_avg", 0)
    prev_7 = hrv_trend.get("prev_7_avg", 0)
    confidence = hrv_trend.get("confidence", "low")
    acwr_ratio = acwr.get("ratio", 1.0) if isinstance(acwr, dict) else 1.0
    streak = adherence.get("streak", 0)
    skipped = adherence.get("skipped_7d", 0)

    # Default: maintain
    strategy = "maintain"
    reasoning_parts = []
    intensity_mod = 1.0
    max_push = 3
    force_rest = 0

    if direction == "insufficient_data":
        strategy = "maintain"
        reasoning_parts.append(
            "Not enough HRV data to set a strategy yet. "
            "Maintaining a balanced approach until we have 2+ weeks of readings."
        )
        return {
            "strategy": strategy,
            "reasoning": " ".join(reasoning_parts),
            "intensity_modifier": 1.0,
            "max_push_days_this_week": 3,
            "force_rest_days": 0,
        }

    # IMPROVING: HRV is going up — current approach is working
    if direction == "improving":
        if slope > 1.5:
            strategy = "increase_stimulus"
            intensity_mod = 1.1
            max_push = 4
            reasoning_parts.append(
                f"HRV trending up strongly (+{slope}ms/week). "
                f"Last 7 days averaged {last_7}ms vs {prev_7}ms the week before. "
                f"Your body is adapting well. Adding one more push day this week."
            )
        else:
            strategy = "maintain"
            reasoning_parts.append(
                f"HRV improving (+{slope}ms/week, {last_7}ms → was {prev_7}ms). "
                f"Current balance is working. No changes."
            )

    # FLAT: plateau — need to shake things up or check recovery
    elif direction == "flat":
        if acwr_ratio < 0.8:
            strategy = "increase_stimulus"
            intensity_mod = 1.1
            max_push = 4
            reasoning_parts.append(
                f"HRV is flat ({last_7}ms, slope {slope}ms/week) and ACWR is {acwr_ratio} (undertrained). "
                f"Your body can handle more. Increasing training stimulus."
            )
        elif skipped >= 2:
            strategy = "maintain"
            reasoning_parts.append(
                f"HRV is flat but you've skipped {skipped} sessions. "
                f"Consistency matters more than intensity right now."
            )
        else:
            strategy = "maintain"
            reasoning_parts.append(
                f"HRV plateaued at {last_7}ms (slope {slope}ms/week). "
                f"Checking if sleep quality or stress is the bottleneck."
            )

    # DECLINING: something is wrong — pull back
    elif direction == "declining":
        if slope < -2.0:
            strategy = "recover"
            intensity_mod = 0.6
            max_push = 1
            force_rest = 2
            reasoning_parts.append(
                f"HRV dropping sharply ({slope}ms/week). "
                f"Last 7 days: {last_7}ms, was {prev_7}ms. "
                f"Pulling back volume. Forcing 2 rest days this week. "
                f"Only 1 push day allowed until HRV stabilizes."
            )
        elif slope < -1.0:
            strategy = "pull_back"
            intensity_mod = 0.8
            max_push = 2
            force_rest = 1
            reasoning_parts.append(
                f"HRV declining ({slope}ms/week, {last_7}ms → was {prev_7}ms). "
                f"Reducing intensity. Adding 1 forced rest day. "
                f"Max 2 push days until the trend reverses."
            )
        else:
            strategy = "pull_back"
            intensity_mod = 0.9
            max_push = 2
            reasoning_parts.append(
                f"HRV slightly declining ({slope}ms/week). "
                f"Easing off intensity as a precaution."
            )

    # Override safety: if ACWR is in danger zone regardless of trend
    if acwr_ratio > 1.5:
        strategy = "recover"
        intensity_mod = min(intensity_mod, 0.6)
        max_push = min(max_push, 1)
        force_rest = max(force_rest, 2)
        reasoning_parts.append(
            f"ACWR {acwr_ratio} is in the danger zone. Overriding to recovery regardless of HRV trend."
        )

    return {
        "strategy": strategy,
        "reasoning": " ".join(reasoning_parts),
        "intensity_modifier": round(intensity_mod, 2),
        "max_push_days_this_week": max_push,
        "force_rest_days": force_rest,
        "hrv_trend": hrv_trend,
    }


def apply_strategy_to_action(action: dict, strategy: dict, weekly_push_count: int = 0) -> dict:
    """Modify the daily tactical action based on the strategic directive.

    If strategy says "pull_back" but the tactical picker says "push",
    the strategy wins. HRV is the northstar."""

    strat = strategy.get("strategy", "maintain")
    max_push = strategy.get("max_push_days_this_week", 3)
    force_rest = strategy.get("force_rest_days", 0)
    mod = strategy.get("intensity_modifier", 1.0)

    modified = dict(action)
    modified["strategy"] = strategy

    # Force rest if strategy demands it and we haven't rested enough
    if force_rest > 0 and action.get("action") == "workout" and action.get("intensity") in ("push", "work"):
        # Check if enough rest days this week
        # For now, simple: if strategy says recover, force it
        if strat == "recover":
            modified["action"] = "stretch"
            modified["intensity"] = "recovery"
            modified["duration_min"] = 25
            modified["reasoning"] = (
                strategy.get("reasoning", "") + " "
                "The strategic layer is overriding today's workout. "
                "Your HRV needs to recover before pushing again."
            )
            modified["override_warning"] = (
                "The HRV optimization loop is enforcing recovery. "
                "Override at your own risk — the system is tracking the outcome."
            )
            return modified

    # Cap push days per week
    if action.get("intensity") == "push" and weekly_push_count >= max_push:
        modified["intensity"] = "work"
        modified["reasoning"] = (
            action.get("reasoning", "") +
            f" Strategy capped push days at {max_push}/week. Downgrading to work intensity."
        )

    # Apply intensity modifier to duration
    if mod != 1.0 and modified.get("duration_min"):
        modified["duration_min"] = max(20, round(modified["duration_min"] * mod))

    return modified
