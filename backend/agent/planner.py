"""
Agent Planner — LLM-powered reasoning engine.

Takes the current drift state, biometric data, intervention history, and
available tools, then decides what actions the agent should take. This is
where autonomy lives: the LLM reasons about WHAT to do and WHY, not just
generates text.

Uses Gemini 2.5 Flash for fast, cheap reasoning.
"""

import json
import os
import httpx
from datetime import datetime
from zoneinfo import ZoneInfo
from .tools import TOOL_DEFINITIONS

BOSTON_TZ = ZoneInfo("America/New_York")


def _get_gemini_key() -> str:
    # Try env first, then .env file
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        key = line.split("=", 1)[1].strip()
                        break
    return key


PLANNER_SYSTEM_PROMPT = """You are YU Cortex, the behavioral intelligence decision engine. You monitor a person's
biometric data from their Oura Ring and decide when and how to intervene.

YOUR ROLE: Analyze drift data, review what interventions worked in the past,
and select 1-3 actions from the available tools. You are autonomous — you
decide what to do without asking the user.

DECISION PRINCIPLES:
1. Only intervene when drift is detected (3+ consecutive days of decline)
2. Prefer interventions that have worked before (check history)
3. Don't over-intervene — if drift is low severity, 1 action is enough
4. If the same intervention failed twice recently, try something different
5. Always explain your reasoning in 2-3 sentences

SEVERITY GUIDELINES:
- high: 2-3 actions, aggressive recovery (sleep protocol + block calendar + coaching)
- medium: 1-2 actions, moderate recovery (coaching + one environmental change)
- low: 1 action, gentle nudge (coaching only)
- none: use no_action tool with reason

OUTPUT FORMAT (strict JSON):
{
  "reasoning": "2-3 sentences explaining your decision",
  "actions": [
    {
      "tool": "tool_name",
      "params": { ... },
      "why": "one sentence why this specific action"
    }
  ]
}"""


async def plan_interventions(
    drift_analysis: dict,
    biometrics: dict,
    intervention_history: list[dict],
) -> dict:
    """Use LLM to decide what interventions to deploy."""

    if not drift_analysis.get("drift_detected", False):
        return {
            "reasoning": "No drift detected. Baseline is stable. No intervention needed.",
            "actions": [
                {
                    "tool": "no_action",
                    "params": {"reason": "Baseline stable, no drift detected"},
                    "why": "All metrics within normal range",
                }
            ],
        }

    # Retrieve relevant research via RAG
    rag_context = ""
    rag_count = 0
    from .rag import retrieve
    drivers_str = ", ".join(d.get("metric", "") for d in drift_analysis.get("drivers", []))
    severity = drift_analysis.get("severity", "medium")
    query = f"{severity} drift with {drivers_str} declining. Recovery interventions needed."
    try:
        rag_results = await retrieve(query, top_k=3)
        if rag_results:
            rag_context = "\n\nRESEARCH CONTEXT (from clinical literature -- cite these when reasoning):\n" + "\n---\n".join(r["text"] for r in rag_results)
            rag_count = len(rag_results)
            print(f"[agent/planner] RAG retrieved {rag_count} chunks (scores: {[r['score'] for r in rag_results]})")
        else:
            print("[agent/planner] RAG returned no results")
    except Exception as e:
        import traceback
        print(f"[agent/planner] RAG failed: {e}")
        traceback.print_exc()

    # Build the prompt with real data + RAG context
    user_prompt = _build_planner_prompt(drift_analysis, biometrics, intervention_history) + rag_context

    # Try LLM call
    plan = await _call_gemini(user_prompt)
    if not plan:
        plan = _rule_based_plan(drift_analysis, biometrics, intervention_history)

    plan["rag_used"] = rag_count > 0
    plan["rag_chunks"] = rag_count
    return plan


