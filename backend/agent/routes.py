"""
Agent API Routes — expose the autonomous agent to the frontend and external systems.
"""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import APIRouter

BOSTON_TZ = ZoneInfo("America/New_York")
from .loop import agent_tick, get_agent_status, get_agent_log, get_agent_effectiveness, get_latest_tick
from .tools import TOOL_DEFINITIONS
from .team import generate_team_stats
from .nanda import query_network, get_agentfacts

router = APIRouter()


@router.get("/status")
def agent_status():
    """Current agent state: tick count, last drift, effectiveness summary."""
    return get_agent_status()


@router.post("/trigger")
async def trigger_tick():
    """Manually trigger one agent loop cycle."""
    result = await agent_tick()
    return result


@router.get("/log")
def agent_log():
    """Full history of agent ticks, decisions, and outcomes."""
    return get_agent_log()


@router.get("/reasoning")
def agent_reasoning():
    """Last tick's LLM reasoning trace."""
    tick = get_latest_tick()
    if not tick:
        return {"reasoning": "No ticks executed yet. Trigger the agent first."}
    decide = tick.get("phases", {}).get("decide", {})
    return {
        "reasoning": decide.get("reasoning", ""),
        "source": decide.get("source", "unknown"),
        "actions": decide.get("actions", []),
        "drift_severity": tick.get("phases", {}).get("think", {}).get("severity", "none"),
        "tick_number": tick.get("tick_number", 0),
        "timestamp": tick.get("timestamp", ""),
    }


@router.get("/effectiveness")
def agent_effectiveness():
    """Intervention effectiveness data (the closed loop)."""
    return get_agent_effectiveness()


@router.get("/tools")
def agent_tools():
    """List all tools available to the agent."""
    return {"tools": TOOL_DEFINITIONS}


@router.get("/agentfacts")
def agent_facts():
    """NANDA-compatible AgentFacts for discoverability on Join39."""
    return {
        "agent_name": "YU Cortex",
        "label": "YU Cortex — Behavioral Intelligence",
        "description": (
            "Autonomous behavioral intelligence system that monitors biometric signals from "
            "Oura Ring, detects behavioral drift using weighted z-score analysis, "
            "delivers CBT-grounded micro-interventions, and measures recovery "
            "outcomes in a closed loop."
        ),
        "version": "1.0",
        "jurisdiction": "USA",
        "provider": {
            "name": "YU",
            "url": "https://yu.boston",
        },
        "capabilities": {
            "modalities": ["text", "data"],
            "streaming": False,
            "batch": True,
        },
        "skills": [
            {
                "id": "drift_detection",
                "description": "Detect behavioral drift from passive biometric signals (HRV, sleep, readiness, stress, RHR, deep sleep)",
                "inputModes": ["data"],
                "outputModes": ["text", "data"],
            },
            {
                "id": "wellness_coaching",
                "description": "Deliver CBT-grounded micro-interventions matched to drift drivers",
                "inputModes": ["data"],
                "outputModes": ["text"],
            },
            {
                "id": "intervention_effectiveness",
                "description": "Measure whether interventions improved biometric outcomes (closed-loop evaluation)",
                "inputModes": ["data"],
                "outputModes": ["data"],
            },
            {
                "id": "team_pulse",
                "description": "Anonymous team-level wellness analytics for employers",
                "inputModes": ["data"],
                "outputModes": ["data"],
            },
        ],
        "tools": [t["name"] for t in TOOL_DEFINITIONS],
        "agentic_loop": {
            "description": "Autonomous sense→think→decide→act→measure loop",
            "interval": "every 6 hours",
            "phases": ["sense", "think", "decide", "act", "measure"],
        },
    }


@router.get("/team")
def team_dashboard():
    """Anonymous team-level wellness data for employer dashboard."""
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data()
    return generate_team_stats(daily)


