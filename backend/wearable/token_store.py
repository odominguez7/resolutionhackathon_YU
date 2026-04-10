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


def _get_encryption_key() -> bytes:
    """Get or derive an encryption key for token storage.
    Uses GEMINI_API_KEY as a seed (always available) to derive a 32-byte key.
    In production, this should use KMS."""
    import hashlib, os
    seed = os.getenv("GEMINI_API_KEY", "yu-default-key-seed")
    return hashlib.sha256(seed.encode()).digest()


def _encrypt(plaintext: str) -> str:
    """Simple Fernet-compatible encryption. Not military-grade, but prevents
    plaintext tokens in Firestore."""
    import base64, hashlib
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(_get_encryption_key())
    return Fernet(key).encrypt(plaintext.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    import base64
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(_get_encryption_key())
    return Fernet(key).decrypt(ciphertext.encode()).decode()


def store_tokens(user_id: str, provider: str, access_token: str,
                 refresh_token: str = "", expires_at: str = "") -> dict:
    """Store OAuth tokens encrypted for a user+provider pair."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}
    doc_id = f"{user_id}_{provider}"
    data = {
        "user_id": user_id,
        "provider": provider,
        "access_token_enc": _encrypt(access_token) if access_token else "",
        "refresh_token_enc": _encrypt(refresh_token) if refresh_token else "",
        "expires_at": expires_at,
        "encrypted": True,
        "updated_at": datetime.now(BOSTON_TZ).isoformat(),
    }
    try:
        db.collection(COLLECTION).document(doc_id).set(data)
        return {"stored": True}
    except Exception as e:
        return {"error": str(e)[:100]}


def get_tokens(user_id: str, provider: str) -> dict | None:
    """Get and decrypt stored tokens for a user+provider."""
    db = _get_db()
    if not db:
        return None
    try:
        doc = db.collection(COLLECTION).document(f"{user_id}_{provider}").get()
        if not doc.exists:
            return None
        data = doc.to_dict()
        # Decrypt if encrypted
        if data.get("encrypted"):
            try:
                data["access_token"] = _decrypt(data.get("access_token_enc", ""))
                data["refresh_token"] = _decrypt(data.get("refresh_token_enc", ""))
            except Exception:
                data["access_token"] = ""
                data["refresh_token"] = ""
        return data
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
