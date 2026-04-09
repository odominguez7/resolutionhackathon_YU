"""
YU Hypothesis Suggester — Gemini-generated if-then hypotheses based on the
user's current 5-state snapshot, baseline trend, persona, and prior tests.
"""

import json
import os
import re

import httpx

from .specialists import evaluate_all
from .goals import load_goal, load_library, PERSONAS
from .predictions import baseline_trend


def _load_gemini_key() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    return os.getenv("GEMINI_API_KEY", "")


_VALID_METRICS = ["hrv", "readiness", "sleep", "deep_sleep", "rhr"]
_METRIC_LABEL = {
    "hrv": "morning HRV",
    "readiness": "readiness",
    "sleep": "sleep score",
    "deep_sleep": "deep sleep",
    "rhr": "resting heart rate",
}


def _fallback() -> list[dict]:
    return [
        {
            "behavior": "Email cutoff at 9pm",
            "target_metric": "hrv",
            "target_metric_label": "morning HRV",
            "duration_days": 7,
            "why": "Late-evening cognitive load suppresses HRV. A clean cutoff is the cleanest test of that.",
        },
        {
            "behavior": "Walk 10 minutes after lunch",
            "target_metric": "readiness",
            "target_metric_label": "readiness",
            "duration_days": 7,
            "why": "Post-meal movement reduces afternoon cortisol load and rebuilds readiness.",
        },
        {
            "behavior": "Lights out by 11pm",
            "target_metric": "sleep",
            "target_metric_label": "sleep score",
            "duration_days": 7,
            "why": "Earlier sleep onset is the highest-leverage variable for sleep score.",
        },
    ]


async def suggest_hypotheses() -> dict:
    persona_id = load_goal().get("persona", "consultant")
    persona = PERSONAS.get(persona_id, PERSONAS["consultant"])
    evals = evaluate_all()
    state_lines = [
        f"- {e['title']} ({e.get('metric_label')}): {e.get('state_label', e['state'])} · today {e.get('today_value')} · baseline {e.get('baseline_mean')}"
        for e in evals if e.get("state") != "insufficient"
    ]
    trends = {}
    for m in ["hrv", "sleep", "readiness"]:
        t = baseline_trend(m, 30)
        if t.get("delta") is not None:
            trends[m] = f"{t.get('direction')} ({t.get('delta'):+})"

    lib = load_library()
    past_lines = [
        f"- {h.get('behavior')} → {h.get('target_metric_label')}: {h.get('verdict', {}).get('label', '?')}"
        for h in lib[:5]
    ]

    system = f"""You are YU, a behavioral hypothesis generator for a high-performing professional.
Persona lens: {persona['frame']}
Voice rule: {persona['voice_rule']}

Generate exactly THREE if-then behavioral hypotheses Omar could test for 7 days.
Each hypothesis must:
- Be a SPECIFIC daily behavior (with a time of day if possible). Not a generic intention.
- Target ONE of these metrics: hrv, readiness, sleep, deep_sleep, rhr
- Be grounded in his CURRENT state (the metrics that need attention most)
- Avoid wellness language. No "self-care", no "be kind to yourself", no superlatives.
- Avoid behaviors he has already tested in his history below.
- Be different from each other (don't propose 3 sleep behaviors).
- The "why" must reference his actual data in one sentence (which agent is in which state, or which trend).

Return ONLY JSON in this exact shape, nothing else:
{{
  "suggestions": [
    {{"behavior": "...", "target_metric": "hrv|readiness|sleep|deep_sleep|rhr", "duration_days": 7, "why": "..."}},
    {{"behavior": "...", "target_metric": "...", "duration_days": 7, "why": "..."}},
    {{"behavior": "...", "target_metric": "...", "duration_days": 7, "why": "..."}}
  ]
}}"""

    context = f"""CURRENT STATE (from his real Oura data):
{chr(10).join(state_lines)}

30-day baseline trend (positive = floor rising):
{json.dumps(trends)}

PAST TESTS (do not repeat):
{chr(10).join(past_lines) if past_lines else '- none yet'}
"""

    key = _load_gemini_key()
    if not key:
        return {"source": "fallback_no_key", "suggestions": _fallback()}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{context}"}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 700, "thinkingConfig": {"thinkingBudget": 0}},
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return {"source": "fallback_no_match", "suggestions": _fallback()}
        parsed = json.loads(match.group(0))
        raw = parsed.get("suggestions", [])
        cleaned = []
        for s in raw[:3]:
            metric = s.get("target_metric", "hrv")
            if metric not in _VALID_METRICS:
                metric = "hrv"
            cleaned.append({
                "behavior": (s.get("behavior") or "").replace("—", ",").strip(),
                "target_metric": metric,
                "target_metric_label": _METRIC_LABEL.get(metric, metric),
                "duration_days": int(s.get("duration_days", 7)),
                "why": (s.get("why") or "").replace("—", ",").strip(),
            })
        if len(cleaned) < 3:
            cleaned += _fallback()[len(cleaned):]
        return {"source": "gemini", "suggestions": cleaned[:3]}
    except Exception as e:
        return {"source": f"fallback_error:{type(e).__name__}", "suggestions": _fallback()}