@router.post("/chat")
async def agent_chat(payload: dict):
    """Conversational agent — answers questions with full biometric context."""
    import os
    import json
    import httpx
    from .tools import execute_get_biometrics, execute_detect_drift
    from .loop import get_agent_status

    message = payload.get("message", "")
    if not message:
        return {"response": "Send me a message and I'll help you."}

    bio = execute_get_biometrics({"days": 7})
    drift = execute_detect_drift({})
    status = get_agent_status()
    latest = bio.get("latest", {})

    context = f"""BIOMETRICS (last 7 days):
- HRV: {latest.get('hrv', '?')}ms, Sleep: {latest.get('sleepScore', '?')}, Readiness: {latest.get('readinessScore', '?')}
- RHR: {latest.get('avgHeartRate', '?')} bpm, Deep Sleep: {latest.get('deepSleepMin', '?')} min
- 7-day averages: {json.dumps(bio.get('averages', {}))}

DRIFT STATUS:
- Detected: {drift.get('drift_detected')}, Severity: {drift.get('severity', 'none')}
- Consecutive days: {drift.get('consecutive_days', 0)}
- Drivers: {', '.join(d['metric'] for d in drift.get('drivers', []))}
- Baseline: {json.dumps(drift.get('baseline', {}))}

AGENT STATUS:
- Total ticks: {status.get('tick_count', 0)}, Interventions: {status.get('total_interventions', 0)}
- Effectiveness: {json.dumps(status.get('effectiveness_summary', {}))}"""

    system = """You are YU Cortex, an autonomous behavioral intelligence system. You have access to the user's real biometric data from their Oura Ring. Answer their questions using the data provided. Be direct, cite specific numbers, and give actionable advice. Keep responses under 150 words. Don't diagnose medical conditions."""

    key = ""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip()

    if not key:
        key = os.getenv("GEMINI_API_KEY", "")

    if not key:
        return {"response": "I need a Gemini API key to respond. Configure GEMINI_API_KEY.", "source": "error"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    api_payload = {
        "contents": [{"role": "user", "parts": [{"text": f"{system}\n\nCONTEXT:\n{context}\n\nUSER: {message}"}]}],
        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 400, "thinkingConfig": {"thinkingBudget": 0}},
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=api_payload)
            resp.raise_for_status()
            data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"response": text, "source": "gemini", "context_used": True}
    except Exception as e:
        return {"response": f"Something went wrong: {str(e)}", "source": "error"}


@router.get("/nanda/collaborators")
async def list_collaborators():
    """List agents YU Cortex can discover on NANDA."""
    return await query_network()


@router.get("/nanda/query")
async def query_nanda_network():
    """Query the NANDA network for enrichment data."""
    from .tools import execute_detect_drift
    drift = execute_detect_drift({})
    drivers = [d["metric"] for d in drift.get("drivers", [])]
    result = await query_network(
        drift_detected=drift.get("drift_detected", False),
        drivers=drivers,
    )
    return result


@router.post("/rag/index")
async def index_rag():
    """Index the drift research document into Firestore for RAG retrieval."""
    from .rag import index_knowledge
    return await index_knowledge()


@router.get("/rag/query")
async def query_rag(q: str = "HRV declining and sleep quality dropping"):
    """Test RAG retrieval with a query."""
    from .rag import retrieve
    results = await retrieve(q)
    return {"query": q, "results": results}


@router.get("/predict")
def predict_drift_endpoint():
    """Predict drift probability in the next 72 hours."""
    from backend.drift.routes import _build_daily_data
    from .prediction import predict_drift, analyze_triggers
    daily = _build_daily_data()
    prediction = predict_drift(daily)
    triggers = analyze_triggers(daily) if prediction["probability"] >= 30 else {"triggers": []}
    return {"prediction": prediction, "triggers": triggers}


@router.post("/checkin")
async def submit_checkin(payload: dict):
    """10-second check-in: energy, mood, stress (1-10 each). Stored in Firestore."""
    from datetime import datetime
    entry = {
        "energy": payload.get("energy", 5),
        "mood": payload.get("mood", 5),
        "stress": payload.get("stress", 5),
        "timestamp": datetime.now(BOSTON_TZ).isoformat(),
        "day": datetime.now(BOSTON_TZ).strftime("%Y-%m-%d"),
    }
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        db.collection("checkins").document(entry["day"]).set(entry)
    except:
        pass
    return {"status": "saved", **entry}


@router.get("/checkin/history")
def checkin_history():
    """Get all check-in history from Firestore."""
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        docs = db.collection("checkins").order_by("day").stream()
        return {"checkins": [doc.to_dict() for doc in docs]}
    except:
        return {"checkins": []}


