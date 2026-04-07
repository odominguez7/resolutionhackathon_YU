"""
RAG (Retrieval-Augmented Generation) for YU Cortex.

Embeds clinical research from the drift analysis document into Firestore,
then retrieves relevant passages during the DECIDE phase so the LLM planner
can cite specific science when reasoning about interventions.

Source: "Recovery Forecasting & Performance Optimization: A Wearable Data Decision Engine"
(Dominguez, April 2026) — 60 pages, 35 scientific sources.
"""

import os
import json
import httpx
import math
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
COLLECTION = "rag_knowledge"

_chunks_cache: list[dict] | None = None


def _get_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        key = line.split("=", 1)[1].strip()
    return key


async def embed_text(text: str) -> list[float] | None:
    """Embed text using Gemini embedding model."""
    key = _get_gemini_key()
    if not key:
        return None
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={key}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": text}]},
            })
            if resp.status_code == 200:
                return resp.json()["embedding"]["values"]
    except:
        pass
    return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _extract_chunks_from_research() -> list[dict]:
    """Extract knowledge chunks from the drift research document."""
    path = os.path.join(os.path.dirname(__file__), "..", "..", "Drift logic", "extract_result_2026-04-02.json")
    if not os.path.exists(path):
        return []

    with open(path) as f:
        d = json.load(f)
    r = d["result"]
    chunks = []

    # Overtraining stages
    for s in r.get("overtraining_continuum_stages", []):
        vals = {k: s[k].get("value", "") for k in s if isinstance(s[k], dict) and "value" in s[k]}
        chunks.append({
            "id": f"ot_{vals.get('stage', '').replace(' ', '_').lower()[:20]}",
            "category": "overtraining",
            "text": f"OVERTRAINING STAGE: {vals.get('stage', '')}\nDefinition: {vals.get('definition', '')}\nRecovery time: {vals.get('recovery_time', '')}\nPerformance impact: {vals.get('performance_impact', '')}\nANS signature: {vals.get('ans_signature', '')}",
        })

    # Metric analysis
    for m in r.get("metric_analysis", []):
        vals = {k: m[k].get("value", "") for k in m if isinstance(m[k], dict) and "value" in m[k]}
        name = vals.get("metric_name", "")
        chunks.append({
            "id": f"metric_{name.replace(' ', '_').lower()[:20]}",
            "category": "metrics",
            "text": f"METRIC: {name}\nWhat it measures: {vals.get('what_it_measures', '')}\nPhysiological basis: {vals.get('physiological_basis', '')}\nReliability: {vals.get('reliability', '')}\nSensitivity: {vals.get('sensitivity', '')}",
        })

    # Warning flags
    flags = []
    for f_item in r.get("warning_flag_definitions", []):
        vals = {k: f_item[k].get("value", "") for k in f_item if isinstance(f_item[k], dict) and "value" in f_item[k]}
        flags.append(f"{vals.get('flag_id', '')}: {vals.get('trigger_description', '')} (threshold: {vals.get('threshold', '')}, weight: {vals.get('weight', '')})")
    if flags:
        chunks.append({"id": "warning_flags", "category": "flags", "text": "WARNING FLAGS:\n" + "\n".join(flags)})

    # Zone classification
    zones = []
    for z in r.get("daily_recommendation_rubric", []):
        vals = {k: z[k].get("value", "") for k in z if isinstance(z[k], dict) and "value" in z[k]}
        zones.append(f"{vals.get('zone', '')}: RRS {vals.get('rrs_threshold', '')}, flags {vals.get('warning_flags_count', '')}, HRV-z {vals.get('hrv_z_score_range', '')}")
    if zones:
        chunks.append({"id": "zones", "category": "zones", "text": "ZONE CLASSIFICATION:\n" + "\n".join(zones)})

    # RRS model
    rrs = r.get("rrs_model", {})
    rrs_parts = []
    for k, v in rrs.items():
        if isinstance(v, dict) and "value" in v:
            rrs_parts.append(f"{k}: {v['value']}")
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    vals = {k2: item[k2].get("value", "") for k2 in item if isinstance(item[k2], dict) and "value" in item[k2]}
                    rrs_parts.append(str(vals))
    if rrs_parts:
        chunks.append({"id": "rrs_model", "category": "model", "text": "RRS MODEL:\n" + "\n".join(rrs_parts)})

    # Limitations
    lims = [l.get("limitation", {}).get("value", "") for l in r.get("system_limitations", []) if isinstance(l, dict)]
    if lims:
        chunks.append({"id": "limitations", "category": "limitations", "text": "SYSTEM LIMITATIONS:\n" + "\n".join(f"- {l}" for l in lims)})

    # Scientific sources
    sources = []
    for s in r.get("scientific_sources", []):
        cite = s.get("citation", {}).get("value", "")
        if cite:
            sources.append(cite)
    if sources:
        chunks.append({"id": "sources", "category": "sources", "text": "KEY SCIENTIFIC SOURCES:\n" + "\n".join(sources[:20])})

    return chunks


async def index_knowledge() -> dict:
    """Extract chunks, embed them, store in Firestore. Run once."""
    chunks = _extract_chunks_from_research()
    if not chunks:
        return {"status": "error", "message": "No research document found"}

    embedded = 0
    for chunk in chunks:
        embedding = await embed_text(chunk["text"])
        if embedding:
            chunk["embedding"] = embedding
            embedded += 1

    # Store in Firestore
    try:
        from google.cloud import firestore
        db = firestore.Client(project="resolution-hack")
        for chunk in chunks:
            doc_id = chunk["id"].replace("/", "_").replace(" ", "_")[:60] or f"chunk_{chunks.index(chunk)}"
            db.collection(COLLECTION).document(doc_id).set({
                "text": chunk["text"],
                "category": chunk["category"],
                "embedding": chunk.get("embedding", []),
                "indexed_at": datetime.now(BOSTON_TZ).isoformat(),
            })
        return {"status": "ok", "chunks": len(chunks), "embedded": embedded}
    except Exception as e:
        return {"status": "error", "message": str(e)[:100]}


async def retrieve(query: str, top_k: int = 3) -> list[dict]:
    """Retrieve most relevant knowledge chunks for a query."""
    global _chunks_cache

    # Load chunks from Firestore (cache after first load)
    if _chunks_cache is None:
        try:
            from google.cloud import firestore
            db = firestore.Client(project="resolution-hack")
            docs = db.collection(COLLECTION).stream()
            _chunks_cache = []
            for doc in docs:
                d = doc.to_dict()
                if d.get("embedding"):
                    _chunks_cache.append(d)
        except:
            _chunks_cache = []

    if not _chunks_cache:
        return []

    # Embed the query
    query_embedding = await embed_text(query)
    if not query_embedding:
        return []

    # Rank by cosine similarity
    scored = []
    for chunk in _chunks_cache:
        sim = cosine_similarity(query_embedding, chunk["embedding"])
        scored.append({"text": chunk["text"], "category": chunk["category"], "score": round(sim, 4)})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
