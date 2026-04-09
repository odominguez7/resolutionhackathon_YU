"""
YU Specialist Agents — Heart, Readiness, Sleep, Stress.

Each agent:
1. Reads its own metric window from real Oura data
2. Classifies state via SPC z-score (clear / watch / act)
3. Generates Apple-grade micro-copy via Gemini in the
   {mystery, data_line, narrative, implication, action_label} format

Real data only. No placeholders. If a metric is missing, the agent reports
"insufficient signal" rather than fabricating.
"""

from __future__ import annotations

import json
import os
import re
import statistics
from typing import Optional

import httpx

BASELINE_WINDOW = 28
RECENT_WINDOW = 14

# 5-state engine — z-score bands based on the user's own baseline.
# We compute a "performance" score where positive = better than baseline.
#   locked      : perf >= +1.0
#   loaded      : +0.5 <= perf < +1.0
#   steady      : -0.5 <= perf <  +0.5
#   compressed  : -1.0 <= perf < -0.5
#   depleted    : perf < -1.0
LOCKED_Z = 0.85
LOADED_Z = 0.4

STATE_GLYPH = {"locked": "◆", "loaded": "▲", "steady": "●", "compressed": "▼", "depleted": "◉", "insufficient": "·"}
STATE_LABEL = {"locked": "Locked", "loaded": "Loaded", "steady": "Steady", "compressed": "Compressed", "depleted": "Depleted", "insufficient": "Gathering"}
# Per-state copy lifted verbatim from the YU state-system spec, with the depleted line
# rewritten in performance language per File 3 (no "not a failure not a weakness").
STATE_COPY = {
    "locked":     "Your body absorbed the load",
    "loaded":     "You are absorbing load sustainably",
    "steady":     "Holds the line. Good for execution, not big bets",
    "compressed": "Load is accumulating faster than you are recovering",
    "depleted":   "Cognitive load capacity is reduced. Defer the low-stakes calls",
    "insufficient": "Your baseline is still forming",
}

AGENTS = {
    "heart": {
        "id": "heart",
        "title": "Heart",
        "subtitle": "Your Heart agent",
        "color": "#E5484D",  # apple system red
        "metric_keys": ["hrv", "avgHeartRate"],
        "metric_label": "HRV",
        "lower_is_worse": True,  # HRV: lower z-score = worse
        "icon": "heart",
    },
    "readiness": {
        "id": "readiness",
        "title": "Readiness",
        "subtitle": "Your Readiness scout",
        "color": "#00BFA6",  # YU teal
        "metric_keys": ["readinessScore"],
        "metric_label": "Readiness",
        "lower_is_worse": True,
        "icon": "target",
    },
    "sleep": {
        "id": "sleep",
        "title": "Sleep",
        "subtitle": "Your Sleep architect",
        "color": "#6366F1",  # YU indigo
        "metric_keys": ["sleepScore", "deepSleepMin"],
        "metric_label": "Sleep score",
        "lower_is_worse": True,
        "icon": "moon",
    },
    "stress": {
        "id": "stress",
        "title": "Stress",
        "subtitle": "Your Stress sentinel",
        "color": "#F59E0B",  # YU amber
        "metric_keys": ["stressMin", "avgHeartRate"],
        "metric_label": "Stress load",
        "lower_is_worse": False,  # higher stress = worse
        "icon": "bolt",
    },
}


def _load_gemini_key() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    return os.getenv("GEMINI_API_KEY", "")


def _series(daily: list[dict], key: str) -> list[float]:
    return [d.get(key) for d in daily if d.get(key) is not None]


def _zscore(value: float, baseline: list[float]) -> Optional[float]:
    if not baseline or len(baseline) < 5:
        return None
    mean = statistics.mean(baseline)
    try:
        sd = statistics.stdev(baseline)
    except statistics.StatisticsError:
        return None
    if sd == 0:
        return 0.0
    return (value - mean) / sd


def _classify(z: Optional[float], lower_is_worse: bool) -> str:
    """Returns one of: locked / loaded / steady / compressed / depleted / insufficient."""
    if z is None:
        return "insufficient"
    # performance: positive = better than baseline (regardless of metric polarity)
    perf = z if lower_is_worse else -z
    if perf >= LOCKED_Z:
        return "locked"
    if perf >= LOADED_Z:
        return "loaded"
    if perf >= -LOADED_Z:
        return "steady"
    if perf >= -LOCKED_Z:
        return "compressed"
    return "depleted"


