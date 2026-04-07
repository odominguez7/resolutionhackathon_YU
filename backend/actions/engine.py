"""
Action Engine -- generates and executes personalized recovery plans.

When drift is detected, the engine:
1. Analyzes drift severity + specific signal patterns
2. Generates a prioritized list of executable actions
3. Maps each action to an execution method (API, concierge, link)
4. Executes on user approval
5. Tracks results for feedback loop
"""

from datetime import datetime
from zoneinfo import ZoneInfo
import uuid

BOSTON_TZ = ZoneInfo("America/New_York")

from .models import (
    Action, RecoveryPlan, ActionType, ActionStatus,
    ExecutionMethod, ActionExecutionResult
)
from .tools import execute_tool
from .concierge import dispatch_task
from .product_links import get_product_recommendation

_active_plans: dict[str, RecoveryPlan] = {}


def generate_recovery_plan(drift_analysis: dict, latest_sleep: dict, latest_checkin: dict) -> RecoveryPlan:
    """Generate a personalized recovery plan based on real drift analysis."""

    severity = drift_analysis.get("severity", "none")
    drivers = drift_analysis.get("drivers", [])
    drift_detected = drift_analysis.get("drift_detected", False)

    if not drift_detected:
        return _empty_plan()

    actions = []
    driver_metrics = {d["metric"] for d in drivers}

    # Real values from latest Oura data
    hrv = latest_sleep.get("hrv", 0)
    rhr = latest_sleep.get("avgHeartRate", 0)
    sleep_score = latest_sleep.get("sleepScore", 0)
    deep_min = latest_sleep.get("deepSleepMin", 0)
    total_hrs = latest_sleep.get("totalSleepHours", 0)
    stress_min = latest_sleep.get("stressMin", 0)
    readiness = latest_sleep.get("readinessScore", 0)
    baseline = drift_analysis.get("baseline", {})

    # ACTION 1: Sleep hygiene protocol (always for drift)
    actions.append(Action(
        id=str(uuid.uuid4())[:8],
        title="Optimize your sleep environment tonight",
        description=(
            f"Your HRV is {hrv}ms (normally it's around {baseline.get('hrv', 0):.0f}ms). "
            f"When you sleep cooler (65-68F), your body spends more time in deep sleep -- "
            f"that's the phase where your muscles repair and your brain cleans out waste. "
            f"Tonight: drop the thermostat, use lighter bedding, and keep the room dark."
        ),
        action_type=ActionType.WELLNESS,
        execution_method=ExecutionMethod.IN_APP,
        priority=1,
        estimated_impact="High",
        impact_reason=f"Cooler room + darkness → more deep sleep → faster HRV recovery. Your HRV is {hrv}ms vs your normal {baseline.get('hrv', 0):.0f}ms.",
        sponsor=None,
        parameters={
            "tool_id": "sleep_protocol",
            "focus": "temperature",
        },
    ))

    # ACTION 2: Consistent wake time
    actions.append(Action(
        id=str(uuid.uuid4())[:8],
        title="Wake up the same time every day",
        description=(
            f"Your sleep score is {sleep_score} (normally {baseline.get('sleepScore', 0):.0f}). "
            f"Your brain has an internal clock. When you wake up at different times, that clock gets confused "
            f"and your sleep quality drops. Set a consistent alarm for 6:30 AM every day this week, "
            f"even on weekends. Consistency beats extra sleep."
        ),
        action_type=ActionType.WELLNESS,
        execution_method=ExecutionMethod.IN_APP,
        priority=2,
        estimated_impact="High",
        impact_reason=f"Consistent wake time resets your circadian rhythm. Sleep score {sleep_score} vs normal {baseline.get('sleepScore', 0):.0f}.",
        sponsor=None,
        parameters={
            "tool_id": "sleep_protocol",
            "focus": "timing",
        },
    ))

    # ACTION 3: Calendar block (when readiness is low)
    if "readiness" in driver_metrics or readiness < 70:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Protect your wind-down time tonight",
            description=(
                f"Your readiness is {readiness} (normally {baseline.get('readiness', 0):.0f}). "
                f"That means your body hasn't fully recovered from yesterday. "
                f"We're blocking 9-10 PM on your calendar — no meetings, no screens, no exceptions. "
                f"Your brain needs 30-60 minutes of calm before sleep to switch from 'go mode' to 'rest mode'."
            ),
            action_type=ActionType.CALENDAR,
            execution_method=ExecutionMethod.API_CALL,
            priority=3,
            estimated_impact="Medium",
            impact_reason=f"Readiness {readiness} vs normal {baseline.get('readiness', 0):.0f}. Protected downtime triggers parasympathetic activation.",
            sponsor=None,
            parameters={
                "tool_id": "block_calendar",
                "event_title": "Recovery Wind-Down (YU RestOS)",
                "start_time": "21:00",
                "end_time": "22:00",
                "calendar": "primary",
            },
        ))

    # ACTION 4: Wellness concierge (when stress is elevated)
    if "stress" in driver_metrics or stress_min > 120:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Book a recovery session",
            description=(
                f"You spent {stress_min} minutes in high stress today. "
                f"When stress stays high for hours, your body produces cortisol — a hormone that "
                f"blocks deep sleep and breaks down muscle. A 30-minute yoga or breathing session "
                f"flips the switch from stress mode back to recovery mode."
            ),
            action_type=ActionType.WELLNESS,
            execution_method=ExecutionMethod.CONCIERGE,
            priority=4,
            estimated_impact="Medium",
            impact_reason=f"{stress_min} min of high stress. Active recovery lowers cortisol and restores parasympathetic tone.",
            sponsor=None,
            parameters={
                "activity": "yoga or guided breathwork",
                "preferred_time": "morning",
                "location": "nearby or virtual",
                "task_type": "wellness_booking",
            },
        ))

    # ACTION 5: Environment optimization (when deep sleep is low)
    if "deep_sleep" in driver_metrics or deep_min < 60:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Upgrade your sleep environment",
            description=(
                f"You're only getting {deep_min} minutes of deep sleep (you need 90+ to fully recover). "
                f"Three things that help the most: blackout curtains (any light tells your brain it's daytime), "
                f"a cooling pillow (your head needs to be cool for deep sleep), "
                f"and white noise (masks the sounds that pull you out of deep sleep without waking you)."
            ),
            action_type=ActionType.SHOPPING,
            execution_method=ExecutionMethod.PRODUCT_LINK,
            priority=5,
            estimated_impact="Medium",
            impact_reason=f"Deep sleep at {deep_min} min vs 90+ target. Environment changes can boost deep sleep 15-25%.",
            sponsor=None,
            parameters={
                "goal": "deep_sleep",
                "products": [
                    {"name": "Blackout Curtains", "category": "window-treatments"},
                    {"name": "Cooling Gel Pillow", "category": "pillows"},
                    {"name": "White Noise Machine", "category": "sound-machines"},
                ],
            },
        ))

    # Build rationale in plain language
    days = drift_analysis.get("consecutive_days", 0)
    driver_plain = [d["description"] for d in drivers[:2]]
    cause = " and ".join(driver_plain) if driver_plain else "multiple signals are dropping"

    plan = RecoveryPlan(
        id=str(uuid.uuid4())[:8],
        generated_at=datetime.now(BOSTON_TZ),
        drift_severity=severity,
        actions=actions,
        estimated_recovery_days=3 if severity == "high" else 2,
        ai_rationale=(
            f"Your body showed {days} days of decline in a 7-day window. "
            f"The biggest issues: {cause}. "
            f"This plan works in layers — first we fix your sleep environment tonight (that's the fastest win), "
            f"then we protect your recovery time, then we break the stress cycle. "
            f"If you follow all {len(actions)} actions, you should feel a difference within 48 hours."
        ),
        total_actions=len(actions),
    )

    _active_plans[plan.id] = plan
    return plan