def _build_planner_prompt(
    drift: dict, biometrics: dict, history: list[dict]
) -> str:
    severity = drift.get("severity", "none")
    days = drift.get("consecutive_days", 0)
    drivers = drift.get("drivers", [])
    baseline = drift.get("baseline", {})
    latest = biometrics.get("latest", biometrics)

    # Format intervention history
    history_text = "No prior interventions recorded."
    if history:
        lines = []
        for h in history[-10:]:
            outcome = h.get("outcome", "pending")
            score = h.get("effectiveness_score")
            score_str = f" (score: {score})" if score is not None else ""
            lines.append(f"- {h.get('title', h.get('action_type', '?'))}: {outcome}{score_str}")
        history_text = "\n".join(lines)

    # Format available tools
    tools_text = "\n".join(
        f"- {t['name']}: {t['description']}"
        for t in TOOL_DEFINITIONS
    )

    return f"""CURRENT DRIFT STATE:
- Severity: {severity}
- Consecutive days declining: {days}
- Drift drivers: {", ".join(d.get("metric", "unknown") for d in drivers)}

LATEST BIOMETRICS:
- HRV: {latest.get('hrv', '?')}ms (baseline: {baseline.get('hrv', '?')}ms)
- Sleep Score: {latest.get('sleepScore', '?')} (baseline: {baseline.get('sleepScore', '?')})
- Readiness: {latest.get('readinessScore', '?')} (baseline: {baseline.get('readiness', '?')})
- RHR: {latest.get('avgHeartRate', '?')} bpm
- Deep Sleep: {latest.get('deepSleepMin', '?')} min
- Stress Minutes: {latest.get('stressMin', '?')}

PAST INTERVENTION OUTCOMES:
{history_text}

AVAILABLE TOOLS:
{tools_text}

Based on the drift severity, drivers, and what has worked before, decide which interventions to deploy. Respond in strict JSON."""


async def _call_gemini(user_prompt: str) -> dict | None:
    GEMINI_API_KEY = _get_gemini_key()
    if not GEMINI_API_KEY:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": f"{PLANNER_SYSTEM_PROMPT}\n\n{user_prompt}"}],
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            from .security import assert_egress_allowed
            assert_egress_allowed(url)
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        text = data["candidates"][0]["content"]["parts"][0]["text"]

        # Clean up potential markdown fencing
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        # Fix trailing commas (common Gemini issue)
        import re
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)

        plan = json.loads(text)

        # Validate structure
        if "actions" not in plan:
            plan = {"reasoning": plan.get("reasoning", ""), "actions": []}
        for action in plan["actions"]:
            if "tool" not in action:
                continue
            if "params" not in action:
                action["params"] = {}

        plan["source"] = "gemini"
        return plan

    except Exception as e:
        print(f"[agent/planner] Gemini call failed: {e}")
        return None


def _rule_based_plan(
    drift: dict, biometrics: dict, history: list[dict]
) -> dict:
    """Fallback when LLM is unavailable."""
    severity = drift.get("severity", "none")
    drivers = {d["metric"] for d in drift.get("drivers", [])}
    actions = []

    if severity == "high":
        actions.append({
            "tool": "sleep_protocol",
            "params": {"focus": "temperature"},
            "why": "High severity drift — sleep hygiene protocol for deep sleep recovery",
        })
        actions.append({
            "tool": "block_calendar",
            "params": {"title": "Recovery Wind-Down (YU)", "start_hour": 21, "duration_min": 60},
            "why": "Protect wind-down time to break the drift cycle",
        })
        focus = "stress" if "stress" in drivers else "sleep" if "sleep_score" in drivers else "recovery"
        actions.append({
            "tool": "send_coaching",
            "params": {"drift_drivers": list(drivers), "severity": severity, "focus": focus},
            "why": f"Deliver targeted coaching for {focus}",
        })

    elif severity == "medium":
        focus = "stress" if "stress" in drivers else "sleep" if "sleep_score" in drivers else "recovery"
        actions.append({
            "tool": "send_coaching",
            "params": {"drift_drivers": list(drivers), "severity": severity, "focus": focus},
            "why": f"Medium drift driven by {focus}",
        })
        if "hrv" in drivers or "readiness" in drivers:
            actions.append({
                "tool": "recommend_workout",
                "params": {"intensity": "light", "type": "active_recovery"},
                "why": "HRV/readiness low — reduce training load",
            })

    elif severity == "low":
        focus = list(drivers)[0] if drivers else "recovery"
        actions.append({
            "tool": "send_coaching",
            "params": {"drift_drivers": list(drivers), "severity": severity, "focus": focus},
            "why": f"Gentle nudge for low-severity {focus} drift",
        })

    return {
        "reasoning": f"Rule-based plan: {severity} severity drift with drivers {list(drivers)}. LLM unavailable, using fallback logic.",
        "actions": actions,
        "source": "rule_based",
    }
