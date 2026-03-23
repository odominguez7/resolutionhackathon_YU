from fastapi import APIRouter
from .models import RecoveryFeedback
from .store import save_feedback, get_feedback, get_effectiveness

router = APIRouter()


@router.post("/submit")
def submit_feedback(data: RecoveryFeedback):
    save_feedback(data.model_dump())
    return {"status": "saved", "plan_id": data.plan_id}


@router.get("/{plan_id}")
def get_plan_feedback(plan_id: str):
    result = get_feedback(plan_id)
    if result:
        return result
    return {"error": "No feedback found"}


@router.get("/{plan_id}/effectiveness")
def get_plan_effectiveness(plan_id: str):
    return get_effectiveness(plan_id)
