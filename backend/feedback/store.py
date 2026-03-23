from datetime import datetime

_feedback_store: dict[str, dict] = {}

MOCK_FEEDBACK = {
    "demo_plan": {
        "plan_id": "demo_plan",
        "date": "2026-03-28",
        "overall_rating": 4,
        "sleep_improved": True,
        "energy_improved": True,
        "stress_reduced": False,
        "most_helpful_action": "adjust_temperature",
        "least_helpful_action": None,
        "notes": "Slept way better with the cooler bed. Still stressed about midterms though.",
        "timestamp": datetime.now().isoformat(),
    }
}


def save_feedback(data: dict):
    _feedback_store[data["plan_id"]] = data


def get_feedback(plan_id: str) -> dict | None:
    return _feedback_store.get(plan_id) or MOCK_FEEDBACK.get(plan_id)


def get_effectiveness(plan_id: str) -> dict:
    feedback = get_feedback(plan_id)
    if not feedback:
        return {"feedback_submitted": False, "recovery_verdict": "no_data"}

    return {
        "plan_id": plan_id,
        "feedback_submitted": True,
        "sleep_score_change": +8,
        "hrv_change": +4,
        "mood_change": +1,
        "energy_change": +2,
        "actions_executed": 4,
        "actions_effective": 3,
        "recovery_verdict": "recovering",
    }
