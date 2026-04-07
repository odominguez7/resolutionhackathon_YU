"""
YU Cortex Agent Graph — LangGraph orchestration of the 6-phase autonomous loop.

Each phase is a node in a directed graph. State flows between nodes.
Conditional edges skip phases when they're not needed.
"""

from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")


class AgentGraphState(TypedDict):
    """State that flows through the graph."""
    tick_start: str
    biometrics: dict
    drift_analysis: dict
    drift_detected: bool
    severity: str
    plan: dict
    executed_actions: list
    rag_count: int
    nanda_result: dict
    evaluations: list
    measure_result: dict
    phase: str
    error: str | None


# ── Node: SENSE ─────────────────────────────────────────────────────────

def sense_node(state: AgentGraphState) -> AgentGraphState:
    """Pull biometric data from Oura Ring."""
    from .tools import execute_get_biometrics
    biometrics = execute_get_biometrics({"days": 7})
    return {**state, "biometrics": biometrics, "phase": "sense"}


# ── Node: THINK ─────────────────────────────────────────────────────────

def think_node(state: AgentGraphState) -> AgentGraphState:
    """Run drift detection + prediction + trigger analysis."""
    from .tools import execute_detect_drift
    from .prediction import predict_drift, analyze_triggers
    from backend.drift.routes import _build_daily_data

    drift = execute_detect_drift({})
    daily = _build_daily_data()

    # Predict next 72h
    prediction = predict_drift(daily)

    # Analyze triggers if drifting
    triggers = analyze_triggers(daily) if drift.get("drift_detected") else {"triggers": []}

    drift["prediction"] = prediction
    drift["triggers"] = triggers

    return {
        **state,
        "drift_analysis": drift,
        "drift_detected": drift.get("drift_detected", False),
        "severity": drift.get("severity", "none"),
        "phase": "think",
    }


# ── Node: DECIDE ────────────────────────────────────────────────────────

async def decide_node(state: AgentGraphState) -> AgentGraphState:
    """LLM planner selects micro-interventions. RAG retrieves clinical research."""
    from .planner import plan_interventions
    from .state import AgentState

    agent_state = AgentState.load()
    history = agent_state.get_intervention_history_for_planner()

    plan = await plan_interventions(
        drift_analysis=state["drift_analysis"],
        biometrics=state["biometrics"],
        intervention_history=history,
    )

    return {
        **state,
        "plan": plan,
        "rag_count": plan.get("rag_chunks", 0),
        "phase": "decide",
    }


# ── Node: INTERVENE ─────────────────────────────────────────────────────

def intervene_node(state: AgentGraphState) -> AgentGraphState:
    """Execute micro-interventions via tools."""
    from .tools import run_tool
    from .state import AgentState

    agent_state = AgentState.load()
    executed = []
    pre_metrics = state["biometrics"].get("latest", {})

    for action in state["plan"].get("actions", []):
        tool_name = action.get("tool", "")
        params = action.get("params", {})
        result = run_tool(tool_name, params)

        executed.append({
            "tool": tool_name,
            "params": params,
            "why": action.get("why", ""),
            "result": result,
        })

        agent_state.log_intervention(
            {"id": f"tick_{tool_name}", "action_type": tool_name, "title": action.get("why", tool_name)},
            state["severity"],
        )

        if tool_name not in ("no_action", "get_biometrics", "detect_drift"):
            agent_state.add_pending_evaluation(
                intervention_id=f"tick_{tool_name}",
                pre_metrics=pre_metrics,
            )

    agent_state.save()
    return {**state, "executed_actions": executed, "phase": "intervene"}


# ── Node: NETWORK ───────────────────────────────────────────────────────

async def network_node(state: AgentGraphState) -> AgentGraphState:
    """Query NANDA peer agents, calculate consensus, upgrade plan."""
    from .nanda import query_network

    driver_names = [d["metric"] for d in state["drift_analysis"].get("drivers", [])]
    nanda = await query_network(
        drift_detected=state["drift_detected"],
        drivers=driver_names,
        original_plan=state["plan"],
    )

    return {**state, "nanda_result": nanda, "phase": "network"}


# ── Node: MEASURE ───────────────────────────────────────────────────────

def measure_node(state: AgentGraphState) -> AgentGraphState:
    """Evaluate whether past interventions improved biometrics (closed loop)."""
    from .state import AgentState
    from .evaluator import evaluate_intervention

    agent_state = AgentState.load()
    evaluations = []

    ready = agent_state.get_ready_evaluations()
    for ev in ready:
        post_metrics = state["biometrics"].get("latest", {})
        effectiveness = evaluate_intervention(ev["pre_metrics"], post_metrics)
        agent_state.close_evaluation(ev["intervention_id"], effectiveness)
        evaluations.append({"intervention_id": ev["intervention_id"], **effectiveness})

    agent_state.save()

    return {
        **state,
        "evaluations": evaluations,
        "measure_result": {
            "evaluations_completed": len(evaluations),
            "evaluations": evaluations,
            "pending_evaluations": len(agent_state.pending_evaluations),
            "effectiveness_summary": agent_state.effectiveness_summary,
        },
        "phase": "measure",
    }


# ── Conditional Edges ───────────────────────────────────────────────────

def should_run_network(state: AgentGraphState) -> str:
    """Skip network phase if no drift detected."""
    if state["drift_detected"]:
        return "network"
    return "measure"


# ── Build the Graph ─────────────────────────────────────────────────────

def build_agent_graph() -> StateGraph:
    """Construct the YU Cortex agent workflow graph."""

    graph = StateGraph(AgentGraphState)

    # Add nodes
    graph.add_node("sense", sense_node)
    graph.add_node("think", think_node)
    graph.add_node("decide", decide_node)
    graph.add_node("intervene", intervene_node)
    graph.add_node("network", network_node)
    graph.add_node("measure", measure_node)

    # Define edges
    graph.set_entry_point("sense")
    graph.add_edge("sense", "think")
    graph.add_edge("think", "decide")
    graph.add_edge("decide", "intervene")

    # Conditional: skip network if no drift
    graph.add_conditional_edges("intervene", should_run_network, {
        "network": "network",
        "measure": "measure",
    })

    graph.add_edge("network", "measure")
    graph.add_edge("measure", END)

    return graph.compile()


# ── Prebuilt graph instance ─────────────────────────────────────────────
agent_graph = build_agent_graph()
