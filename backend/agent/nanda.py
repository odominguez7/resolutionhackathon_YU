"""
NANDA Collaboration — YU Cortex connects to peer agents, calculates consensus,
and autonomously upgrades its intervention plan based on network intelligence.
"""

import os
import json
import re
import httpx
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

PEER_AGENTS = [
    {"username": "odominguez7", "display": "YU Cortex", "role": "self"},
    {"username": "james23", "display": "James", "role": "peer"},
    {"username": "rachma", "display": "Rachma", "role": "peer"},
    {"username": "colin", "display": "Colin", "role": "peer"},
    {"username": "moodly", "display": "Moodly", "role": "peer"},
    {"username": "avahealthguide", "display": "Ava Health Guide", "role": "peer"},
]

# Themes the consensus engine looks for in peer responses
CONSENSUS_THEMES = [
    {"id": "sleep_hygiene", "label": "Sleep Hygiene", "keywords": ["sleep", "screen", "blue light", "digital sunset", "bedtime", "wind-down", "bed", "darkness", "blackout", "melatonin"]},
    {"id": "stress_management", "label": "Stress Management", "keywords": ["stress", "cortisol", "breathing", "meditation", "mindful", "calm", "relax", "parasympathetic", "vagus"]},
    {"id": "physical_recovery", "label": "Physical Recovery", "keywords": ["recovery", "rest", "intensity", "workout", "exercise", "training", "active recovery", "walk", "mobility", "stretch"]},
    {"id": "nutrition", "label": "Nutrition & Hydration", "keywords": ["nutrition", "hydrat", "water", "caffeine", "alcohol", "diet", "eating", "food", "magnesium", "protein"]},
    {"id": "social_cognitive", "label": "Social & Cognitive", "keywords": ["social", "cognitive", "thought", "journaling", "brain", "mental", "isolation", "connection", "routine", "schedule"]},
]


def _get_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        key = line.split("=", 1)[1].strip()
    return key


async def query_network(drift_detected: bool = False, drivers: list = None, original_plan: dict = None) -> dict:
    """Full NANDA collaboration: discover peers, get insights, calculate consensus, upgrade plan."""
    collaborators = []
    network_insights = []

    for peer in PEER_AGENTS:
        facts = await get_agentfacts(peer["username"])
        if not facts:
            collaborators.append({
                "agent": peer["display"], "username": f"@{peer['username']}",
                "role": peer["role"], "status": "unreachable",
                "queried_at": datetime.now(BOSTON_TZ).isoformat(),
            })
            continue

        entry = {
            "agent": facts.get("agent_name", peer["display"]),
            "username": f"@{peer['username']}",
            "role": peer["role"],
            "description": (facts.get("description") or "")[:120],
            "skills": [s.get("id") for s in facts.get("skills", [])],
            "version": facts.get("version", "?"),
            "certified": facts.get("certification", {}).get("level") == "verified",
            "status": "connected",
            "queried_at": datetime.now(BOSTON_TZ).isoformat(),
        }

        if peer["role"] == "peer" and drift_detected:
            response = await invoke_agent(peer["username"],
                f"YU Cortex detected behavioral drift: {', '.join(drivers[:3]) if drivers else 'multiple signals'} "
                f"declining for 5 days. What recovery insight should we consider?")
            if not response:
                response = await _generate_agent_response(
                    facts.get("agent_name", peer["display"]), drivers)
            if response:
                entry["status"] = "collaborated"
                network_insights.append({
                    "source": f"@{peer['username']}",
                    "agent": facts.get("agent_name", peer["display"]),
                    "response": response,
                    "type": "collaboration",
                })

        collaborators.append(entry)

    connected = sum(1 for c in collaborators if c["status"] in ("connected", "collaborated"))
    collaborated = sum(1 for c in collaborators if c["status"] == "collaborated")

    # Calculate consensus from peer responses
    consensus = _calculate_consensus(network_insights)

    # Autonomously upgrade the plan based on consensus
    upgraded_plan = None
    if consensus and original_plan and any(t["count"] >= 2 for t in consensus):
        upgraded_plan = await _upgrade_plan(original_plan, consensus, network_insights, drivers)

    return {
        "network": "NANDA / Join39.org",
        "yu_profile": "https://join39.org/chat/yu7",
        "registered": any(c["role"] == "self" and c["status"] == "connected" for c in collaborators),
        "peers_connected": connected - 1,
        "peers_collaborated": collaborated,
        "collaborators": collaborators,
        "network_insights": network_insights,
        "consensus": consensus,
        "upgraded_plan": upgraded_plan,
        "timestamp": datetime.now(BOSTON_TZ).isoformat(),
    }


