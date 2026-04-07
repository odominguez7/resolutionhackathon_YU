"""
Agent Loop — the autonomous core of YU Cortex.

Orchestrated by LangGraph: a directed graph where each phase is a node,
state flows between nodes, and conditional edges skip phases when not needed.

Graph: Sense → Think → Decide → Intervene → [Network if drift] → Measure
"""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from .state import AgentState
from .tools import execute_get_biometrics, execute_detect_drift
from .planner import plan_interventions
from .evaluator import evaluate_intervention
from .nanda import query_network

BOSTON_TZ = ZoneInfo("America/New_York")

_latest_tick_result: dict | None = None


async def agent_tick() -> dict:
    """Execute one full agent loop cycle via LangGraph orchestration."""
    global _latest_tick_result

    tick_start = datetime.now(BOSTON_TZ)
    state = AgentState.load()

    # Try LangGraph orchestration
    try:
        from .graph import agent_graph

        initial_state = {
            "tick_start": tick_start.isoformat(),
            "biometrics": {},
            "drift_analysis": {},
            "drift_detected": False,
            "severity": "none",
            "plan": {},
            "executed_actions": [],
            "rag_count": 0,
            "nanda_result": {},
            "evaluations": [],
            "measure_result": {},
            "phase": "starting",
            "error": None,
        }

        # Run the graph
        final_state = await agent_graph.ainvoke(initial_state)

        # Build result from graph state
        biometrics = final_state["biometrics"]
        drift_analysis = final_state["drift_analysis"]
        latest = biometrics.get("latest", {})

        result = {
            "phase": "complete",
            "timestamp": tick_start.isoformat(),
            "orchestration": "langgraph",
            "phases": {
                "sense": {
                    "biometrics_available": biometrics.get("days_available", 0),
                    "date_range": biometrics.get("date_range", ""),
                    "latest_date": latest.get("day", ""),
                    "averages": biometrics.get("averages", {}),
                    "today": {
                        "hrv": latest.get("hrv"),
                        "sleep_score": latest.get("sleepScore"),
                        "readiness": latest.get("readinessScore"),
                        "rhr": latest.get("avgHeartRate"),
                    },
                },
                "think": {
                    "drift_detected": final_state["drift_detected"],
                    "severity": final_state["severity"],
                    "consecutive_days": drift_analysis.get("consecutive_days", 0),
                    "consecutive_impaired": drift_analysis.get("consecutive_impaired", 0),
                    "drivers": [
                        {"metric": d["metric"], "z_score": round(d["z_score"], 2)}
                        for d in drift_analysis.get("drivers", [])
                    ],
                    "baseline": drift_analysis.get("baseline", {}),
                    "rrs": drift_analysis.get("rrs", {}),
                    "warning_flags": drift_analysis.get("warning_flags", {}),
                    "overtraining_stage": drift_analysis.get("overtraining_stage", {}),
                    "prediction": drift_analysis.get("prediction", {}),
                    "triggers": drift_analysis.get("triggers", {}),
                    "summary": drift_analysis.get("summary", ""),
                },
                "decide": {
                    "reasoning": final_state["plan"].get("reasoning", ""),
                    "source": final_state["plan"].get("source", "unknown"),
                    "actions_planned": len(final_state["plan"].get("actions", [])),
                    "actions": final_state["plan"].get("actions", []),
                    "rag_used": final_state["plan"].get("rag_used", False),
                    "rag_chunks": final_state.get("rag_count", 0),
                },
                "act": {
                    "actions_executed": len(final_state["executed_actions"]),
                    "details": final_state["executed_actions"],
                },
                "collaborate": final_state.get("nanda_result", {}),
                "measure": final_state.get("measure_result", {
                    "evaluations_completed": 0,
                    "evaluations": [],
                    "pending_evaluations": 0,
                    "effectiveness_summary": {},
                }),
            },
        }

        # Update agent state
        state.log_drift(drift_analysis)
        state.update_baseline(drift_analysis.get("baseline", {}))

    except Exception as e:
        print(f"[YU Cortex] LangGraph failed ({e}), falling back to sequential")
        # Fallback to sequential execution
        result = await _sequential_tick(state, tick_start)

    # Finalize
    tick_end = datetime.now(BOSTON_TZ)
    result["duration_ms"] = int((tick_end - tick_start).total_seconds() * 1000)

    state.log_tick(result)
    state.save()

    _latest_tick_result = result
    return result


