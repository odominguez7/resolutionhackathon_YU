"""
Long-term agent memory: semantic + procedural (Q34 application).

Working memory  -> already in the LLM context window
Episodic memory -> already in agent_state.tick_log / drift_history
Semantic memory -> stable facts/preferences about the user (yu_semantic.json)
Procedural mem  -> reusable how-to skills/rituals (yu_rituals.json)

Both types are versioned and provenance-tagged so a poisoned write
(Q32 mitigation) can be traced and revoked.
"""

from __future__ import annotations

import json
import os
from typing import Any

from .security import provenance_tag

_HERE = os.path.dirname(__file__)
_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))

SEMANTIC_PATH = os.path.join(_ROOT, "yu_semantic.json")
RITUALS_PATH = os.path.join(_ROOT, "yu_rituals.json")


def _load(path: str, default: Any) -> Any:
    if not os.path.exists(path):
        return default
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def _save(path: str, data: Any) -> None:
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ── Semantic memory ────────────────────────────────────────────────────────

def load_semantic() -> dict:
    return _load(SEMANTIC_PATH, {"facts": {}})


def write_semantic(key: str, value: Any, source: str, trust: str = "user") -> dict:
    store = load_semantic()
    store.setdefault("facts", {})
    store["facts"][key] = {
        "value": value,
        "provenance": provenance_tag(source, trust),
    }
    _save(SEMANTIC_PATH, store)
    return store["facts"][key]


def forget_semantic(key: str) -> bool:
    store = load_semantic()
    if key in store.get("facts", {}):
        del store["facts"][key]
        _save(SEMANTIC_PATH, store)
        return True
    return False


# ── Procedural memory (rituals) ────────────────────────────────────────────

def load_rituals() -> list[dict]:
    data = _load(RITUALS_PATH, {"rituals": []})
    return data.get("rituals", [])


def write_ritual(name: str, trigger: str, steps: list[str], source: str) -> dict:
    rituals = load_rituals()
    # update if exists, else append
    for r in rituals:
        if r["name"] == name:
            r["trigger"] = trigger
            r["steps"] = steps
            r["provenance"] = provenance_tag(source, "user")
            _save(RITUALS_PATH, {"rituals": rituals})
            return r
    entry = {
        "name": name,
        "trigger": trigger,
        "steps": steps,
        "provenance": provenance_tag(source, "user"),
    }
    rituals.append(entry)
    _save(RITUALS_PATH, {"rituals": rituals})
    return entry


def find_ritual(name: str) -> dict | None:
    for r in load_rituals():
        if r["name"] == name:
            return r
    return None
