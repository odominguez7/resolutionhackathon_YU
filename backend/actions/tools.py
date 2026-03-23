"""
MCP tool definitions for YU RestOS recovery actions.
"""

AVAILABLE_TOOLS = [
    {
        "id": "adjust_temperature",
        "name": "Adjust Eight Sleep Temperature",
        "description": "Set Pod temperature for tonight based on sleep data analysis",
        "api_call": "PUT /v1/users/{id}/temperature",
        "parameters": {
            "heatingLevel": {"type": "int", "range": "-100 to +100"},
            "stage": {"type": "str", "options": ["bedTimeLevel", "initialSleepLevel", "finalSleepLevel"]},
        },
        "sponsor": "Eight Sleep",
    },
    {
        "id": "set_alarm",
        "name": "Set Consistent Wake Alarm",
        "description": "Set Eight Sleep thermal alarm for wakeup consistency",
        "api_call": "PUT /v1/users/{id}/alarms",
        "parameters": {
            "time": {"type": "str", "format": "HH:MM"},
            "vibration": {"type": "bool"},
            "thermal": {"type": "bool"},
        },
        "sponsor": "Eight Sleep",
    },
    {
        "id": "book_wellness",
        "name": "Book Wellness Activity",
        "description": "Schedule a recovery activity (yoga, meditation, massage)",
        "execution": "Duckbill-style task handoff",
        "parameters": {
            "activity": {"type": "str"},
            "location": {"type": "str"},
            "preferred_time": {"type": "str"},
        },
        "sponsor": "Duckbill",
    },
    {
        "id": "environment_recipe",
        "name": "Setup Sleep Sanctuary",
        "description": "Recommend environment changes for better recovery",
        "execution": "Wayfair product recommendations",
        "parameters": {
            "goal": {"type": "str", "options": ["deep_sleep", "stress_relief", "recovery"]},
            "budget": {"type": "str"},
        },
        "sponsor": "Wayfair",
    },
    {
        "id": "block_calendar",
        "name": "Block Calendar for Recovery",
        "description": "Create a protected wind-down block on your calendar",
        "api_call": "POST /calendar/v3/calendars/primary/events",
        "parameters": {
            "event_title": {"type": "str"},
            "start_time": {"type": "str", "format": "HH:MM"},
            "end_time": {"type": "str", "format": "HH:MM"},
        },
        "sponsor": None,
    },
]


def execute_tool(tool_id: str, params: dict) -> dict:
    """Simulate MCP tool execution for demo."""
    tool = next((t for t in AVAILABLE_TOOLS if t["id"] == tool_id), None)
    if not tool:
        return {"error": f"Tool {tool_id} not found"}

    return {
        "tool": tool["name"],
        "status": "executed",
        "sponsor": tool.get("sponsor", "YU RestOS"),
        "parameters": {k: v for k, v in params.items() if k != "tool_id"},
        "result": f"{tool['name']} executed successfully",
        "api_call": tool.get("api_call", "N/A"),
    }
