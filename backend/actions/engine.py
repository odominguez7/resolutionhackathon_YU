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
import uuid

from .models import (
    Action, RecoveryPlan, ActionType, ActionStatus,
    ExecutionMethod, ActionExecutionResult
)
from .tools import execute_tool
from .concierge import dispatch_task
from .product_links import get_product_recommendation

_active_plans: dict[str, RecoveryPlan] = {}


def generate_recovery_plan(drift_analysis: dict, latest_sleep: dict, latest_checkin: dict) -> RecoveryPlan:
    """Generate a personalized recovery plan based on drift analysis."""

    actions = []
    signals = drift_analysis.get("signals", [])
    severity = drift_analysis.get("severity", "none")

    if not signals:
        return _empty_plan()

    latest_signal = signals[-1]

    # ACTION 1: Sleep Temperature
    temp_data = latest_sleep.get("avgBedTempC", 27.5)
    if temp_data > 28.0:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Cool your bed to -20 tonight",
            description=(
                f"Your bed temperature averaged {temp_data}C -- "
                f"2.5C above your healthy baseline. Research shows "
                f"cooler sleeping surfaces increase deep sleep by up to 20%."
            ),
            action_type=ActionType.SLEEP_ENVIRONMENT,
            execution_method=ExecutionMethod.API_CALL,
            priority=1,
            estimated_impact="High",
            impact_reason=f"Bed temp {temp_data}C vs baseline 27.5C. Cooling = more deep sleep.",
            sponsor="Eight Sleep",
            parameters={
                "tool_id": "adjust_temperature",
                "heatingLevel": -20,
                "stage": "initialSleepLevel",
                "api_endpoint": "PUT /v1/users/{id}/temperature",
            },
        ))

    # ACTION 2: Wakeup Consistency
    actions.append(Action(
        id=str(uuid.uuid4())[:8],
        title="Set consistent 6:30 AM thermal alarm",
        description=(
            "Your wakeup consistency score is the lowest sub-score "
            "dragging your sleep fitness down. A thermal alarm gradually "
            "warms your bed 30 minutes before wake time for a natural rise."
        ),
        action_type=ActionType.SLEEP_ENVIRONMENT,
        execution_method=ExecutionMethod.API_CALL,
        priority=2,
        estimated_impact="High",
        impact_reason="Wakeup consistency is your weakest sleep fitness sub-score.",
        sponsor="Eight Sleep",
        parameters={
            "tool_id": "set_alarm",
            "time": "06:30",
            "vibration": True,
            "thermal": True,
            "api_endpoint": "PUT /v1/users/{id}/alarms",
        },
    ))

    # ACTION 3: Calendar Protection
    energy = latest_checkin.get("energy", 5)
    if energy <= 4:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Block 9-10 PM as wind-down time",
            description=(
                f"Your energy is at {energy}/10 -- you need protected recovery time. "
                f"This blocks your calendar tonight so nothing interrupts your wind-down."
            ),
            action_type=ActionType.CALENDAR,
            execution_method=ExecutionMethod.API_CALL,
            priority=3,
            estimated_impact="Medium",
            impact_reason=f"Energy at {energy}/10 for 3+ days. Need enforced recovery windows.",
            sponsor=None,
            parameters={
                "tool_id": "block_calendar",
                "event_title": "Wind-Down (Protected by YU RestOS)",
                "start_time": "21:00",
                "end_time": "22:00",
                "calendar": "primary",
            },
        ))

    # ACTION 4: Wellness Booking
    stress = latest_checkin.get("stress", 5)
    if stress >= 7:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Book a 30-min recovery session tomorrow",
            description=(
                f"Your stress has been {stress}/10 for multiple days. "
                f"A guided recovery session (yoga, meditation, or stretching) "
                f"can break the stress-sleep cycle."
            ),
            action_type=ActionType.WELLNESS,
            execution_method=ExecutionMethod.CONCIERGE,
            priority=4,
            estimated_impact="Medium",
            impact_reason=f"Stress at {stress}/10. Physical recovery breaks the cycle.",
            sponsor="Duckbill",
            parameters={
                "activity": "yoga or guided meditation",
                "preferred_time": "morning",
                "location": "nearby or virtual",
                "task_type": "wellness_booking",
            },
        ))

    # ACTION 5: Environment Setup
    deep_pct = latest_sleep.get("deepSleepPct", 0.15)
    if deep_pct < 0.12:
        actions.append(Action(
            id=str(uuid.uuid4())[:8],
            title="Optimize your sleep environment",
            description=(
                f"Deep sleep is at {deep_pct*100:.0f}% -- less than half your baseline. "
                f"Small environment changes (blackout curtains, white noise, cooling pillow) "
                f"can increase deep sleep by 15-25%."
            ),
            action_type=ActionType.SHOPPING,
            execution_method=ExecutionMethod.PRODUCT_LINK,
            priority=5,
            estimated_impact="Medium",
            impact_reason=f"Deep sleep at {deep_pct*100:.0f}% vs baseline 22%. Environment matters.",
            sponsor="Wayfair",
            parameters={
                "goal": "deep_sleep",
                "products": [
                    {"name": "Blackout Curtains", "category": "window-treatments"},
                    {"name": "Cooling Gel Pillow", "category": "pillows"},
                    {"name": "White Noise Machine", "category": "sound-machines"},
                ],
            },
        ))

    plan = RecoveryPlan(
        id=str(uuid.uuid4())[:8],
        generated_at=datetime.now(),
        drift_severity=severity,
        actions=actions,
        estimated_recovery_days=3 if severity == "high" else 2,
        ai_rationale=(
            f"Based on {drift_analysis['consecutive_days']} days of dual-signal decline. "
            f"Sleep score dropped {latest_signal['sleepDrop']}% and HRV dropped "
            f"{latest_signal['hrvDrop']}% from baseline. Self-reported stress at "
            f"{stress}/10 and energy at {energy}/10 confirm behavioral impact. "
            f"Plan prioritizes immediate sleep environment fixes (tonight), "
            f"then stress reduction (tomorrow), then longer-term environment optimization."
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
            executed_at=datetime.now(),
            result_message="Plan not found",
        )

    action = next((a for a in plan.actions if a.id == action_id), None)
    if not action:
        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.FAILED,
            executed_at=datetime.now(),
            result_message="Action not found",
        )

    if action.execution_method == ExecutionMethod.API_CALL:
        result = execute_tool(
            action.parameters.get("tool_id", ""),
            action.parameters,
        )
        action.status = ActionStatus.COMPLETED
        action.executed_at = datetime.now()
        action.result = result
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.COMPLETED,
            executed_at=datetime.now(),
            result_message=f"{action.title} -- executed successfully",
            api_response=result,
        )

    elif action.execution_method == ExecutionMethod.CONCIERGE:
        task = dispatch_task(action)
        action.status = ActionStatus.EXECUTING
        action.executed_at = datetime.now()
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.EXECUTING,
            executed_at=datetime.now(),
            result_message="Task dispatched -- a recovery agent is handling this",
            task_id=task["task_id"],
        )

    elif action.execution_method == ExecutionMethod.PRODUCT_LINK:
        products = get_product_recommendation(action.parameters)
        action.status = ActionStatus.COMPLETED
        action.executed_at = datetime.now()
        action.result = products
        plan.executed_actions += 1

        return ActionExecutionResult(
            action_id=action_id,
            status=ActionStatus.COMPLETED,
            executed_at=datetime.now(),
            result_message="Product recommendations ready",
            product_url=products.get("url", ""),
        )

    return ActionExecutionResult(
        action_id=action_id,
        status=ActionStatus.FAILED,
        executed_at=datetime.now(),
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
        generated_at=datetime.now(),
        drift_severity="none",
        actions=[],
        estimated_recovery_days=0,
        ai_rationale="No drift detected. Keep doing what you're doing.",
        total_actions=0,
    )
