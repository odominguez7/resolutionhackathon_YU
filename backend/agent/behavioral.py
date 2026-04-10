"""
LangGraph Behavioral Agent v1 (v2.1 Svc09).

A stateful agent that wakes on Cloud Scheduler (or manual trigger),
reads the AthleteContext, decides whether to act, composes a nudge,
and sends it via Telegram. Logs every decision to episodic memory.

Graph stages: perceive → assess → decide → compose → dispatch → observe

This is the first autonomous proactive behavior in YU: the agent
contacts the athlete before they open the app, based on what their
body is saying.
"""

from __future__ import annotations

import os
import json
from datetime import datetime
from typing import TypedDict, Literal
from zoneinfo import ZoneInfo

from langgraph.graph import StateGraph, START, END

BOSTON_TZ = ZoneInfo("America/New_York")


class AgentState(TypedDict, total=False):
    """State passed through the graph."""
    athlete_context: dict
    assessment: str
    action: Literal["nudge", "pre_generate", "no_op"]
    nudge_text: str
    nudge_sent: bool
    reason: str
    logged: bool


# ── Nodes ────────────────────────────────────────────────────────────────────

def perceive(state: AgentState) -> AgentState:
    """Read the athlete's current state from Oura data."""
    try:
        from backend.oura.routes import _sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day
        from backend.oura.athlete_context import build_athlete_context
        ctx = build_athlete_context(
            sleep_by_day=_sleep_by_day,
            score_by_day=_score_by_day,
            readiness_by_day=_readiness_by_day,
            stress_by_day=_stress_by_day,
        )
        return {**state, "athlete_context": ctx}
    except Exception as e:
        return {**state, "athlete_context": {}, "reason": f"perceive failed: {e}"}


def assess(state: AgentState) -> AgentState:
    """Evaluate whether the athlete needs a nudge today.
    Also checks if the current time is within the athlete's preferred
    training window — if not, defers the nudge (no-op now, send later)."""
    ctx = state.get("athlete_context") or {}
    bio = ctx.get("biometrics") or {}
    adherence = ctx.get("adherence_profile") or {}

    # Timing check: defer if outside the athlete's preferred window
    pref_window = adherence.get("preferred_training_window")
    if pref_window and pref_window.get("avg_hour"):
        now_hour = datetime.now(BOSTON_TZ).hour
        ideal = pref_window["avg_hour"]
        nudge_hour = max(0, ideal - 0.5)  # send 30 min before
        # If current hour is more than 2 hours before the nudge window,
        # defer — the scheduler will retry later or the next tick catches it
        if now_hour < nudge_hour - 2:
            return {**state, "assessment": f"timing_defer: current {now_hour}h, athlete trains ~{ideal}h, deferring",
                    "action": "no_op"}
    intensity = ctx.get("intensity_tier", "work")
    readiness = bio.get("readiness", 0)
    hrv = bio.get("hrv")
    hrv_bl = bio.get("hrv_baseline")
    streak = adherence.get("streak", 0)
    skipped = adherence.get("skipped_7d", 0)
    overtraining = ctx.get("overtraining_risk", "none")

    # Decision logic
    if overtraining == "veto":
        return {**state, "assessment": f"overtraining_veto: HRV below LCL, RHR above UCL. readiness={readiness}",
                "action": "nudge"}
    if skipped >= 2:
        return {**state, "assessment": f"streak_rebuild: {skipped} skips in 7d. streak={streak}",
                "action": "nudge"}
    if intensity == "push" and hrv and hrv_bl and hrv >= hrv_bl:
        return {**state, "assessment": f"push_day: HRV {hrv}ms >= baseline {hrv_bl}ms, readiness {readiness}",
                "action": "nudge"}
    if streak >= 5:
        return {**state, "assessment": f"streak_momentum: {streak} consecutive. keep the fire.",
                "action": "nudge"}
    # Default: no nudge needed
    return {**state, "assessment": f"stable: readiness={readiness}, intensity={intensity}, streak={streak}",
            "action": "no_op"}


def decide(state: AgentState) -> AgentState:
    """Route based on action."""
    return state


