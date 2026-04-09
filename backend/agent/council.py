"""
YU Council — picks today's spokesperson agent based on signal strength
relative to the user's active goal.

The agent with the largest |z-score| relevant to the goal speaks today.
The other 3 stay in the background as "listening".
"""

from .specialists import evaluate_all, AGENTS
from .goals import load_goal, METRIC_KEYS

# Maps target_metric -> the agent most relevant to it
GOAL_TO_AGENT = {
    "hrv": "heart",
    "rhr": "heart",
    "readiness": "readiness",
    "sleep": "sleep",
    "deep_sleep": "sleep",
}


def pick_spokesperson() -> dict:
    """The spokesperson is ALWAYS the agent that owns the user's goal metric.
    Coherence > drama. The goal is the north star — the agent watching that
    metric speaks every day. Other agents stay in the council, listening."""
    goal = load_goal()
    evals = evaluate_all()
    by_id = {e["id"]: e for e in evals}
    relevant_id = GOAL_TO_AGENT.get(goal.get("target_metric"), "heart")
    spokesperson = by_id.get(relevant_id) or evals[0]
    listening = [
        {
            "id": e["id"],
            "title": e["title"],
            "subtitle": e.get("subtitle"),
            "color": e["color"],
            "state": e["state"],
            "state_label": e.get("state_label"),
            "state_glyph": e.get("state_glyph"),
            "state_copy": e.get("state_copy"),
            "today_value": e.get("today_value"),
            "baseline_mean": e.get("baseline_mean"),
            "delta_pct": e.get("delta_pct"),
            "metric_label": e.get("metric_label"),
            "lower_is_worse": e.get("lower_is_worse"),
            "history": e.get("history"),
        }
        for e in evals if e["id"] != spokesperson["id"]
    ]
    return {
        "spokesperson": spokesperson,
        "listening": listening,
        "goal_relevant_id": relevant_id,
    }