def evaluate_agent(name: str) -> dict:
    """Pure data evaluation. No Gemini, no copy. Real Oura only."""
    if name not in AGENTS:
        return {"error": f"unknown agent: {name}"}
    agent = AGENTS[name]
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data() or []
    if len(daily) < 6:
        return {**agent, "state": "insufficient", "reason": "not enough days of data"}

    primary_key = agent["metric_keys"][0]
    series = _series(daily, primary_key)
    if not series:
        return {**agent, "state": "insufficient", "reason": f"no {primary_key} data"}

    today_value = series[-1]
    baseline = series[-(BASELINE_WINDOW + 1):-1]  # exclude today
    z = _zscore(today_value, baseline)
    state = _classify(z, agent["lower_is_worse"])
    baseline_mean = round(statistics.mean(baseline), 1) if baseline else None
    delta_pct = None
    if baseline_mean and baseline_mean != 0:
        delta_pct = round(((today_value - baseline_mean) / baseline_mean) * 100, 1)

    history = [round(v, 1) for v in series[-30:]]
    return {
        **agent,
        "state": state,
        "state_label": STATE_LABEL.get(state, state),
        "state_glyph": STATE_GLYPH.get(state, "·"),
        "state_copy": STATE_COPY.get(state, ""),
        "today_value": round(today_value, 1),
        "baseline_mean": baseline_mean,
        "z_score": round(z, 2) if z is not None else None,
        "delta_pct": delta_pct,
        "window_days": min(BASELINE_WINDOW, len(baseline)),
        "history": history,
    }


def evaluate_all() -> list[dict]:
    return [evaluate_agent(n) for n in AGENTS.keys()]


async def evaluate_all_async() -> list[dict]:
    """Parallel specialist evaluation (Q37 orchestrator pattern).
    Each evaluate_agent reads files and runs stats — short, but parallelizing
    keeps the council loop snappy and lets the gameplan generator run all
    four at once instead of in sequence."""
    import asyncio
    return await asyncio.gather(*(asyncio.to_thread(evaluate_agent, n) for n in AGENTS.keys()))


async def compose_all_reveals(mood_score: int, persona_ctx=None, goal_ctx=None) -> list[dict]:
    """Run compose_reveal for every specialist in parallel (Q37).
    Cuts wall-clock from 4×Gemini-latency down to ~1×."""
    import asyncio
    return await asyncio.gather(*(
        compose_reveal(n, mood_score, persona_ctx=persona_ctx, goal_ctx=goal_ctx)
        for n in AGENTS.keys()
    ))


def _mystery_line_for(agent_eval: dict) -> str:
    """Verbatim state copy. Identity-aware, performance-framed."""
    state = agent_eval.get("state", "insufficient")
    return STATE_COPY.get(state, "Your agent is gathering signal")


