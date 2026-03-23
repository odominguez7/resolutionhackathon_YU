from fastapi import APIRouter
from .engine import (
    generate_recovery_plan, execute_action, execute_all_actions, get_plan,
)
from .concierge import get_task_status, simulate_task_progress
from .product_links import get_product_recommendation
from drift.engine import detect_drift
from eight_sleep.mock_data import MOCK_TRENDS
from checkin.store import get_all_checkins

router = APIRouter()


@router.get("/plan/generate")
def create_recovery_plan():
    drift_analysis = detect_drift(MOCK_TRENDS, get_all_checkins())
    latest_sleep = MOCK_TRENDS[-1]
    latest_checkin = get_all_checkins()[-1]
    plan = generate_recovery_plan(drift_analysis, latest_sleep, latest_checkin)
    return plan.model_dump()


@router.get("/plan/{plan_id}")
def get_recovery_plan(plan_id: str):
    plan = get_plan(plan_id)
    if not plan:
        return {"error": "Plan not found"}
    return plan.model_dump()


@router.post("/plan/{plan_id}/execute/{action_id}")
def execute_single_action(plan_id: str, action_id: str):
    result = execute_action(plan_id, action_id)
    return result.model_dump()


@router.post("/plan/{plan_id}/execute-all")
def execute_all(plan_id: str):
    results = execute_all_actions(plan_id)
    return {"results": [r.model_dump() for r in results]}


@router.get("/task/{task_id}")
def check_task(task_id: str):
    return get_task_status(task_id)


@router.post("/task/{task_id}/advance")
def advance_task(task_id: str):
    return simulate_task_progress(task_id)


@router.get("/products/{goal}")
def get_products(goal: str):
    return get_product_recommendation({"goal": goal})