def execute_action(plan_id: str, action_id: str) -> ActionExecutionResult:
    """Execute a single action from a recovery plan."""

    plan = _active_plans.get(plan_id)
    if not plan:
        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.FAILED,
            executed_at=datetime.now(BOSTON_TZ),
            result_message="Plan not found",
        )

    action = next((a for a in plan.actions if a.id == action_id), None)
    if not action:
        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.FAILED,
            executed_at=datetime.now(BOSTON_TZ),
            result_message="Action not found",
        )

    if action.execution_method == ExecutionMethod.API_CALL:
        result = execute_tool(
            action.parameters.get("tool_id", ""),
            action.parameters,
        )
        action.status = ActionStatus.COMPLETED
        action.executed_at = datetime.now(BOSTON_TZ)
        action.result = result
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.COMPLETED,
            executed_at=datetime.now(BOSTON_TZ),
            result_message=f"{action.title} -- executed successfully",
            api_response=result,
        )

    elif action.execution_method == ExecutionMethod.CONCIERGE:
        task = dispatch_task(action)
        action.status = ActionStatus.EXECUTING
        action.executed_at = datetime.now(BOSTON_TZ)
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.EXECUTING,
            executed_at=datetime.now(BOSTON_TZ),
            result_message="Task dispatched -- a recovery agent is handling this",
            task_id=task["task_id"],
        )

    elif action.execution_method == ExecutionMethod.PRODUCT_LINK:
        products = get_product_recommendation(action.parameters)
        action.status = ActionStatus.COMPLETED
        action.executed_at = datetime.now(BOSTON_TZ)
        action.result = products
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.COMPLETED,
            executed_at=datetime.now(BOSTON_TZ),
            result_message="Product recommendations ready",
            product_url=products.get("url", ""),
        )

    return ActionExecutionResult(
        action_id=action_id,
        status=ActionStatus.FAILED,
        executed_at=datetime.now(BOSTON_TZ),
        result_message="Unknown execution method",
    )


def execute_all_actions(plan_id: str) -> list[ActionExecutionResult]:
    """Execute all pending actions in a recovery plan."""
    plan = _active_plans.get(plan_id)
    if not plan:
        return []

    results = []
    for action in plan.actions:
        if action.status == ActionStatus.PENDING:
            result = execute_action(plan_id, action.id)
            results.append(result)

    return results


def get_plan(plan_id: str) -> RecoveryPlan | None:
    return _active_plans.get(plan_id)


def _empty_plan() -> RecoveryPlan:
    return RecoveryPlan(
        id="none",
        generated_at=datetime.now(BOSTON_TZ),
        drift_severity="none",
        actions=[],
        estimated_recovery_days=0,
        ai_rationale="No drift detected. Keep doing what you're doing.",
        total_actions=0,
    )