async def compose_reveal(name: str, mood_score: int, persona_ctx: Optional[dict] = None, goal_ctx: Optional[dict] = None) -> dict:
    """After mood check, generate full Apple-grade micro-copy via Gemini.
    persona_ctx: {label, frame, voice_rule}
    goal_ctx: {behavior, duration_days, target_metric_label, day_index, adherence_count}
    """
    ev = evaluate_agent(name)
    if "error" in ev:
        return ev
    if ev.get("state") == "insufficient":
        return {
            **ev,
            "mystery": _mystery_line_for(ev),
            "data_line": "Not enough days of signal yet",
            "narrative": "Your baseline is still forming. Come back tomorrow.",
            "implication": "",
            "action_label": "",
            "actionable": False,
        }

    persona_voice = (persona_ctx or {}).get("voice_rule", "")
    persona_frame = (persona_ctx or {}).get("frame", "")
    goal_block = ""
    is_first_day = False
    if goal_ctx:
        day_idx = goal_ctx.get("day_index", 1)
        dur = goal_ctx.get("duration_days", 7)
        is_first_day = day_idx <= 1
        if is_first_day:
            phase_rule = (
                "PHASE: Day 1. This is the BASELINE-CAPTURE day. "
                "Tonight is the FIRST attempt at the new behavior. "
                "Today's number is the STARTING LINE, NOT a verdict. "
                "Do NOT say the data 'weakens' or 'supports' the hypothesis yet — there is no test data yet. "
                "Say something like: 'this is your starting line', or 'tonight is the first test'."
            )
        else:
            phase_rule = (
                f"PHASE: Day {day_idx} of {dur}. The hypothesis is mid-test. "
                "Today's number can begin to support or weaken the hypothesis. State which, plainly."
            )
        goal_block = (
            f"\nACTIVE GOAL (his own hypothesis):\n"
            f"- Behavior: {goal_ctx.get('behavior')}\n"
            f"- Duration: {dur} days\n"
            f"- Target metric: {goal_ctx.get('target_metric_label')}\n"
            f"- Day: {day_idx} of {dur}\n"
            f"- Adherence so far: {goal_ctx.get('adherence_count')} days followed through\n"
            f"{phase_rule}\n"
            "Your job: orient him for tonight's attempt and tell him exactly what to do."
        )

    metric_unit = {"hrv": "ms", "avgHeartRate": "bpm", "sleepScore": "/100", "readinessScore": "/100", "deepSleepMin": "minutes", "stressMin": "minutes"}.get(ev["metric_keys"][0], "")

    system = f"""You are the {ev['title']} specialist agent inside YU, writing one card of micro-copy for a high-performing professional named Omar.
You ONLY discuss the {ev['metric_label']} metric ({metric_unit}). You are NOT the Sleep agent, NOT the Readiness agent, NOT the Stress agent. Do not mention any other metric.
Frame everything through: {persona_frame or 'cognitive performance and decision capacity'}
{persona_voice}
Write in this exact JSON shape, nothing else:
{{"data_line":"...", "narrative":"...", "implication":"...", "action_label":"..."}}

Voice rules:
- Apple-grade restraint. Neutral. No exclamation marks. No emojis. No "great", "amazing", "wow".
- 6-8th grade reading level. Active voice. Each sentence under 16 words.
- No clinical jargon. No "drift", "intervention", "z-score", "wellness".
- Identity-reinforcing. He recovers like an athlete. Never say "you should".
- Reference his OWN baseline numbers, never population averages.

Field rules:
- data_line: one short factual sentence that explicitly names the metric "{ev['metric_label']}" and its unit "{metric_unit}", with the actual number and how it compares to his own 14-day average. Never call this metric anything else. Example for HRV: "HRV 38ms, 22 percent below your 14-day line." Example for readiness: "Readiness 71 out of 100, 8 percent below your 14-day line."
- narrative: one sentence that explicitly connects today's number to his ACTIVE GOAL. State whether the data SUPPORTS or WEAKENS the hypothesis so far. Reference his self-rated mood only if it disagrees with the data.
- implication: one short concrete sentence with a SPECIFIC TIME OF DAY ("at 9 p.m.", "before 11 a.m.", "after lunch") — what to do today to ADVANCE the active hypothesis. The action must directly serve the user's stated behavior ("{(goal_ctx or {}).get('behavior', '')}"). Always include a clock time. Stay in your lane: Heart owns HRV-friendly daytime behaviors (breath work, calendar load, meeting placement); Sleep owns sleep timing; Readiness owns training/intensity decisions; Stress owns stress recovery moves. Never poach another agent's territory.
- action_label: a 3-6 word phrase for the button that ALWAYS starts with "Remind me" and includes a time. Example: "Remind me at 9 p.m.", "Remind me at 8:30 p.m.", "Remind me before lunch". The button only sends a Telegram message — never imply it opens calendars, calls people, or takes other action."""

    context = f"""{goal_block}

AGENT: {ev['title']} ({ev['subtitle']})
STATE: {ev['state']}
TODAY VALUE: {ev['today_value']}
HIS OWN 14-DAY BASELINE MEAN: {ev['baseline_mean']}
PERCENT VS BASELINE: {ev['delta_pct']}%
Z-SCORE VS HIS BASELINE: {ev['z_score']}
HIS SELF-REPORTED MOOD (1-10, before seeing data): {mood_score}
"""

    key = _load_gemini_key()
    composed = None
    source = "fallback"
    if key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{context}"}]}],
            "generationConfig": {"temperature": 0.5, "maxOutputTokens": 400, "thinkingConfig": {"thinkingBudget": 0}},
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                from .security import assert_egress_allowed
                assert_egress_allowed(url)
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                parsed = json.loads(match.group(0))
                composed = {
                    "data_line": parsed.get("data_line", "").replace("—", ","),
                    "narrative": parsed.get("narrative", "").replace("—", ","),
                    "implication": parsed.get("implication", "").replace("—", ","),
                    "action_label": parsed.get("action_label", "").replace("—", ","),
                }
                source = "gemini"
        except Exception as e:
            source = f"fallback:{type(e).__name__}"

    if composed is None:
        composed = {
            "data_line": f"{ev['metric_label']} {ev['today_value']}{metric_unit}, {ev['delta_pct']}% versus your 14-day line.",
            "narrative": f"Your body is signaling a shift versus your own baseline.",
            "implication": "Move one hard task earlier today and protect tonight's wind-down.",
            "action_label": "Send me a Telegram reminder",
        }

    return {
        **ev,
        "mood_score": mood_score,
        "mystery": _mystery_line_for(ev),
        **composed,
        # Actionable if there's a goal active OR the agent's state warrants a nudge.
        "actionable": bool(goal_ctx) or ev["state"] in ("loaded", "compressed", "depleted"),
        "source": source,
    }