def compose(state: AgentState) -> AgentState:
    """Write the nudge message using Gemini."""
    if state.get("action") == "no_op":
        return {**state, "nudge_text": "", "reason": "no action needed"}

    ctx = state.get("athlete_context") or {}
    bio = ctx.get("biometrics") or {}
    assessment = state.get("assessment", "")

    # Compose with Gemini
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        return {**state, "nudge_text": _fallback_nudge(assessment, bio), "reason": "no gemini key, using fallback"}

    import httpx
    prompt = f"""You are YU Cortex, a behavioral intelligence agent for an athlete named Omar.
You must write ONE short Telegram message (under 100 words) based on this assessment:

ASSESSMENT: {assessment}

BIOMETRICS:
- Readiness: {bio.get('readiness', '?')}
- HRV: {bio.get('hrv', '?')}ms (baseline: {bio.get('hrv_baseline', '?')}ms)
- Sleep: {bio.get('sleep_score', '?')}
- Recovery context: {bio.get('recovery_context', '')}

RULES:
- Reference a real number from the data above
- Be direct, not motivational fluff
- No emojis, no exclamation marks
- End with what to do: "Your workout is ready" or "Take the day off" or "Shorter session today"
- Sound like a coach who knows this athlete, not a notification"""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        resp = httpx.post(url, json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.5, "maxOutputTokens": 200, "thinkingConfig": {"thinkingBudget": 0}},
        }, timeout=15.0)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        return {**state, "nudge_text": text}
    except Exception as e:
        return {**state, "nudge_text": _fallback_nudge(assessment, bio), "reason": f"gemini failed: {e}"}


def _fallback_nudge(assessment: str, bio: dict) -> str:
    readiness = bio.get("readiness", "?")
    if "veto" in assessment:
        return f"Readiness {readiness}. Your body is asking for rest today. Take it. The workout can wait."
    if "streak_rebuild" in assessment:
        return f"Readiness {readiness}. You've skipped a few lately. Today's session is shorter. Just show up."
    if "push" in assessment:
        return f"Readiness {readiness}. HRV is above baseline. Today is a push day. Your workout is ready."
    return f"Readiness {readiness}. Workout is ready when you are."


def dispatch(state: AgentState) -> AgentState:
    """Send the nudge via Telegram."""
    if not state.get("nudge_text"):
        return {**state, "nudge_sent": False}
    try:
        token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
        if not token or not chat_id:
            return {**state, "nudge_sent": False, "reason": "no telegram credentials"}
        import httpx
        msg = f"*YU Cortex*\n\n{state['nudge_text']}"
        resp = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"},
            timeout=10.0,
        )
        return {**state, "nudge_sent": resp.status_code == 200}
    except Exception as e:
        return {**state, "nudge_sent": False, "reason": f"dispatch failed: {e}"}


def observe(state: AgentState) -> AgentState:
    """Log the decision to episodic memory for future reference."""
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        entry = {
            "timestamp": datetime.now(BOSTON_TZ).isoformat(),
            "action": state.get("action"),
            "assessment": state.get("assessment"),
            "nudge_sent": state.get("nudge_sent", False),
            "nudge_text": state.get("nudge_text", "")[:500],
            "reason": state.get("reason", ""),
        }
        db.collection("agent_nudge_log").add(entry)
        return {**state, "logged": True}
    except Exception:
        return {**state, "logged": False}


# ── Graph ────────────────────────────────────────────────────────────────────

def should_compose(state: AgentState) -> str:
    if state.get("action") == "no_op":
        return "observe"
    return "compose"


def build_behavioral_graph():
    """Build the LangGraph stateful agent graph."""
    graph = StateGraph(AgentState)

    graph.add_node("perceive", perceive)
    graph.add_node("assess", assess)
    graph.add_node("compose", compose)
    graph.add_node("dispatch", dispatch)
    graph.add_node("observe", observe)

    graph.add_edge(START, "perceive")
    graph.add_edge("perceive", "assess")
    graph.add_conditional_edges("assess", should_compose, {"compose": "compose", "observe": "observe"})
    graph.add_edge("compose", "dispatch")
    graph.add_edge("dispatch", "observe")
    graph.add_edge("observe", END)

    return graph.compile()


# ── Runner ────────────────────────────────────────────────────────────────────

async def run_behavioral_tick() -> dict:
    """Execute one behavioral agent tick. Called by Cloud Scheduler or manually."""
    graph = build_behavioral_graph()
    result = graph.invoke({})
    return {
        "action": result.get("action"),
        "assessment": result.get("assessment"),
        "nudge_sent": result.get("nudge_sent", False),
        "nudge_text": result.get("nudge_text", "")[:200],
        "logged": result.get("logged", False),
    }