@router.post("/verify")
async def verify_action(payload: dict):
    """Action verification: did the user follow through? Yes/No/Partially."""
    entry = {
        "intervention_id": payload.get("intervention_id", ""),
        "followed_through": payload.get("followed_through", "unknown"),  # yes/no/partially
        "timestamp": datetime.now(BOSTON_TZ).isoformat(),
    }
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        db.collection("verifications").add(entry)
    except:
        pass
    return {"status": "recorded", **entry}


@router.get("/insights")
def longitudinal_insights():
    """6-month longitudinal analysis: trends, best/worst weeks, patterns."""
    from backend.drift.routes import _build_daily_data
    from .effectiveness import build_longitudinal_insights
    daily = _build_daily_data()
    return build_longitudinal_insights(daily)


@router.get("/specialists")
def list_specialists():
    """All 4 specialist agents with current state (no Gemini call)."""
    from .specialists import evaluate_all, _mystery_line_for
    agents = [{**a, "mystery": _mystery_line_for(a)} for a in evaluate_all()]
    return {"agents": agents, "user": "Omar"}


@router.get("/specialists/{name}")
def get_specialist(name: str):
    """Single specialist agent state (no Gemini call yet)."""
    from .specialists import evaluate_agent, _mystery_line_for
    ev = evaluate_agent(name)
    if "error" in ev:
        return ev
    return {**ev, "mystery": _mystery_line_for(ev), "user": "Omar"}


def _persona_and_goal_ctx():
    from .goals import goal_progress
    p = goal_progress()
    persona_ctx = {"label": p["persona"]["label"], "frame": p["persona"]["frame"], "voice_rule": p["persona"]["voice_rule"]}
    goal = p["goal"]
    adherence_count = sum(1 for d in p["days"] if d["status"] == "yes")
    goal_ctx = {
        "behavior": goal["behavior"],
        "duration_days": goal["duration_days"],
        "target_metric_label": goal.get("target_metric_label", goal.get("target_metric", "")),
        "day_index": p["day_index"],
        "adherence_count": adherence_count,
    }
    return persona_ctx, goal_ctx


@router.post("/specialists/{name}/reveal")
async def reveal_specialist(name: str, payload: dict):
    """After mood check, generate full Gemini-composed micro-copy card."""
    from .specialists import compose_reveal
    mood = int((payload or {}).get("mood_score", 5))
    persona_ctx, goal_ctx = _persona_and_goal_ctx()
    return await compose_reveal(name, mood, persona_ctx=persona_ctx, goal_ctx=goal_ctx)


@router.post("/specialists/{name}/approve")
async def approve_specialist(name: str, payload: dict):
    """Fire the single Telegram notification for this agent's proposed action."""
    from .specialists import compose_reveal
    from .notify import send_telegram
    mood = int((payload or {}).get("mood_score", 5))
    persona_ctx, goal_ctx = _persona_and_goal_ctx()
    composed = await compose_reveal(name, mood, persona_ctx=persona_ctx, goal_ctx=goal_ctx)
    if not composed.get("actionable"):
        return {"sent": False, "reason": "agent state is not actionable", **composed}
    msg = (
        f"*YU · {composed['title']} agent*\n\n"
        f"{composed['data_line']}\n\n"
        f"{composed['narrative']}\n\n"
        f"_{composed['implication']}_"
    )
    result = await send_telegram(msg)
    return {**composed, "notification": result}


@router.get("/goal")
def get_goal():
    from .goals import goal_progress
    return goal_progress()


@router.post("/goal")
def set_goal(payload: dict):
    from .goals import update_goal, goal_progress
    update_goal(payload or {})
    return goal_progress()


@router.post("/goal/adherence")
def log_adherence_route(payload: dict):
    from .goals import log_adherence, goal_progress
    from datetime import datetime
    day = (payload or {}).get("day") or datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")
    value = (payload or {}).get("value", "yes")
    log_adherence(day, value)
    return goal_progress()


@router.post("/predictions")
def post_prediction(payload: dict):
    """Record a zone prediction the user just made."""
    from .predictions import record_prediction
    target_metric = (payload or {}).get("target_metric") or "hrv"
    predicted_zone = (payload or {}).get("predicted_zone", "same")
    baseline = float((payload or {}).get("baseline", 0))
    agent_id = (payload or {}).get("agent_id", "")
    rationale = (payload or {}).get("rationale", "")
    mood = (payload or {}).get("mood_score")
    return record_prediction(target_metric, predicted_zone, baseline, agent_id, rationale=rationale, mood_score=mood)


