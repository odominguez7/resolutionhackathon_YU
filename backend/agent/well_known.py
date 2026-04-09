"""
A2A (Agent2Agent) Agent Cards for YU Cortex (Q31 application).

Each agent in the YU council publishes a machine-readable Agent Card so
external agents can discover capabilities and delegate work without
bespoke integration. Served at:

  /.well-known/agent.json                — YU council orchestrator
  /.well-known/agents/{specialist}.json  — heart, sleep, readiness, stress
"""

from __future__ import annotations

from .specialists import AGENTS

BASE_URL = "https://yu-restos-471409463813.us-east1.run.app"


def council_agent_card() -> dict:
    return {
        "schemaVersion": "0.2",
        "name": "yu-council",
        "displayName": "YU Council (Orchestrator)",
        "description": (
            "Top-level YU Cortex orchestrator. Decomposes a recovery / "
            "performance question into specialist subtasks (Heart, Sleep, "
            "Readiness, Stress) and integrates their answers into a single "
            "State Card."
        ),
        "version": "1.0.0",
        "url": f"{BASE_URL}/api/agent",
        "provider": {"name": "YU", "url": "https://yu.boston"},
        "authentication": {"schemes": ["none"]},
        "skills": [
            {
                "id": "daily_state_card",
                "description": "Produce today's spokesperson + listening council from real Oura signal.",
                "endpoint": f"{BASE_URL}/api/agent/ritual",
                "method": "GET",
            },
            {
                "id": "delegate_to_specialist",
                "description": "Delegate a focused subtask to one specialist agent.",
                "endpoint": f"{BASE_URL}/api/agent/specialists/{{name}}/reveal",
                "method": "POST",
            },
        ],
        "subAgents": [
            f"{BASE_URL}/.well-known/agents/{name}.json" for name in AGENTS
        ],
        "mcpServer": f"{BASE_URL}/mcp/manifest",
    }


def specialist_agent_card(name: str) -> dict | None:
    spec = AGENTS.get(name)
    if not spec:
        return None
    return {
        "schemaVersion": "0.2",
        "name": f"yu-{name}",
        "displayName": f"YU {spec['title']} Agent",
        "description": (
            f"{spec.get('subtitle', '')}. Reads {spec['metric_label']} "
            "from real Oura data, classifies it against the user's own "
            "28-day baseline, and produces one focused State Card."
        ),
        "version": "1.0.0",
        "url": f"{BASE_URL}/api/agent/specialists/{name}",
        "provider": {"name": "YU", "url": "https://yu.boston"},
        "authentication": {"schemes": ["none"]},
        "skills": [
            {
                "id": f"{name}_evaluate",
                "description": f"Return current state for the {name} agent (no Gemini call).",
                "endpoint": f"{BASE_URL}/api/agent/specialists/{name}",
                "method": "GET",
            },
            {
                "id": f"{name}_reveal",
                "description": f"Compose a full Gemini-written State Card for {name} given a mood score.",
                "endpoint": f"{BASE_URL}/api/agent/specialists/{name}/reveal",
                "method": "POST",
                "input": {"mood_score": "int (1-10)"},
            },
        ],
        "metric": {
            "label": spec["metric_label"],
            "keys": spec["metric_keys"],
            "lower_is_worse": spec["lower_is_worse"],
        },
        "parent": f"{BASE_URL}/.well-known/agent.json",
    }
