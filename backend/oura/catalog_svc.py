"""
Catalog Service v0 (v2.1 Svc07 — single source of truth).

Replaces the file-based CF Movements.md + prompt snippet pattern.
Movements are stored in Firestore collection `movement_catalog`, versioned
via a `catalog_version` doc. Every planner call pins to a specific version.

On init: if the Firestore catalog is empty, seeds from CF Movements.md.
After that, the file is no longer the source — Firestore is.
"""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")
CATALOG_COLLECTION = "movement_catalog"
VERSION_DOC = "catalog_version"
_HERE = os.path.dirname(__file__)
_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
CATALOG_FILE = os.path.join(_ROOT, "CF Movements.md")


def _get_db():
    try:
        from google.cloud import firestore
        return firestore.Client(project="resolution-hack")
    except Exception:
        return None


def _parse_md_catalog() -> list[dict]:
    """Parse CF Movements.md into structured movement entries."""
    if not os.path.exists(CATALOG_FILE):
        return []
    with open(CATALOG_FILE) as f:
        raw = f.read()
    # Strip header junk
    if "```markdown" in raw:
        raw = raw.split("```markdown", 1)[1]
    if raw.endswith("```"):
        raw = raw[:-3]

    movements = []
    current_section = ""
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("## "):
            current_section = line[3:].strip()
            # Extract section number if present
            m = re.match(r"(\d+)\.\s*(.*)", current_section)
            if m:
                current_section = m.group(2).strip()
        elif line.startswith("- "):
            name = line[2:].strip()
            # Strip references like [web:16]
            name = re.sub(r"\[.*?\]", "", name).strip()
            if not name:
                continue
            # Extract parenthetical notes
            notes = ""
            paren = re.search(r"\((.+)\)", name)
            if paren:
                notes = paren.group(1)
            clean_name = re.split(r"\s*\(", name)[0].strip()
            movements.append({
                "name": clean_name,
                "full_name": name,
                "section": current_section,
                "notes": notes,
            })
    return movements


def _compute_sha(movements: list[dict]) -> str:
    content = "|".join(sorted(m["name"].lower() for m in movements))
    return hashlib.sha256(content.encode()).hexdigest()[:12]


def seed_catalog() -> dict:
    """Parse CF Movements.md and write to Firestore. Returns stats."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}

    movements = _parse_md_catalog()
    if not movements:
        return {"error": "No movements parsed from CF Movements.md"}

    sha = _compute_sha(movements)
    batch = db.batch()
    for i, m in enumerate(movements):
        doc_id = re.sub(r"[^a-z0-9_]", "_", m["name"].lower())[:60] or f"m_{i}"
        ref = db.collection(CATALOG_COLLECTION).document(doc_id)
        batch.set(ref, {
            **m,
            "active": True,
            "catalog_sha": sha,
            "indexed_at": datetime.now(BOSTON_TZ).isoformat(),
        })
        if (i + 1) % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()

    # Write version doc
    db.collection(CATALOG_COLLECTION).document(VERSION_DOC).set({
        "sha": sha,
        "movement_count": len(movements),
        "seeded_from": "CF Movements.md",
        "seeded_at": datetime.now(BOSTON_TZ).isoformat(),
    })

    return {"sha": sha, "movements": len(movements)}


def get_catalog_sha() -> str | None:
    """Get the current catalog version SHA."""
    db = _get_db()
    if not db:
        return None
    try:
        doc = db.collection(CATALOG_COLLECTION).document(VERSION_DOC).get()
        return doc.to_dict().get("sha") if doc.exists else None
    except Exception:
        return None


def get_catalog_movements() -> list[dict]:
    """Get all active movements from Firestore."""
    db = _get_db()
    if not db:
        return []
    try:
        docs = db.collection(CATALOG_COLLECTION).where("active", "==", True).stream()
        return [d.to_dict() for d in docs if d.id != VERSION_DOC]
    except Exception:
        return []


def get_catalog_text() -> str:
    """Get the catalog as a text block for prompt injection.
    This is what replaces load_catalog() from workout_brain.py."""
    movements = get_catalog_movements()
    if not movements:
        # Fallback to file
        from .workout_brain import load_catalog
        return load_catalog()

    by_section: dict[str, list[str]] = {}
    for m in movements:
        section = m.get("section", "Other")
        by_section.setdefault(section, []).append(m.get("full_name") or m.get("name", ""))

    lines = []
    for section, names in sorted(by_section.items()):
        lines.append(f"\n## {section}")
        for n in sorted(names):
            lines.append(f"- {n}")
    return "\n".join(lines)


def deactivate_movement(name: str) -> bool:
    """Deactivate a movement (soft delete). Returns True if found."""
    db = _get_db()
    if not db:
        return False
    doc_id = re.sub(r"[^a-z0-9_]", "_", name.lower())[:60]
    try:
        ref = db.collection(CATALOG_COLLECTION).document(doc_id)
        if ref.get().exists:
            ref.update({"active": False, "deactivated_at": datetime.now(BOSTON_TZ).isoformat()})
            return True
    except Exception:
        pass
    return False


def add_movement(name: str, section: str, notes: str = "") -> dict:
    """Add a new movement to the catalog."""
    db = _get_db()
    if not db:
        return {"error": "Firestore unavailable"}
    doc_id = re.sub(r"[^a-z0-9_]", "_", name.lower())[:60]
    entry = {
        "name": name,
        "full_name": f"{name} ({notes})" if notes else name,
        "section": section,
        "notes": notes,
        "active": True,
        "catalog_sha": get_catalog_sha(),
        "indexed_at": datetime.now(BOSTON_TZ).isoformat(),
    }
    db.collection(CATALOG_COLLECTION).document(doc_id).set(entry)
    return entry
