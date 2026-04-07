"""
Agent State — persistent memory for YU Cortex via Google Firestore.

Stores baseline, drift history, intervention log, and pending evaluations
in Firestore so state survives container restarts and deployments.
"""

import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional

BOSTON_TZ = ZoneInfo("America/New_York")
DOC_ID = "yu_cortex_state"
COLLECTION = "agent_state"

_db = None


def _get_db():
    global _db
    if _db is None:
        try:
            from google.cloud import firestore
            _db = firestore.Client(project="resolution-hack")
        except Exception as e:
            print(f"[YU Cortex] Firestore unavailable: {e}")
    return _db


class AgentState:
    def __init__(self):
        self.baseline: dict = {}
        self.drift_history: list[dict] = []
        self.intervention_log: list[dict] = []
        self.pending_evaluations: list[dict] = []
        self.tick_log: list[dict] = []
        self.tick_count: int = 0
        self.last_tick: Optional[str] = None
        self.effectiveness_summary: dict = {}

    @classmethod
    def load(cls) -> "AgentState":
        state = cls()
        db = _get_db()
        if db:
            try:
                doc = db.collection(COLLECTION).document(DOC_ID).get()
                if doc.exists:
                    data = doc.to_dict()
                    state.baseline = data.get("baseline", {})
                    state.drift_history = data.get("drift_history", [])
                    state.intervention_log = data.get("intervention_log", [])
                    state.pending_evaluations = data.get("pending_evaluations", [])
                    state.tick_log = data.get("tick_log", [])
                    state.tick_count = data.get("tick_count", 0)
                    state.last_tick = data.get("last_tick")
                    state.effectiveness_summary = data.get("effectiveness_summary", {})
                    return state
            except Exception as e:
                print(f"[YU Cortex] Firestore load failed: {e}")

        # Fallback: try local JSON file
        path = os.path.join(os.path.dirname(__file__), "..", "..", "agent_state.json")
        path = os.path.abspath(path)
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = json.load(f)
                state.baseline = data.get("baseline", {})
                state.drift_history = data.get("drift_history", [])
                state.intervention_log = data.get("intervention_log", [])
                state.pending_evaluations = data.get("pending_evaluations", [])
                state.tick_log = data.get("tick_log", [])
                state.tick_count = data.get("tick_count", 0)
                state.last_tick = data.get("last_tick")
                state.effectiveness_summary = data.get("effectiveness_summary", {})
            except:
                pass
        return state

    def save(self):
        data = {
            "baseline": self.baseline,
            "drift_history": self.drift_history,
            "intervention_log": self.intervention_log,
            "pending_evaluations": self.pending_evaluations,
            "tick_log": self.tick_log,
            "tick_count": self.tick_count,
            "last_tick": self.last_tick,
            "effectiveness_summary": self.effectiveness_summary,
            "updated_at": datetime.now(BOSTON_TZ).isoformat(),
        }

        # Save to Firestore
        db = _get_db()
        if db:
            try:
                db.collection(COLLECTION).document(DOC_ID).set(data)
            except Exception as e:
                print(f"[YU Cortex] Firestore save failed: {e}")

        # Also save local fallback
        try:
            path = os.path.join(os.path.dirname(__file__), "..", "..", "agent_state.json")
            with open(os.path.abspath(path), "w") as f:
                json.dump(data, f, indent=2, default=str)
        except:
            pass

    def log_tick(self, tick_result: dict):
        self.tick_count += 1
        self.last_tick = datetime.now(BOSTON_TZ).isoformat()
        tick_result["tick_number"] = self.tick_count
        tick_result["timestamp"] = self.last_tick
        self.tick_log.append(tick_result)
        if len(self.tick_log) > 100:
            self.tick_log = self.tick_log[-100:]

    def log_drift(self, drift_analysis: dict):
        entry = {
            "timestamp": datetime.now(BOSTON_TZ).isoformat(),
            "detected": drift_analysis.get("drift_detected", False),
            "severity": drift_analysis.get("severity", "none"),
            "consecutive_days": drift_analysis.get("consecutive_days", 0),
            "drivers": [d["metric"] for d in drift_analysis.get("drivers", [])],
            "rrs": drift_analysis.get("rrs", {}).get("score"),
            "zone": drift_analysis.get("rrs", {}).get("zone"),
            "overtraining_stage": drift_analysis.get("overtraining_stage", {}).get("stage"),
        }
        self.drift_history.append(entry)
        if len(self.drift_history) > 500:
            self.drift_history = self.drift_history[-500:]

    def log_intervention(self, action: dict, drift_severity: str):
        entry = {
            "id": action.get("id", ""),
            "timestamp": datetime.now(BOSTON_TZ).isoformat(),
            "action_type": action.get("action_type", ""),
            "title": action.get("title", ""),
            "drift_severity": drift_severity,
            "status": "executed",
            "outcome": None,
            "effectiveness_score": None,
        }
        self.intervention_log.append(entry)
        if len(self.intervention_log) > 500:
            self.intervention_log = self.intervention_log[-500:]

    def add_pending_evaluation(self, intervention_id: str, pre_metrics: dict):
        self.pending_evaluations.append({
            "intervention_id": intervention_id,
            "created_at": datetime.now(BOSTON_TZ).isoformat(),
            "pre_metrics": pre_metrics,
            "evaluate_after": (datetime.now(BOSTON_TZ) + timedelta(hours=24)).isoformat(),
        })

    def get_ready_evaluations(self) -> list[dict]:
        now = datetime.now(BOSTON_TZ)
        ready = []
        remaining = []
        for ev in self.pending_evaluations:
            eval_time = datetime.fromisoformat(ev["evaluate_after"])
            if eval_time.tzinfo is None:
                eval_time = eval_time.replace(tzinfo=BOSTON_TZ)
            if now >= eval_time:
                ready.append(ev)
            else:
                remaining.append(ev)
        self.pending_evaluations = remaining
        return ready

    def close_evaluation(self, intervention_id: str, effectiveness: dict):
        for entry in self.intervention_log:
            if entry["id"] == intervention_id:
                entry["outcome"] = effectiveness.get("verdict", "unknown")
                entry["effectiveness_score"] = effectiveness.get("score", 0)
                break
        self._update_effectiveness_summary()

    def _update_effectiveness_summary(self):
        by_type: dict[str, list] = {}
        for entry in self.intervention_log:
            if entry.get("effectiveness_score") is not None:
                atype = entry.get("action_type", "unknown")
                by_type.setdefault(atype, []).append(entry["effectiveness_score"])

        self.effectiveness_summary = {}
        for atype, scores in by_type.items():
            positive = sum(1 for s in scores if s > 0)
            self.effectiveness_summary[atype] = {
                "total": len(scores),
                "positive": positive,
                "rate": round(positive / len(scores) * 100) if scores else 0,
                "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
            }

    def get_intervention_history_for_planner(self) -> list[dict]:
        recent = self.intervention_log[-20:]
        return [
            {
                "action_type": e.get("action_type"),
                "title": e.get("title"),
                "drift_severity": e.get("drift_severity"),
                "outcome": e.get("outcome", "pending"),
                "effectiveness_score": e.get("effectiveness_score"),
            }
            for e in recent
        ]

    def update_baseline(self, new_baseline: dict):
        self.baseline = new_baseline

    def to_status(self) -> dict:
        return {
            "tick_count": self.tick_count,
            "last_tick": self.last_tick,
            "baseline": self.baseline,
            "total_drifts_detected": sum(
                1 for d in self.drift_history if d.get("detected")
            ),
            "total_interventions": len(self.intervention_log),
            "pending_evaluations": len(self.pending_evaluations),
            "effectiveness_summary": self.effectiveness_summary,
            "last_drift": self.drift_history[-1] if self.drift_history else None,
        }