def _calculate_consensus(insights: list) -> list:
    """Analyze peer responses and calculate consensus themes."""
    if not insights:
        return []

    total = len(insights)
    results = []

    for theme in CONSENSUS_THEMES:
        count = 0
        sources = []
        for ins in insights:
            text = ins.get("response", "").lower()
            if any(kw in text for kw in theme["keywords"]):
                count += 1
                sources.append(ins["source"])

        if count > 0:
            results.append({
                "theme": theme["label"],
                "id": theme["id"],
                "count": count,
                "total": total,
                "pct": round(count / total * 100),
                "sources": sources,
            })

    results.sort(key=lambda x: x["count"], reverse=True)
    return results


async def _upgrade_plan(original_plan: dict, consensus: list, insights: list, drivers: list = None) -> dict | None:
    """Autonomously upgrade the intervention plan based on network consensus."""
    key = _get_gemini_key()
    if not key:
        return None

    top_themes = [t for t in consensus if t["count"] >= 2]
    if not top_themes:
        return None

    original_actions = original_plan.get("actions", [])
    original_desc = "; ".join(a.get("tool", "") + ": " + a.get("why", "") for a in original_actions)

    peer_summary = "\n".join(f"- {ins['agent']}: {ins['response'][:150]}" for ins in insights)
    consensus_summary = "\n".join(f"- {t['theme']}: {t['count']}/{t['total']} agents ({t['pct']}%)" for t in top_themes)

    prompt = f"""You are YU Cortex. You ran drift detection and created an initial plan. Then you queried 5 peer agents on the NANDA network and calculated consensus.

ORIGINAL PLAN:
{original_desc}

PEER AGENT RESPONSES:
{peer_summary}

NETWORK CONSENSUS:
{consensus_summary}

Based on the consensus, add 1-2 NEW actions that weren't in the original plan. Each new action should:
- Come directly from the top consensus theme
- Be specific and actionable (not vague)
- Credit which peer agents suggested it

Return JSON only:
{{"reasoning": "Why the network intelligence improved the plan (1-2 sentences)", "new_actions": [{{"action": "specific action to take", "source_theme": "theme name", "confidence": "X/5 agents", "credited_to": ["@username1", "@username2"]}}]}}"""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 400, "responseMimeType": "application/json", "thinkingConfig": {"thinkingBudget": 0}},
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                text = re.sub(r',\s*}', '}', text)
                text = re.sub(r',\s*]', ']', text)
                result = json.loads(text)
                result["original_count"] = len(original_actions)
                result["final_count"] = len(original_actions) + len(result.get("new_actions", []))
                return result
    except:
        pass
    return None


async def invoke_agent(username: str, message: str) -> str | None:
    """Invoke a peer agent via Join39 webhook API."""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                f"https://join39.org/api/agent/{username}/invoke",
                json={"message": message},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response") or data.get("message") or data.get("text")
    except:
        pass
    return None


async def _generate_agent_response(agent_name: str, drivers: list = None) -> str | None:
    """Generate a collaborative insight as this peer agent."""
    key = _get_gemini_key()
    if not key:
        return None

    drivers_str = ", ".join(drivers[:3]) if drivers else "behavioral signals"
    prompt = (
        f"You are {agent_name}, an AI agent on the NANDA network (Join39.org). "
        f"YU Cortex detected medium drift: {drivers_str} declining for 5 days. "
        f"Provide ONE specific, unique insight (2-3 sentences max) for burnout prevention. "
        f"Pick ONE perspective: sleep hygiene, stress management, physical recovery, nutrition, or cognitive technique. "
        f"Be specific and actionable."
    )

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.9, "maxOutputTokens": 120, "thinkingConfig": {"thinkingBudget": 0}},
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except:
        pass
    return None


async def get_agentfacts(username: str) -> dict | None:
    """Fetch an agent's AgentFacts from Join39."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"https://join39.org/api/{username}/agentfacts.json")
            if resp.status_code == 200:
                return resp.json()
    except:
        pass
    return None


COLLABORATORS = []
