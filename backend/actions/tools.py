"""
MCP tool definitions for YU RestOS recovery actions.
"""

AVAILABLE_TOOLS = [
    {
        "id": "sleep_protocol",
        "name": "Sleep Hygiene Protocol",
        "description": "Deliver a targeted sleep optimization protocol based on drift drivers",
        "parameters": {
            "focus": {"type": "str", "options": ["temperature", "light", "timing", "wind_down"]},
        },
        "sponsor": None,
    },
    {
        "id": "book_wellness",
        "name": "Book Wellness Activity",
        "description": "Schedule a recovery activity (yoga, meditation, massage)",
        "execution": "Task handoff",
        "parameters": {
            "activity": {"type": "str"},
            "location": {"type": "str"},
            "preferred_time": {"type": "str"},
        },
        "sponsor": None,
    },
    {
        "id": "block_calendar",
        "name": "Block Calendar for Recovery",
        "description": "Create a protected wind-down block on your calendar",
        "parameters": {
            "event_title": {"type": "str"},
            "start_time": {"type": "str", "format": "HH:MM"},
            "end_time": {"type": "str", "format": "HH:MM"},
        },
        "sponsor": None,
    },
]


def execute_tool(tool_id: str, params: dict) -> dict:
    """Execute a recovery tool."""
    tool = next((t for t in AVAILABLE_TOOLS if t["id"] == tool_id), None)
    if not tool:
        return {"error": f"Tool {tool_id} not found"}

    return {
        "tool": tool["name"],
        "status": "executed",
        "parameters": {k: v for k, v in params.items() if k != "tool_id"},
        "result": f"{tool['name']} executed successfully",
    }
