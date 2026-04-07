"""
Concierge task queue -- Duckbill-style execution.

For hackathon: Wizard-of-Oz simulation showing realistic task status progression.
In production: dispatches to real human agents.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
import uuid

BOSTON_TZ = ZoneInfo("America/New_York")

_task_queue: dict[str, dict] = {}


def dispatch_task(action) -> dict:
    task_id = str(uuid.uuid4())[:8]

    task = {
        "task_id": task_id,
        "action_title": action.title,
        "action_type": action.action_type,
        "parameters": action.parameters,
        "status": "dispatched",
        "status_history": [
            {"status": "received", "timestamp": datetime.now(BOSTON_TZ).isoformat(), "message": "Task received by YU RestOS"},
            {"status": "dispatched", "timestamp": datetime.now(BOSTON_TZ).isoformat(), "message": "Recovery agent assigned"},
        ],
        "estimated_completion": "Within 2 hours",
        "agent_name": "YU Recovery Agent",
    }

    _task_queue[task_id] = task
    return task


def get_task_status(task_id: str) -> dict:
    task = _task_queue.get(task_id)
    if not task:
        return {"error": "Task not found"}
    return task


def simulate_task_progress(task_id: str) -> dict:
    """Advance task through its lifecycle for demo."""
    task = _task_queue.get(task_id)
    if not task:
        return {"error": "Task not found"}

    current = task["status"]

    progression = {
        "dispatched": {
            "next": "in_progress",
            "message": "Agent is searching for available sessions near you",
        },
        "in_progress": {
            "next": "booked",
            "message": "Found a yoga session nearby -- tomorrow 8:30 AM. Booking confirmed.",
        },
        "booked": {
            "next": "completed",
            "message": "Booking confirmed. Calendar invite sent. See you tomorrow at 8:30 AM.",
        },
    }

    if current in progression:
        next_step = progression[current]
        task["status"] = next_step["next"]
        task["status_history"].append({
            "status": next_step["next"],
            "timestamp": datetime.now(BOSTON_TZ).isoformat(),
            "message": next_step["message"],
        })

    return task
