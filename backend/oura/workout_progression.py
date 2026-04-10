"""
Progression ledger (v2.1 week 7-9).

Per-movement load tracking across sessions. When the same movement is
prescribed at the same load 2 sessions in a row and both were completed,
the ledger bumps the prescribed load for next time.

Stored in Firestore collection `progression/{movement_name_normalized}`.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
COLLECTION = "progression"
BUMP_LB = 5  # weight bump per graduation
MIN_CLEAN_HITS = 2  # consecutive sessions at same load before bumping


def _normalize_name(name: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", name.lower().strip()).replace(" ", "_")[:60]


def _get_db():
    try:
        from google.cloud import firestore
        return firestore.Client(project="resolution-hack")
    except Exception:
        return None


def _parse_load_lbs(load_str: str | None) -> float | None:
    """Extract a numeric lb value from a load string like '2x50lb' or '40lb'."""
    if not load_str:
        return None
    m = re.search(r"(\d+)\s*lb", load_str.lower())
    if m:
        return float(m.group(1))
    return None


# ── Read ────────────────────────────────────────────────────────────────────

def get_progression(movement_name: str) -> dict | None:
    """Get the current progression record for a movement."""
    db = _get_db()
    if not db:
        return None
    doc_id = _normalize_name(movement_name)
    try:
        doc = db.collection(COLLECTION).document(doc_id).get()
        return doc.to_dict() if doc.exists else None
    except Exception:
        return None


def get_all_progressions() -> list[dict]:
    """Get all progression records."""
    db = _get_db()
    if not db:
        return []
    try:
        return [d.to_dict() for d in db.collection(COLLECTION).stream()]
    except Exception:
        return []


# ── Write ───────────────────────────────────────────────────────────────────

def record_movements(workout: dict, completed: str = "yes") -> list[dict]:
    """After a workout, record each movement's load into the ledger.
    Called when the workout is logged or when user submits feedback.
    completed: 'yes' / 'partial' / 'no'."""
    db = _get_db()
    if not db:
        return []

    updated = []
    today = datetime.now(BOSTON_TZ).strftime("%Y-%m-%d")

    for block_key in ("workout", "strength", "metcon"):
        block = workout.get(block_key)
        if not block:
            continue
        for m in (block.get("movements") or []):
            if not isinstance(m, dict):
                continue
            name = m.get("movement_name") or m.get("name") or ""
            load_str = m.get("load") or ""
            load_lbs = _parse_load_lbs(load_str)
            if not name:
                continue

            doc_id = _normalize_name(name)
            try:
                ref = db.collection(COLLECTION).document(doc_id)
                existing = ref.get()
                rec = existing.to_dict() if existing.exists else {
                    "movement_name": name,
                    "history": [],
                    "current_load_lbs": load_lbs,
                    "consecutive_clean": 0,
                    "next_prescribed_lbs": load_lbs,
                }

                entry = {
                    "date": today,
                    "load_str": load_str,
                    "load_lbs": load_lbs,
                    "completed": completed,
                    "reps": m.get("reps"),
                }
                rec.setdefault("history", []).append(entry)
                if len(rec["history"]) > 50:
                    rec["history"] = rec["history"][-50:]

                # Progression logic
                if completed == "yes" and load_lbs is not None:
                    if rec.get("current_load_lbs") == load_lbs:
                        rec["consecutive_clean"] = rec.get("consecutive_clean", 0) + 1
                    else:
                        rec["current_load_lbs"] = load_lbs
                        rec["consecutive_clean"] = 1

                    if rec["consecutive_clean"] >= MIN_CLEAN_HITS:
                        rec["next_prescribed_lbs"] = load_lbs + BUMP_LB
                    else:
                        rec["next_prescribed_lbs"] = load_lbs
                elif completed in ("no", "partial") and load_lbs:
                    # Failed or partial — don't bump, keep current
                    rec["consecutive_clean"] = 0
                    rec["next_prescribed_lbs"] = load_lbs

                rec["updated_at"] = datetime.now(BOSTON_TZ).isoformat()
                ref.set(rec)
                updated.append(rec)
            except Exception:
                pass
    return updated


# ── Prompt injection ────────────────────────────────────────────────────────

def build_progression_block() -> str:
    """Build the PROGRESSION HISTORY block injected into the Gemini prompt.
    Shows last prescribed load and next prescribed load per movement."""
    records = get_all_progressions()
    if not records:
        return ""

    lines = [
        "",
        "=" * 60,
        "PROGRESSIVE OVERLOAD LEDGER",
        "=" * 60,
        "For each movement below, the 'next' load is what you MUST prescribe.",
        "If the athlete completed the movement cleanly at this load 2+ times,",
        "the ledger has already bumped it. Trust the ledger, not your guess.",
        "",
    ]
    for rec in sorted(records, key=lambda r: r.get("movement_name", "")):
        name = rec.get("movement_name", "?")
        current = rec.get("current_load_lbs")
        nxt = rec.get("next_prescribed_lbs")
        clean = rec.get("consecutive_clean", 0)
        if current is None:
            continue
        bump_note = f" (BUMP — {clean} clean hits)" if nxt and current and nxt > current else ""
        lines.append(f"  {name}: last={current}lb, prescribe={nxt}lb{bump_note}")
    return "\n".join(lines)