async def _sequential_tick(state: AgentState, tick_start: datetime) -> dict:
    """Fallback sequential execution if LangGraph is unavailable."""
    result = {"phase": "complete", "timestamp": tick_start.isoformat(), "orchestration": "sequential", "phases": {}}

    # SENSE
    biometrics = execute_get_biometrics({"days": 7})
    latest = biometrics.get("latest", {})
    result["phases"]["sense"] = {
        "biometrics_available": biometrics.get("days_available", 0),
        "date_range": biometrics.get("date_range", ""),
        "latest_date": latest.get("day", ""),
        "averages": biometrics.get("averages", {}),
        "today": {"hrv": latest.get("hrv"), "sleep_score": latest.get("sleepScore"), "readiness": latest.get("readinessScore"), "rhr": latest.get("avgHeartRate")},
    }

    # THINK
    drift_analysis = execute_detect_drift({})
    drift_detected = drift_analysis.get("drift_detected", False)
    severity = drift_analysis.get("severity", "none")

    # Prediction + triggers
    from .prediction import predict_drift, analyze_triggers
    from backend.drift.routes import _build_daily_data
    daily = _build_daily_data()
    drift_analysis["prediction"] = predict_drift(daily)
    drift_analysis["triggers"] = analyze_triggers(daily) if drift_detected else {"triggers": []}

    state.log_drift(drift_analysis)
    state.update_baseline(drift_analysis.get("baseline", {}))
    result["phases"]["think"] = {
        "drift_detected": drift_detected, "severity": severity,
        "consecutive_days": drift_analysis.get("consecutive_days", 0),
        "consecutive_impaired": drift_analysis.get("consecutive_impaired", 0),
        "drivers": [{"metric": d["metric"], "z_score": round(d["z_score"], 2)} for d in drift_analysis.get("drivers", [])],
        "baseline": drift_analysis.get("baseline", {}),
        "rrs": drift_analysis.get("rrs", {}),
        "warning_flags": drift_analysis.get("warning_flags", {}),
        "overtraining_stage": drift_analysis.get("overtraining_stage", {}),
        "prediction": drift_analysis.get("prediction", {}),
        "triggers": drift_analysis.get("triggers", {}),
        "summary": drift_analysis.get("summary", ""),
    }

    # DECIDE
    history = state.get_intervention_history_for_planner()
    plan = await plan_interventions(drift_analysis=drift_analysis, biometrics=biometrics, intervention_history=history)
    result["phases"]["decide"] = {
        "reasoning": plan.get("reasoning", ""), "source": plan.get("source", "unknown"),
        "actions_planned": len(plan.get("actions", [])), "actions": plan.get("actions", []),
        "rag_used": plan.get("rag_used", False), "rag_chunks": plan.get("rag_chunks", 0),
    }

    # INTERVENE
    from .tools import run_tool
    executed_actions = []
    pre_metrics = latest
    for action in plan.get("actions", []):
        tool_name = action.get("tool", "")
        result_tool = run_tool(tool_name, action.get("params", {}))
        executed_actions.append({"tool": tool_name, "params": action.get("params", {}), "why": action.get("why", ""), "result": result_tool})
        state.log_intervention({"id": f"tick{state.tick_count + 1}_{tool_name}", "action_type": tool_name, "title": action.get("why", tool_name)}, severity)
        if tool_name not in ("no_action", "get_biometrics", "detect_drift"):
            state.add_pending_evaluation(intervention_id=f"tick{state.tick_count + 1}_{tool_name}", pre_metrics=pre_metrics)
    result["phases"]["act"] = {"actions_executed": len(executed_actions), "details": executed_actions}

    # COLLABORATE
    try:
        driver_names = [d["metric"] for d in drift_analysis.get("drivers", [])]
        nanda_result = await query_network(drift_detected=drift_detected, drivers=driver_names, original_plan=plan)
        result["phases"]["collaborate"] = nanda_result
    except Exception as e:
        result["phases"]["collaborate"] = {"network": "NANDA / Join39.org", "error": str(e)[:100]}

    # MEASURE
    evaluations = []
    ready = state.get_ready_evaluations()
    for ev in ready:
        post_metrics = latest
        effectiveness = evaluate_intervention(ev["pre_metrics"], post_metrics)
        state.close_evaluation(ev["intervention_id"], effectiveness)
        evaluations.append({"intervention_id": ev["intervention_id"], **effectiveness})
    result["phases"]["measure"] = {
        "evaluations_completed": len(evaluations), "evaluations": evaluations,
        "pending_evaluations": len(state.pending_evaluations), "effectiveness_summary": state.effectiveness_summary,
    }

    return result


def get_latest_tick() -> dict | None:
    return _latest_tick_result


def get_agent_status() -> dict:
    state = AgentState.load()
    return {
        "agent": "YU Cortex",
        "version": "3.0.0",
        "status": "active",
        "orchestration": "langgraph",
        **state.to_status(),
        "latest_tick": _latest_tick_result,
    }


def get_agent_log() -> list[dict]:
    state = AgentState.load()
    return list(reversed(state.tick_log))


def get_agent_effectiveness() -> dict:
    state = AgentState.load()
    return {
        "summary": state.effectiveness_summary,
        "interventions": [
            {"id": e["id"], "action_type": e["action_type"], "title": e["title"],
             "outcome": e.get("outcome"), "score": e.get("effectiveness_score"),
             "drift_severity": e.get("drift_severity"), "timestamp": e.get("timestamp")}
            for e in state.intervention_log
        ],
    }
