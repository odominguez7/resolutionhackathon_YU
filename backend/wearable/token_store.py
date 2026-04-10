"""
Per-user wearable token storage in Firestore.

Each user's OAuth tokens (Oura, Apple HK, Whoop, etc.) are stored
encrypted in Firestore. The global env-var tokens remain as a fallback
for Omar's account.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
COLLECTION = "wearable_tokens"


def _get_db():
    try:
        from google.cloud import firestore
        return firestore.Client(project="resolution-hack")
    except Exception:
        return None


def store_tokens(user_id: str, provider: str, access_token: str,
                 refresh_token: str = "", expires_at: str = "") -> dict:
    """Store OAuth tokens for a user+provider pair."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}
    doc_id = f"{user_id}_{provider}"
    data = {
        "user_id": user_id,
        "provider": provider,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
        "updated_at": datetime.now(BOSTON_TZ).isoformat(),
    }
    try:
        db.collection(COLLECTION).document(doc_id).set(data)
        return {"stored": True}
    except Exception as e:
        return {"error": str(e)[:100]}


def get_tokens(user_id: str, provider: str) -> dict | None:
    """Get stored tokens for a user+provider."""
    db = _get_db()
    if not db:
        return None
    try:
        doc = db.collection(COLLECTION).document(f"{user_id}_{provider}").get()
        return doc.to_dict() if doc.exists else None
    except Exception:
        return None


def get_oura_token(user_id: str) -> str | None:
    """Get the Oura access token for a user. Falls back to env var for Omar."""
    tokens = get_tokens(user_id, "oura")
    if tokens and tokens.get("access_token"):
        return tokens["access_token"]
    # Fallback for Omar (env var)
    import os
    if user_id == "omar":
        return os.getenv("OURA_ACCESS_TOKEN", "")
    return None