@router.get("/predictions/accuracy")
def get_accuracy():
    """Forecast Accuracy: rolling 7d/30d/lifetime + last verification."""
    from .predictions import accuracy_summary
    return accuracy_summary()


@router.post("/predictions/seed")
def seed_predictions(payload: dict):
    """DEV/DEMO: backdate a few zone predictions so the loop has data."""
    from .predictions import _load, _save, _today_value, value_to_zone, ZONE_LABELS
    from datetime import datetime, timedelta
    import random
    metric = (payload or {}).get("metric") or "sleep"
    count = int((payload or {}).get("count", 5))
    today = datetime.now(BOSTON_TZ)
    actual_today = _today_value(metric) or 75
    rows = _load()
    for i in range(count):
        made = (today - timedelta(days=i + 1)).strftime("%Y-%m-%d")
        verified = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        actual = round(actual_today + random.uniform(-6, 6), 1)
        baseline = round(actual_today + random.uniform(-2, 2), 1)
        actual_zone = value_to_zone(actual, baseline, metric)
        # 60% hits, 30% adjacent, 10% way off
        roll = random.random()
        if roll < 0.6:
            predicted_zone = actual_zone
        elif roll < 0.9:
            idx = ZONE_LABELS.index(actual_zone)
            predicted_zone = ZONE_LABELS[max(0, min(4, idx + random.choice([-1, 1])))]
        else:
            predicted_zone = random.choice(ZONE_LABELS)
        try:
            zd = abs(ZONE_LABELS.index(predicted_zone) - ZONE_LABELS.index(actual_zone))
        except ValueError:
            zd = 0
        rows.append({
            "made_on": made,
            "agent_id": metric,
            "target_metric": metric,
            "predicted_zone": predicted_zone,
            "baseline_at_prediction": baseline,
            "verified_on": verified,
            "actual": actual,
            "actual_zone": actual_zone,
            "is_hit": predicted_zone == actual_zone,
            "zone_distance": zd,
        })
    _save(rows)
    return {"seeded": count, "metric": metric}


@router.delete("/predictions")
def clear_predictions():
    """DEV/DEMO: wipe the prediction store."""
    from .predictions import _save
    _save([])
    return {"cleared": True}


@router.get("/predictions/today")
def todays_pred():
    """Returns today's verification if any prior prediction matured into today."""
    from .predictions import todays_verification, verify_pending
    verify_pending()
    return {"verification": todays_verification()}


@router.get("/hypothesis/library")
def hypothesis_library():
    from .goals import load_library
    return {"library": load_library()}


@router.get("/council")
def council_today():
    from .council import pick_spokesperson
    return pick_spokesperson()


@router.get("/ritual")
def ritual_today():
    """Single endpoint that returns everything the redesigned /agent screen needs."""
    from .council import pick_spokesperson
    from .goals import goal_progress
    from .specialists import _mystery_line_for
    from .predictions import baseline_trend
    from .goals import load_goal
    council = pick_spokesperson()
    spk = council["spokesperson"]
    spk_with_mystery = {**spk, "mystery": _mystery_line_for(spk)}
    g = load_goal()
    return {
        "user": "Omar",
        "goal": goal_progress(),
        "spokesperson": spk_with_mystery,
        "listening": council["listening"],
        "baseline_trend": baseline_trend(g.get("target_metric", "sleep"), 30),
    }


@router.get("/gameplan")
async def gameplan():
    """Today's personalized game plan: 3 cards (cognitive, physical, sleep)."""
    from .gameplan import generate_gameplan
    return await generate_gameplan()


@router.post("/share")
def share_summary(payload: dict):
    """Generate a shareable summary for MD / coach / therapist / self."""
    from .gameplan import generate_share_summary
    audience = (payload or {}).get("audience", "self")
    return generate_share_summary(audience)


@router.get("/driver-pairing")
def driver_pairing():
    """Which interventions work for which drift drivers."""
    from .state import AgentState
    from .effectiveness import build_driver_pairing
    state = AgentState.load()
    return build_driver_pairing(state.intervention_log, state.drift_history)


@router.get("/habituation")
def habituation_check():
    """Check for interventions showing diminishing returns."""
    from .state import AgentState
    from .effectiveness import check_habituation
    state = AgentState.load()
    return {"alerts": check_habituation(state.intervention_log)}


