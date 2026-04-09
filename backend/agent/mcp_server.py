"""
MCP (Model Context Protocol) surface for YU Cortex (Q31 application).

Exposes the YU agent's tools in an MCP-compatible HTTP shape so any MCP
client (Claude Desktop, Cursor, another YU agent over A2A) can discover
and call them without bespoke integration.

Endpoints (mounted at /mcp):
  GET  /mcp/manifest       — server identity
  GET  /mcp/tools/list     — JSON-Schema tool definitions
  POST /mcp/tools/call     — invoke a tool by name {name, arguments}
  GET  /mcp/resources/list — readable memory/state resources
  GET  /mcp/resources/read?uri=... — read one resource

This is the HTTP/JSON variant of MCP — same conceptual contract as the
stdio JSON-RPC variant, just easier to expose alongside the existing
FastAPI app and call from a browser demo.
"""

from __future__ import annotations

import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException

from .tools import TOOL_DEFINITIONS, run_tool
from .memory_long import (
    load_semantic,
    write_semantic,
    load_rituals,
    write_ritual,
)

router = APIRouter()

SERVER_NAME = "yu-cortex-mcp"
SERVER_VERSION = "1.0.0"


# ── JSON Schema for each tool ──────────────────────────────────────────────

_PARAM_TYPE_HINTS = {
    "int": {"type": "integer"},
    "str": {"type": "string"},
    "list": {"type": "array", "items": {"type": "string"}},
}


def _schema_for(param_doc: str) -> dict:
    head = (param_doc or "").split(",", 1)[0].strip().lower()
    if head in _PARAM_TYPE_HINTS:
        return {**_PARAM_TYPE_HINTS[head], "description": param_doc}
    return {"type": "string", "description": param_doc}


def _tool_to_mcp(tool: dict) -> dict:
    props = {
        name: _schema_for(doc) for name, doc in (tool.get("parameters") or {}).items()
    }
    return {
        "name": tool["name"],
        "description": tool["description"],
        "inputSchema": {
            "type": "object",
            "properties": props,
            "additionalProperties": False,
        },
    }


# Extra MCP-only tools that wrap state + memory + rag + predictions
_EXTRA_TOOLS = [
    {
        "name": "read_agent_state",
        "description": "Read the YU agent's persistent state: baseline, drift history, intervention log, effectiveness summary.",
        "parameters": {},
    },
    {
        "name": "rag_search",
        "description": "Search the YU clinical RAG knowledge base (drift research, recovery science) and return top chunks with provenance.",
        "parameters": {"query": "str, natural-language query", "top_k": "int, default 3"},
    },
    {
        "name": "make_prediction",
        "description": "Predict drift probability over the next 72h from current Oura data.",
        "parameters": {},
    },
    {
        "name": "remember_fact",
        "description": "Write a stable user fact / preference into semantic memory with provenance tagging.",
        "parameters": {"key": "str", "value": "str", "source": "str"},
    },
    {
        "name": "save_ritual",
        "description": "Store a procedural how-to (ritual) the agent can replay later.",
        "parameters": {"name": "str", "trigger": "str", "steps": "list of strings", "source": "str"},
    },
]


@router.get("/manifest")
def mcp_manifest():
    return {
        "name": SERVER_NAME,
        "version": SERVER_VERSION,
        "protocol": "mcp/0.1-http",
        "vendor": "YU",
        "description": "YU Cortex tools, state, RAG, and long-term memory exposed over MCP.",
    }


@router.get("/tools/list")
def mcp_tools_list():
    tools = [_tool_to_mcp(t) for t in TOOL_DEFINITIONS] + [_tool_to_mcp(t) for t in _EXTRA_TOOLS]
    return {"tools": tools}


@router.post("/tools/call")
async def mcp_tools_call(payload: dict):
    name = (payload or {}).get("name")
    args = (payload or {}).get("arguments") or {}
    if not name:
        raise HTTPException(400, "missing tool name")

    # Built-in tools dispatcher
    if name in {t["name"] for t in TOOL_DEFINITIONS}:
        return {"name": name, "result": run_tool(name, args)}

    # Extra MCP-only tools
    if name == "read_agent_state":
        from .state import AgentState
        return {"name": name, "result": AgentState.load().to_status()}

    if name == "rag_search":
        from .rag import retrieve
        results = await retrieve(args.get("query", ""), int(args.get("top_k", 3) or 3))
        return {"name": name, "result": results}

    if name == "make_prediction":
        from backend.drift.routes import _build_daily_data
        from .prediction import predict_drift
        return {"name": name, "result": predict_drift(_build_daily_data())}

    if name == "remember_fact":
        rec = write_semantic(
            args.get("key", ""),
            args.get("value", ""),
            args.get("source", "mcp_client"),
        )
        return {"name": name, "result": rec}

    if name == "save_ritual":
        rec = write_ritual(
            args.get("name", ""),
            args.get("trigger", ""),
            args.get("steps", []),
            args.get("source", "mcp_client"),
        )
        return {"name": name, "result": rec}

    raise HTTPException(404, f"unknown tool: {name}")


# ── Resources (readable memory) ────────────────────────────────────────────

_RESOURCES = [
    {"uri": "yu://state",     "name": "Agent state",      "mimeType": "application/json"},
    {"uri": "yu://semantic",  "name": "Semantic memory",  "mimeType": "application/json"},
    {"uri": "yu://rituals",   "name": "Procedural memory", "mimeType": "application/json"},
    {"uri": "yu://goal",      "name": "Active goal",      "mimeType": "application/json"},
]


@router.get("/resources/list")
def mcp_resources_list():
    return {"resources": _RESOURCES}


@router.get("/resources/read")
def mcp_resources_read(uri: str):
    if uri == "yu://state":
        from .state import AgentState
        return {"uri": uri, "contents": AgentState.load().to_status()}
    if uri == "yu://semantic":
        return {"uri": uri, "contents": load_semantic()}
    if uri == "yu://rituals":
        return {"uri": uri, "contents": {"rituals": load_rituals()}}
    if uri == "yu://goal":
        from .goals import goal_progress
        return {"uri": uri, "contents": goal_progress()}
    raise HTTPException(404, f"unknown resource: {uri}")
