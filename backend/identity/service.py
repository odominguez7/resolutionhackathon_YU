"""
Identity Service v0 (v2.1 Svc01).

Manages user profiles with per-user equipment, goals, competency, and
preferences in Firestore. This is the stepping stone to Firebase Auth —
for now, user_id is passed as a query param or header. The important
thing is that the pipeline is multi-user-ready: every function that
previously hardcoded "omar" now accepts user_id.
"""

from __future__ import annotations

import json
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
COLLECTION = "user_profiles"


def _get_db():
    try:
        from google.cloud import firestore
        return firestore.Client(project="resolution-hack")
    except Exception:
        return None


# ── Default profile ─────────────────────────────────────────────────────────

DEFAULT_PROFILE = {
    "user_id": "omar",
    "display_name": "Omar",
    "fitness_level": "advanced",
    "goals": ["strength", "conditioning", "hybrid"],
    "equipment": {
        "dumbbells": [35, 40, 45, 50],
        "treadmill": True,
        "pull_up_bar": True,
        "barbell": False,
        "bench": False,
        "box": False,
        "rings": False,
        "kettlebell": False,
        "rope": False,
        "rower": False,
        "bike_erg": False,
    },
    "tone_preference": "coach",
    "preferred_channel": "telegram",  # telegram | whatsapp
    "created_at": "2026-04-10T00:00:00-04:00",
}


# ── CRUD ────────────────────────────────────────────────────────────────────

def get_profile(user_id: str = "omar") -> dict:
    """Get a user profile. Creates default if not found."""
    db = _get_db()
    if db:
        try:
            doc = db.collection(COLLECTION).document(user_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception:
            pass
    # Return default for omar, empty for unknown users
    if user_id == "omar":
        return {**DEFAULT_PROFILE}
    return {"user_id": user_id, "error": "profile not found"}


def create_profile(user_id: str, data: dict) -> dict:
    """Create or update a user profile."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}
    profile = {
        "user_id": user_id,
        "display_name": data.get("display_name", user_id),
        "fitness_level": data.get("fitness_level", "intermediate"),
        "goals": data.get("goals", ["hybrid"]),
        "equipment": data.get("equipment", DEFAULT_PROFILE["equipment"]),
        "tone_preference": data.get("tone_preference", "coach"),
        "created_at": datetime.now(BOSTON_TZ).isoformat(),
    }
    try:
        db.collection(COLLECTION).document(user_id).set(profile)
        return profile
    except Exception as e:
        return {"error": str(e)[:100]}


def update_profile(user_id: str, updates: dict) -> dict:
    """Partial update of a user profile."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}
    try:
        ref = db.collection(COLLECTION).document(user_id)
        doc = ref.get()
        if not doc.exists:
            return {"error": "profile not found"}
        ref.update(updates)
        return ref.get().to_dict()
    except Exception as e:
        return {"error": str(e)[:100]}


def update_equipment(user_id: str, equipment: dict) -> dict:
    """Update a user's equipment set."""
    return update_profile(user_id, {"equipment": equipment})


def list_profiles() -> list[dict]:
    """List all user profiles."""
    db = _get_db()
    if not db:
        return []
    try:
        return [d.to_dict() for d in db.collection(COLLECTION).stream()]
    except Exception:
        return []
