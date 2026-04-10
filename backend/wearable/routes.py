"""
Wearable ingestion API — unified endpoint for all providers.

POST /api/wearable/ingest accepts data from any adapter (Oura, Apple HK,
Whoop, etc.) and normalizes it into BiometricSample objects. This is the
single entry point for wearable data from external sources (companion
apps, webhooks, integrations).
"""

from __future__ import annotations

from fastapi import APIRouter
from .schema import Provider
from .oura_adapter import OuraAdapter
from .apple_hk_adapter import AppleHealthKitAdapter

router = APIRouter()

ADAPTERS = {
    Provider.OURA: OuraAdapter(),
    Provider.APPLE_HK: AppleHealthKitAdapter(),
}


@router.post("/ingest")
def ingest_samples(payload: dict):
    """Ingest wearable data from any provider.
    {provider: "oura" | "apple_hk", user_id: "omar", data: {...}}"""
    provider_str = (payload or {}).get("provider", "")
    user_id = (payload or {}).get("user_id", "omar")
    data = (payload or {}).get("data", {})

    try:
        provider = Provider(provider_str)
    except ValueError:
        return {"error": f"Unknown provider: {provider_str}. Valid: {[p.value for p in Provider]}"}

    adapter = ADAPTERS.get(provider)
    if not adapter:
        return {"error": f"No adapter for provider: {provider_str}"}

    samples = adapter.normalize(data, user_id)

    # Store in Firestore for future use
    stored = 0
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        batch = db.batch()
        for s in samples:
            doc_id = f"{s.provider.value}_{s.sample_type.value}_{s.day}_{s.user_id}"
            ref = db.collection("biometric_samples").document(doc_id)
            batch.set(ref, s.to_dict())
            stored += 1
        batch.commit()
    except Exception as e:
        return {"ingested": len(samples), "stored": 0, "error": str(e)[:100]}

    return {"ingested": len(samples), "stored": stored, "provider": provider_str}


@router.get("/samples")
def list_samples(provider: str = "", sample_type: str = "", days: int = 7):
    """Query stored BiometricSamples. Filter by provider and/or sample_type."""
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    BOSTON_TZ = ZoneInfo("America/New_York")
    cutoff = (datetime.now(BOSTON_TZ) - timedelta(days=days)).strftime("%Y-%m-%d")

    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        query = db.collection("biometric_samples").where("day", ">=", cutoff)
        if provider:
            query = query.where("provider", "==", provider)
        if sample_type:
            query = query.where("sample_type", "==", sample_type)
        docs = query.stream()
        return {"samples": [d.to_dict() for d in docs]}
    except Exception as e:
        return {"samples": [], "error": str(e)[:100]}


@router.get("/providers")
def list_providers():
    """List available wearable providers and their adapter status."""
    return {
        "providers": [
            {"id": "oura", "name": "Oura Ring", "status": "active", "tier": "T0"},
            {"id": "apple_hk", "name": "Apple HealthKit", "status": "ready", "tier": "T0"},
            {"id": "whoop", "name": "Whoop", "status": "planned", "tier": "T0"},
            {"id": "garmin", "name": "Garmin Connect", "status": "planned", "tier": "T1"},
            {"id": "polar", "name": "Polar", "status": "planned", "tier": "T1"},
        ]
    }


@router.post("/sync/oura")
def sync_oura():
    """Sync current Oura in-memory data into normalized BiometricSamples."""
    adapter = ADAPTERS[Provider.OURA]
    samples = adapter.fetch()

    stored = 0
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        batch = db.batch()
        for s in samples:
            doc_id = f"{s.provider.value}_{s.sample_type.value}_{s.day}_{s.user_id}"
            ref = db.collection("biometric_samples").document(doc_id)
            batch.set(ref, s.to_dict())
            stored += 1
            if stored % 400 == 0:
                batch.commit()
                batch = db.batch()
        batch.commit()
    except Exception as e:
        return {"synced": len(samples), "stored": stored, "error": str(e)[:100]}

    return {"synced": len(samples), "stored": stored}
