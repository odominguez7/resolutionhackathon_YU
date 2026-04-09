"""5-state classifier and per-agent metric definitions, shared across services."""

import statistics
from typing import Optional

BASELINE_WINDOW = 28
LOCKED_Z = 0.85
LOADED_Z = 0.4

AGENT_DEFS = {
    "heart":     {"id": "heart",     "title": "Heart",     "subtitle": "Your Heart agent",     "color": "#E5484D", "metric_key": "hrv",            "metric_label": "HRV",         "lower_is_worse": True,  "unit": "ms"},
    "readiness": {"id": "readiness", "title": "Readiness", "subtitle": "Your Readiness scout", "color": "#00BFA6", "metric_key": "readinessScore", "metric_label": "Readiness",   "lower_is_worse": True,  "unit": ""},
    "sleep":     {"id": "sleep",     "title": "Sleep",     "subtitle": "Your Sleep architect", "color": "#6366F1", "metric_key": "sleepScore",     "metric_label": "Sleep score", "lower_is_worse": True,  "unit": ""},
    "stress":    {"id": "stress",    "title": "Stress",    "subtitle": "Your Stress sentinel", "color": "#F59E0B", "metric_key": "stressMin",      "metric_label": "Stress",      "lower_is_worse": False, "unit": "min"},
}

STATE_GLYPH = {"locked": "◆", "loaded": "▲", "steady": "●", "compressed": "▼", "depleted": "◉", "insufficient": "·"}
STATE_LABEL = {"locked": "Locked", "loaded": "Loaded", "steady": "Steady", "compressed": "Compressed", "depleted": "Depleted", "insufficient": "Gathering"}
STATE_COPY = {
    "locked":     "Your body absorbed the load",
    "loaded":     "You are absorbing load sustainably",
    "steady":     "Holds the line. Good for execution, not big bets",
    "compressed": "Load is accumulating faster than you are recovering",
    "depleted":   "Cognitive load capacity is reduced. Defer the low-stakes calls",
    "insufficient": "Your baseline is still forming",
}


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


def classify(z: Optional[float], lower_is_worse: bool) -> str:
    if z is None:
        return "insufficient"
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


def evaluate(agent_id: str, daily: list[dict]) -> dict:
    """Pure z-score evaluation, returns the same shape the YU app uses."""
    agent = AGENT_DEFS.get(agent_id)
    if not agent:
        return {"error": f"unknown agent: {agent_id}"}
    if len(daily) < 6:
        return {**agent, "state": "insufficient", "reason": "not enough days"}
    key = agent["metric_key"]
    series = [d.get(key) for d in daily if d.get(key) is not None]
    if not series:
        return {**agent, "state": "insufficient", "reason": f"no {key} data"}
    today_value = series[-1]
    baseline = series[-(BASELINE_WINDOW + 1):-1]
    z = _zscore(today_value, baseline)
    state = classify(z, agent["lower_is_worse"])
    baseline_mean = round(statistics.mean(baseline), 1) if baseline else None
    delta_pct = None
    if baseline_mean:
        delta_pct = round(((today_value - baseline_mean) / baseline_mean) * 100, 1)
    history = [round(v, 1) for v in series[-30:]]
    return {
        **agent,
        "state": state,
        "state_label": STATE_LABEL.get(state, state),
        "state_glyph": STATE_GLYPH.get(state, "·"),
        "state_copy": STATE_COPY.get(state, ""),
        "today_value": round(float(today_value), 1),
        "baseline_mean": baseline_mean,
        "z_score": round(z, 2) if z is not None else None,
        "delta_pct": delta_pct,
        "history": history,
    }
