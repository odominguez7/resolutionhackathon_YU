"""
Hypothesis suggester agent. Reads the council's snapshot of the user's
current state and proposes 3 if-then behavioral hypotheses to test for 7 days.
Pure LLM agent — its only tool is Gemini.
"""

import json
import os
import time
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

from agents.shared.gemini import call_gemini, parse_json_block

PORT = int(os.environ.get("PORT", "8085"))
app = FastAPI(title="yu-hypothesis-agent")


class Snapshot(BaseModel):
    persona: str | None = "consultant"
    states: list[dict] = []   # [{title, state_label, today_value, baseline_mean}, ...]
    history: list[dict] = []  # past tested hypotheses


def _fallback() -> list[dict]:
    return [
        {"behavior": "Email cutoff at 9 p.m.", "target_metric": "hrv", "duration_days": 7,
         "why": "Late-evening cognitive load suppresses HRV. A clean cutoff is the cleanest test."},
        {"behavior": "Walk 10 minutes after lunch", "target_metric": "readiness", "duration_days": 7,
         "why": "Post-meal movement reduces afternoon cortisol load."},
        {"behavior": "Lights out by 11 p.m.", "target_metric": "sleep", "duration_days": 7,
         "why": "Earlier sleep onset is the highest-leverage variable for sleep score."},
    ]


@app.get("/healthz")
def healthz():
    return {"ok": True, "agent": "hypothesis"}


@app.post("/suggest")
async def suggest(payload: Snapshot):
    t0 = time.time()
    state_lines = "\n".join(
        f"- {s.get('title')}: {s.get('state_label')} (today {s.get('today_value')}, baseline {s.get('baseline_mean')})"
        for s in payload.states
    )
    history_lines = "\n".join(
        f"- {h.get('behavior')} → {h.get('verdict', {}).get('label', '?')}"
        for h in payload.history[:5]
    )

    prompt = f"""You are YU, generating exactly THREE if-then behavioral hypotheses for a {payload.persona}.

Each hypothesis must:
- Be a SPECIFIC daily behavior with a time of day
- Target ONE of: hrv, readiness, sleep, deep_sleep, rhr
- Be grounded in the user's CURRENT state below
- Avoid wellness language
- Avoid behaviors already tested below
- Be different from each other

Return ONLY JSON:
{{"suggestions":[
  {{"behavior":"...", "target_metric":"...", "duration_days":7, "why":"..."}},
  {{"behavior":"...", "target_metric":"...", "duration_days":7, "why":"..."}},
  {{"behavior":"...", "target_metric":"...", "duration_days":7, "why":"..."}}
]}}

CURRENT STATE:
{state_lines or '- (no state)'}

PAST TESTS:
{history_lines or '- none yet'}
"""
    gem = await call_gemini(prompt, temperature=0.8, max_tokens=600)
    tokens = gem.get("total_tokens", 0)
    suggestions = _fallback()
    source = "fallback"
    if gem["ok"]:
        parsed = parse_json_block(gem["text"])
        raw = (parsed or {}).get("suggestions", [])
        if raw:
            suggestions = [{
                "behavior": s.get("behavior", "").replace("—", ","),
                "target_metric": s.get("target_metric", "hrv"),
                "duration_days": int(s.get("duration_days", 7)),
                "why": s.get("why", "").replace("—", ","),
            } for s in raw[:3]]
            source = "gemini"

    return {
        "suggestions": suggestions,
        "source": source,
        "tokens": tokens,
        "elapsed_ms": int((time.time() - t0) * 1000),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
