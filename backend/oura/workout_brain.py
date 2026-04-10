"""
Workout brain — the deterministic logic that wraps the Gemini call.

Responsibilities (none of which the raw Gemini prompt does well):
1. Movement catalog — load CF Movements.md once and inject as the ONLY
   allowed movement source.
2. Workout log — record every generation + its biometric snapshot to
   yu_workout_log.json so future sessions have memory.
3. Pattern balancer — tag the last 3 sessions by movement pattern and
   instruct Gemini what to include / what to avoid today (no back-to-back
   same pattern, mandatory rotation).
4. Closed-loop learning — when generating, look back 24h at any prior
   workout and check whether the next-morning HRV/readiness recovered.
   Tag that workout's load as "ok / too much / undertrained" so the
   model learns Omar's personal tolerance instead of population rules.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

_HERE = os.path.dirname(__file__)
_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
LOG_PATH = os.path.join(_ROOT, "yu_workout_log.json")
CATALOG_PATH = os.path.join(_ROOT, "CF Movements.md")

# ── 1. Movement catalog ────────────────────────────────────────────────────

_catalog_cache: str | None = None


def load_catalog() -> str:
    """Read CF Movements.md once and cache. Strips html/img junk so we hand
    Gemini only the movement bullets."""
    global _catalog_cache
    if _catalog_cache is not None:
        return _catalog_cache
    if not os.path.exists(CATALOG_PATH):
        _catalog_cache = ""
        return _catalog_cache
    with open(CATALOG_PATH) as f:
        raw = f.read()
    # Strip leading html, the perplexity logo, and the prompt-quote header.
    # Keep everything from the first markdown ``` block onward.
    if "```markdown" in raw:
        raw = raw.split("```markdown", 1)[1]
    if raw.endswith("```"):
        raw = raw[:-3]
    _catalog_cache = raw.strip()
    return _catalog_cache


# ── 2. Workout log (Firestore primary, JSON fallback) ─────────────────────

FIRESTORE_COLLECTION = "workout_log"
_db = None

# In-memory cache with TTL to avoid N+1 Firestore reads
_log_cache: list[dict] | None = None
_log_cache_ts: float = 0
LOG_CACHE_TTL = 60  # seconds


def _get_db():
    global _db
    if _db is None:
        try:
            from google.cloud import firestore
            _db = firestore.Client(project="resolution-hack")
        except Exception as e:
            print(f"[workout_brain] Firestore unavailable: {e}")
    return _db


def _invalidate_log_cache():
    global _log_cache, _log_cache_ts
    _log_cache = None
    _log_cache_ts = 0


def _load_log() -> list[dict]:
    """Load from Firestore with 60s in-memory cache. Falls back to local JSON."""
    global _log_cache, _log_cache_ts
    import time
    now = time.time()
    if _log_cache is not None and (now - _log_cache_ts) < LOG_CACHE_TTL:
        return _log_cache

    db = _get_db()
    if db:
        try:
            docs = db.collection(FIRESTORE_COLLECTION).order_by("generated_at").stream()
            entries = [doc.to_dict() for doc in docs]
            if entries:
                _log_cache = entries[-200:]
                _log_cache_ts = now
                return _log_cache
        except Exception as e:
            print(f"[workout_brain] Firestore load failed: {e}")
    if not os.path.exists(LOG_PATH):
        return []
    try:
        with open(LOG_PATH) as f:
            return json.load(f).get("entries", [])
    except Exception:
        return []


def _save_log(entries: list[dict]) -> None:
    """Save full list to local JSON; the Firestore writes happen per-entry
    in _upsert_entry() so we keep the source of truth row-level."""
    _invalidate_log_cache()
    try:
        with open(LOG_PATH, "w") as f:
            json.dump({"entries": entries[-200:]}, f, indent=2, default=str)
    except Exception:
        pass


def _upsert_entry(entry: dict) -> None:
    """Write/update one entry to Firestore by id."""
    db = _get_db()
    if not db:
        return
    try:
        db.collection(FIRESTORE_COLLECTION).document(entry["id"]).set(entry)
    except Exception as e:
        print(f"[workout_brain] Firestore upsert failed: {e}")


def log_workout(workout: dict, biometrics: dict, session_type: str) -> dict:
    """Persist a generated workout. Returns the saved entry.
    `full_workout` carries the raw JSON so the UI can restore the card
    without re-calling Gemini after a refresh."""
    entry = {
        "id": f"w_{int(datetime.now(BOSTON_TZ).timestamp())}",
        "generated_at": datetime.now(BOSTON_TZ).isoformat(),
        "day": datetime.now(BOSTON_TZ).strftime("%Y-%m-%d"),
        "session_type": session_type,
        "title": workout.get("title", ""),
        "format": workout.get("format", ""),
        "intensity": workout.get("intensity", ""),
        "duration_min": workout.get("duration_min"),
        "movements": _flatten_movements(workout),
        "patterns": tag_patterns(_flatten_movements(workout)),
        "full_workout": workout,
        "biometrics_pre": {
            "readiness": biometrics.get("readiness"),
            "hrv": biometrics.get("hrv"),
            "hrv_baseline": biometrics.get("hrv_baseline"),
            "sleep_score": biometrics.get("sleep_score"),
        },
        # Filled in later by closed_loop_review()
        "biometrics_next_morning": None,
        "load_verdict": None,
        "user_feedback": None,
    }
    log = _load_log()
    log.append(entry)
    _save_log(log)
    _upsert_entry(entry)
    return entry


def recent_log(days: int = 7) -> list[dict]:
    cutoff = datetime.now(BOSTON_TZ) - timedelta(days=days)
    result = []
    for e in active_log():
        try:
            dt = datetime.fromisoformat(e.get("generated_at", ""))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=BOSTON_TZ)
            if dt >= cutoff:
                result.append(e)
        except (ValueError, KeyError):
            continue
    return result


def _flatten_movements(workout: dict) -> list[str]:
    """Extract movement names from all blocks. Handles both structured
    objects {reps, movement_name, load} and legacy strings."""
    out: list[str] = []
    for block_key in ("workout", "strength", "metcon"):
        block = workout.get(block_key) or {}
        for m in (block.get("movements") or []):
            if isinstance(m, dict):
                name = m.get("movement_name") or m.get("name") or ""
                if name:
                    out.append(name)
            elif isinstance(m, str):
                out.append(m)
    return out


# ── 3. Pattern balancer ────────────────────────────────────────────────────

PATTERN_KEYWORDS = {
    "squat": ["squat", "goblet", "front squat", "back squat", "wall sit", "pistol"],
    "hinge": ["deadlift", "rdl", "romanian", "hip thrust", "glute bridge", "good morning", "swing", "kb swing"],
    "lunge": ["lunge", "split squat", "step-up"],
    "push_h": ["push-up", "pushup", "floor press", "bench"],
    "push_v": ["press", "jerk", "push press", "strict press", "arnold", "z-press", "lateral raise"],
    "pull_v": ["pull-up", "pullup", "chin-up", "chinup", "muscle-up"],
    "pull_h": ["row", "renegade row", "seal row", "bent-over"],
    "olympic": ["clean", "snatch", "man maker", "devil press", "cluster"],
    "core": ["plank", "hollow", "v-up", "tuck-up", "sit-up", "dead bug", "russian twist", "side plank", "leg raise"],
    "cardio": ["run", "treadmill", "burpee", "row erg", "bike", "sprint"],
    "plyo": ["jump", "broad jump", "skater", "tuck jump"],
}


def tag_patterns(movements: list[str]) -> list[str]:
    found: set[str] = set()
    for raw in movements:
        m = raw.lower()
        for pattern, keys in PATTERN_KEYWORDS.items():
            if any(k in m for k in keys):
                found.add(pattern)
    return sorted(found)


PATTERN_PRIORITY = ["squat", "hinge", "push_h", "push_v", "pull_v", "pull_h", "core", "olympic"]


def balance_instructions(history: list[dict]) -> dict:
    """Given recent log, return what today MUST include and MUST avoid."""
    yesterday_patterns: set[str] = set()
    two_day_patterns: set[str] = set()
    week_pattern_counts: dict[str, int] = {}
    today = datetime.now(BOSTON_TZ).date()

    for entry in history:
        day = datetime.fromisoformat(entry["generated_at"]).date()
        delta = (today - day).days
        for p in entry.get("patterns", []):
            week_pattern_counts[p] = week_pattern_counts.get(p, 0) + 1
            if delta == 1:
                yesterday_patterns.add(p)
            if delta <= 2:
                two_day_patterns.add(p)

    avoid = sorted(yesterday_patterns)
    # MUST include: lowest-frequency pattern from this week that wasn't done in
    # the last 2 days. Falls back to the priority list.
    must_include: list[str] = []
    candidates = [p for p in PATTERN_PRIORITY if p not in two_day_patterns]
    if candidates:
        candidates.sort(key=lambda p: week_pattern_counts.get(p, 0))
        must_include = candidates[:2]
    return {
        "must_include": must_include,
        "avoid": avoid,
        "week_counts": week_pattern_counts,
    }


# ── 4. Closed-loop learning ────────────────────────────────────────────────

def closed_loop_review(current_biometrics: dict) -> list[dict]:
    """Look at any logged workout from yesterday and label whether today's
    biometrics suggest the load was tolerable. Returns the updated entries
    so we can show them in the prompt as personal-tolerance memory."""
    log = _load_log()
    today = datetime.now(BOSTON_TZ).date()
    today_hrv = current_biometrics.get("hrv")
    today_readiness = current_biometrics.get("readiness")
    today_hrv_bl = current_biometrics.get("hrv_baseline")

    updated = []
    changed = False
    for entry in log:
        if entry.get("rejected"):
            continue
        if entry.get("biometrics_next_morning") is not None:
            continue
        try:
            gen_dt = datetime.fromisoformat(entry["generated_at"])
            if gen_dt.tzinfo is None:
                gen_dt = gen_dt.replace(tzinfo=BOSTON_TZ)
            gen_day = gen_dt.date()
        except (ValueError, KeyError):
            continue
        if (today - gen_day).days != 1:
            continue
        # We have an unreviewed yesterday workout. Score it.
        entry["biometrics_next_morning"] = {
            "hrv": today_hrv,
            "readiness": today_readiness,
        }
        verdict = "ok"
        pre_hrv = (entry.get("biometrics_pre") or {}).get("hrv")
        if today_hrv and pre_hrv:
            drop = pre_hrv - today_hrv
            if drop >= 8 or (today_hrv_bl and today_hrv < today_hrv_bl - 5):
                verdict = "too_much"
            elif (today_readiness and today_readiness >= 85
                  and entry.get("intensity") in ("easy", "recovery")
                  and today_hrv_bl and today_hrv > today_hrv_bl):
                # Only "undertrained" if HRV rebounded ABOVE baseline after
                # an easy day. High readiness alone after a recovery day is
                # correct behavior, not a sign of undertraining.
                verdict = "undertrained"
        entry["load_verdict"] = verdict
        updated.append(entry)
        changed = True
    if changed:
        _save_log(log)
        for e in updated:
            _upsert_entry(e)
    return updated


# ── 6. Reject + regenerate (user wants a different combo) ─────────────────

def reject_entry(log_id: str, reason: str = "user_rejected") -> dict | None:
    """Mark an entry as rejected so it doesn't pollute future memory or
    closed-loop reviews. Returns the rejected entry's patterns so the
    regenerator can lock today to the same pattern shape."""
    log = _load_log()
    target = None
    for e in log:
        if e["id"] == log_id:
            e["rejected"] = True
            e["rejected_reason"] = reason
            e["rejected_at"] = datetime.now(BOSTON_TZ).isoformat()
            target = e
            break
    if target:
        _save_log(log)
        _upsert_entry(target)
    return target


def active_log() -> list[dict]:
    """Log filtered to non-rejected entries (used by memory + closed-loop)."""
    return [e for e in _load_log() if not e.get("rejected")]


# ── 5. Build the memory block injected into the Gemini prompt ──────────────

def build_memory_block(current_biometrics: dict) -> str:
    closed_loop_review(current_biometrics)
    history = recent_log(7)
    balance = balance_instructions(history)
    # Prefer Firestore catalog (single source of truth) over file
    try:
        from .catalog_svc import get_catalog_text
        catalog = get_catalog_text()
    except Exception:
        catalog = load_catalog()

    # Progression ledger (v2.1 week 7-9)
    try:
        from .workout_progression import build_progression_block
        progression_block = build_progression_block()
    except Exception:
        progression_block = ""

    # Adherence intelligence (v2.1 week 8-10)
    try:
        from .workout_adherence import build_adherence_block
        adherence_block = build_adherence_block(recent_log(14))
    except Exception:
        adherence_block = ""

    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("ALLOWED MOVEMENT CATALOG (use ONLY movements from this list)")
    lines.append("=" * 60)
    if catalog:
        lines.append(catalog)
    else:
        lines.append("(catalog file missing — fall back to general knowledge)")

    lines.append("")
    lines.append("=" * 60)
    lines.append("RECENT TRAINING HISTORY (last 7 days, most recent first)")
    lines.append("=" * 60)
    if not history:
        lines.append("No prior sessions logged.")
    else:
        for e in reversed(history[-7:]):
            verdict = e.get("load_verdict") or "pending"
            lines.append(
                f"- {e['day']}  {e.get('intensity','?'):8s}  "
                f"patterns: {','.join(e.get('patterns', [])) or 'none'}  "
                f"-> next-morning verdict: {verdict}"
            )

    lines.append("")
    lines.append("=" * 60)
    lines.append("PROGRAMMING CONSTRAINTS FOR TODAY")
    lines.append("=" * 60)
    if balance["must_include"]:
        lines.append(f"MUST include movement patterns: {', '.join(balance['must_include'])}")
    if balance["avoid"]:
        lines.append(f"AVOID (worked yesterday): {', '.join(balance['avoid'])}")
    if balance["week_counts"]:
        lines.append(f"Weekly pattern counts so far: {balance['week_counts']}")
    lines.append("Hard rule: Every movement you output MUST appear in the catalog above.")
    lines.append("Hard rule: If yesterday's verdict was 'too_much', drop intensity one tier.")
    lines.append("Hard rule: If yesterday's verdict was 'undertrained' two days in a row, push harder today.")

    # Append progression ledger
    if progression_block:
        lines.append(progression_block)

    # Append adherence intelligence
    if adherence_block:
        lines.append(adherence_block)

    return "\n".join(lines)
