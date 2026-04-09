"""
Memory strategy switch — used by Experiment B.

Two backends: in-process dict (stateless across instances) and Firestore.
The agent picks the backend at startup via the YU_CACHE env var.

Each cached entry is keyed by agent_id + UTC date.
"""

import os
import time
from typing import Optional

CACHE_BACKEND = os.environ.get("YU_CACHE", "off")  # off | memory | firestore
TTL_SECONDS = int(os.environ.get("YU_CACHE_TTL", "3600"))

_mem: dict[str, tuple[float, dict]] = {}
_fs_client = None


def _firestore():
    global _fs_client
    if _fs_client is None:
        try:
            from google.cloud import firestore  # type: ignore
            _fs_client = firestore.Client()
        except Exception:
            _fs_client = False
    return _fs_client or None


def get(key: str) -> Optional[dict]:
    if CACHE_BACKEND == "off":
        return None
    if CACHE_BACKEND == "memory":
        item = _mem.get(key)
        if not item:
            return None
        ts, val = item
        if time.time() - ts > TTL_SECONDS:
            _mem.pop(key, None)
            return None
        return val
    if CACHE_BACKEND == "firestore":
        client = _firestore()
        if not client:
            return None
        try:
            doc = client.collection("yu_agent_cache").document(key).get()
            if not doc.exists:
                return None
            data = doc.to_dict() or {}
            if time.time() - data.get("ts", 0) > TTL_SECONDS:
                return None
            return data.get("value")
        except Exception:
            return None
    return None


def set(key: str, value: dict) -> None:
    if CACHE_BACKEND == "off":
        return
    if CACHE_BACKEND == "memory":
        _mem[key] = (time.time(), value)
        return
    if CACHE_BACKEND == "firestore":
        client = _firestore()
        if not client:
            return
        try:
            client.collection("yu_agent_cache").document(key).set({"ts": time.time(), "value": value})
        except Exception:
            pass


def clear():
    _mem.clear()
