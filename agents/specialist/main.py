"""
Generic specialist agent. The same image runs as Heart, Sleep, Readiness or
Stress depending on the AGENT_ID env var. This is a real agent: it has
tools (Oura fetch, classifier, Gemini), state (its own cache), and autonomy
(it decides whether the situation warrants an action and what to write).
"""

import asyncio
import os
import time
from datetime import datetime
from fastapi import FastAPI
import uvicorn

from agents.shared.oura import _build_daily_data
from agents.shared.classifier import evaluate, AGENT_DEFS, STATE_LABEL, STATE_GLYPH, STATE_COPY
from agents.shared.gemini import call_gemini, parse_json_block
from agents.shared import cache

AGENT_ID = os.environ.get("AGENT_ID", "heart")
PORT = int(os.environ.get("PORT", "8081"))
SLOW_INJECT_MS = int(os.environ.get("SLOW_INJECT_MS", "0"))  # Experiment C

app = FastAPI(title=f"yu-{AGENT_ID}-agent")


@app.get("/")
def root():
    return {"agent": AGENT_ID, "service": f"yu-{AGENT_ID}-agent", "ok": True}


@app.get("/healthz")
def healthz():
    return {"ok": True, "agent": AGENT_ID}


@app.get("/evaluate")
async def evaluate_route(use_gemini: int = 1, use_cache: int = 1):
    """Returns this agent's full read of the user's body for today.

    use_gemini=0  → fast deterministic copy (Experiment C variant)
    use_cache=0   → bypass cache (Experiment B variant)
    Slow injection via SLOW_INJECT_MS env (Experiment C variant)
    """
    t0 = time.time()
    cache_key = f"{AGENT_ID}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    cached = cache.get(cache_key) if use_cache else None
    if cached:
        return {**cached, "served_from": "cache", "elapsed_ms": int((time.time() - t0) * 1000)}

    daily = _build_daily_data()
    ev = evaluate(AGENT_ID, daily)
    if "error" in ev:
        return {**ev, "elapsed_ms": int((time.time() - t0) * 1000)}

    # Optional artificial slowdown for failure-recovery experiment
    if SLOW_INJECT_MS:
        await asyncio.sleep(SLOW_INJECT_MS / 1000)

    state = ev.get("state", "steady")
    composed = None
    tokens = 0
    source = "fallback"

    if use_gemini and state != "insufficient":
        prompt = f"""You are the {AGENT_DEFS[AGENT_ID]['title']} specialist agent inside YU.
You ONLY discuss the {AGENT_DEFS[AGENT_ID]['metric_label']} metric.
Frame everything through cognitive performance and decision capacity.
Never use wellness language. No clinical jargon. No superlatives.

Respond with JSON only:
{{"data_line":"...", "narrative":"...", "implication":"...", "action_label":"Remind me at <time>"}}

Field rules:
- data_line: one short sentence with the actual {AGENT_DEFS[AGENT_ID]['metric_label']} number ({AGENT_DEFS[AGENT_ID]['unit']}) and percent vs the user's 14-day baseline.
- narrative: one sentence about what the body is doing right now.
- implication: one short concrete sentence with a specific time of day.
- action_label: 3-6 word phrase starting with "Remind me at" + time.

CONTEXT:
- State: {STATE_LABEL[state]} ({STATE_GLYPH[state]})
- Today: {ev.get('today_value')}
- Baseline: {ev.get('baseline_mean')}
- Percent vs baseline: {ev.get('delta_pct')}%
"""
        gem = await call_gemini(prompt, temperature=0.5, max_tokens=350)
        tokens = gem.get("total_tokens", 0)
        if gem["ok"]:
            parsed = parse_json_block(gem["text"])
            if parsed:
                composed = {
                    "data_line": (parsed.get("data_line") or "").replace("—", ","),
                    "narrative": (parsed.get("narrative") or "").replace("—", ","),
                    "implication": (parsed.get("implication") or "").replace("—", ","),
                    "action_label": (parsed.get("action_label") or "Remind me at 9 p.m.").replace("—", ","),
                }
                source = "gemini"

    if composed is None:
        composed = {
            "data_line": f"{AGENT_DEFS[AGENT_ID]['metric_label']} {ev.get('today_value')}{AGENT_DEFS[AGENT_ID]['unit']}, {ev.get('delta_pct')}% versus your 14-day line.",
            "narrative": STATE_COPY.get(state, ""),
            "implication": "Move one hard task earlier today.",
            "action_label": "Remind me at 9 p.m.",
        }

    result = {
        **ev,
        **composed,
        "actionable": state in ("loaded", "compressed", "depleted"),
        "source": source,
        "tokens": tokens,
        "elapsed_ms": int((time.time() - t0) * 1000),
        "served_from": "live",
        "agent": AGENT_ID,
    }
    cache.set(cache_key, result)
    return result


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
