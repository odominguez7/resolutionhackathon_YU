"""
Post-generation validator (v2.1 week 2-3).

After Gemini returns a workout JSON, this module checks every movement
against the catalog, validates the schema, and checks loads/patterns.
If validation fails, returns structured errors for a bounded retry.
If the retry also fails, returns a deterministic rule-based fallback.
"""

from __future__ import annotations

import re
from .workout_brain import load_catalog, tag_patterns, PATTERN_KEYWORDS

# Banned words — hard enforcement in code, not just the prompt
BANNED_WORDS = ["carry", "farmer", "suitcase"]


def _catalog_movements() -> set[str]:
    """Extract all bullet-pointed movement names from the catalog."""
    catalog = load_catalog()
    if not catalog:
        return set()
    out = set()
    for line in catalog.splitlines():
        line = line.strip()
        if line.startswith("- "):
            name = line[2:].strip()
            # Strip trailing references like [web:16]
            name = re.sub(r"\[.*?\]", "", name).strip()
            # Strip parenthetical descriptions
            clean = re.split(r"\s*\(", name)[0].strip().lower()
            if clean:
                out.add(clean)
    return out


def _normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def validate_workout(
    workout: dict,
    required_patterns: list[str] | None = None,
    equipment: dict | None = None,
    competency: dict | None = None,
    weekly_volume: dict | None = None,
    overtraining_risk: str = "none",
) -> dict:
    """Validate a generated workout. Returns:
    {
        "valid": bool,
        "errors": [str, ...],        # human-readable for reprompt
        "cleaned": dict | None        # the workout with bad movements stripped (if fixable)
    }
    """
    errors: list[str] = []
    catalog = _catalog_movements()
    has_catalog = len(catalog) > 5  # only enforce if catalog loaded

    all_movements: list[dict] = []
    for block_key in ("workout", "strength", "metcon"):
        block = workout.get(block_key)
        if not block:
            continue
        movs = block.get("movements") or []
        for m in movs:
            all_movements.append((block_key, m))

    # 1. Banned word check (code-level, not prompt-level)
    for block_key, m in all_movements:
        name = ""
        if isinstance(m, dict):
            name = (m.get("movement_name") or m.get("name") or "").lower()
        elif isinstance(m, str):
            name = m.lower()
        for banned in BANNED_WORDS:
            if banned in name:
                errors.append(f"BANNED movement in {block_key}: '{name}' contains '{banned}'")

    # 2. Schema check — movements should be objects, not strings
    for block_key, m in all_movements:
        if isinstance(m, str):
            errors.append(f"Movement in {block_key} is a string, not an object: '{m[:60]}'. Must be {{reps, movement_name, load}}.")

    # 3. Catalog check — every movement_name should fuzzy-match something in the catalog
    if has_catalog:
        for block_key, m in all_movements:
            if not isinstance(m, dict):
                continue
            name = _normalize(m.get("movement_name") or m.get("name") or "")
            if not name:
                errors.append(f"Empty movement_name in {block_key}")
                continue
            # Fuzzy matching: multiple strategies, lenient
            matched = False
            for cat in catalog:
                # Direct substring
                if cat in name or name in cat:
                    matched = True
                    break
                # Word-level overlap (e.g. "db front squat" ∩ "front squat")
                name_words = set(name.split())
                cat_words = set(cat.split())
                overlap = len(name_words & cat_words)
                if overlap >= min(2, len(cat_words)):
                    matched = True
                    break
                # Single-word match for short names (e.g. "burpee" ∩ "burpees")
                if len(name_words) == 1 or len(cat_words) == 1:
                    # Stem comparison — strip trailing 's'
                    n_stem = name.rstrip("s")
                    c_stem = cat.rstrip("s")
                    if n_stem in c_stem or c_stem in n_stem:
                        matched = True
                        break
            # Also allow common movement keywords that are clearly gym movements
            # even if exact catalog entry doesn't match the exact phrasing
            GYM_KEYWORDS = {"run", "treadmill", "sprint", "burpee", "squat", "press",
                            "pull-up", "pullup", "deadlift", "push-up", "pushup", "row",
                            "plank", "lunge", "clean", "snatch", "jerk"}
            if not matched:
                for kw in GYM_KEYWORDS:
                    if kw in name:
                        matched = True
                        break
            if not matched:
                errors.append(f"Movement '{name}' in {block_key} not found in catalog")

    # 4. Pattern check — if required_patterns specified, verify they're hit
    if required_patterns:
        flat_movs = []
        for _, m in all_movements:
            if isinstance(m, dict):
                flat_movs.append(m.get("movement_name") or m.get("name") or "")
            elif isinstance(m, str):
                flat_movs.append(m)
        actual_patterns = set(tag_patterns(flat_movs))
        for rp in required_patterns:
            if rp not in actual_patterns:
                errors.append(f"Required pattern '{rp}' not covered by any movement")

    # 5. Load sanity — weights shouldn't exceed 100lb per dumbbell
    for _, m in all_movements:
        if not isinstance(m, dict):
            continue
        load = (m.get("load") or "").lower()
        nums = re.findall(r"(\d+)\s*lb", load)
        for n in nums:
            if int(n) > 100:
                errors.append(f"Load {n}lb exceeds max (100lb per DB): {m.get('movement_name')}")

    # 6. Volume cap — weekly reps per pattern must not exceed safe limits
    if weekly_volume:
        # Count new reps by pattern
        new_reps_by_pattern: dict[str, int] = {}
        for _, m in all_movements:
            if not isinstance(m, dict):
                continue
            name = m.get("movement_name") or m.get("name") or ""
            reps_str = str(m.get("reps") or "0")
            # Extract numeric portion (e.g. "15" from "15", "400m" stays 0 for volume)
            reps_num = 0
            import re as _re
            r_match = _re.match(r"(\d+)", reps_str)
            if r_match and not any(c in reps_str for c in ["m", "sec", "min"]):
                reps_num = int(r_match.group(1))
            patterns = tag_patterns([name])
            for p in patterns:
                new_reps_by_pattern[p] = new_reps_by_pattern.get(p, 0) + reps_num

        WEEKLY_REP_CAPS = {
            "squat": 300, "hinge": 250, "push_h": 300, "push_v": 200,
            "pull_v": 200, "pull_h": 250, "olympic": 150, "core": 400,
        }
        for p, new_reps in new_reps_by_pattern.items():
            cap = WEEKLY_REP_CAPS.get(p)
            if cap is None:
                continue
            existing = weekly_volume.get(p, 0)
            if existing + new_reps > cap:
                errors.append(
                    f"Volume cap exceeded for '{p}': week has {existing} reps + {new_reps} new = {existing + new_reps} (cap: {cap})"
                )

    # 7. Competency check — movement must be in user's approved set
    if competency:
        blocked = competency.get("blocked", [])
        for block_key, m in all_movements:
            if not isinstance(m, dict):
                continue
            name = _normalize(m.get("movement_name") or m.get("name") or "")
            for b in blocked:
                if b.lower() in name or name in b.lower():
                    reason = competency.get("blocked_reasons", {}).get(b, "blocked by user/injury")
                    errors.append(f"Competency block in {block_key}: '{name}' is blocked ({reason})")

    # 8. Equipment check — every movement's required gear must be in the set
    if equipment:
        for block_key, m in all_movements:
            if not isinstance(m, dict):
                continue
            name = m.get("movement_name") or m.get("name") or ""
            if not name:
                continue
            from .athlete_context import check_equipment
            err = check_equipment(name, equipment)
            if err:
                errors.append(f"Equipment violation in {block_key}: {err}")

    # 9. Overtraining veto — if risk is elevated/veto, only easy/recovery allowed
    if overtraining_risk in ("elevated", "veto"):
        workout_intensity = (workout.get("intensity") or "").lower()
        if workout_intensity in ("push", "work"):
            errors.append(
                f"Overtraining risk is '{overtraining_risk}' but workout intensity is '{workout_intensity}'. "
                f"Must be 'easy' or 'recovery'."
            )

    # 10. Description leak check — no block should have a description field
    for block_key in ("workout", "strength", "metcon"):
        block = workout.get(block_key)
        if block and block.get("description"):
            errors.append(f"Block '{block_key}' contains a 'description' field — must be removed")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


def build_retry_prompt(errors: list[str]) -> str:
    """Build a reprompt string from validation errors."""
    lines = [
        "",
        "=" * 60,
        "VALIDATION FAILED — FIX THESE ERRORS AND REGENERATE",
        "=" * 60,
    ]
    for i, e in enumerate(errors, 1):
        lines.append(f"{i}. {e}")
    lines.append("")
    lines.append("Fix every error above. Return the corrected JSON only.")
    return "\n".join(lines)


def build_fallback_workout(biometrics: dict, session_type: str = "crossfit") -> dict:
    """Deterministic rule-based fallback when Gemini fails twice.
    Uses no LLM — just a hardcoded safe workout from the catalog."""
    readiness = biometrics.get("readiness") or 70
    if readiness >= 75:
        intensity = "work"
    elif readiness >= 60:
        intensity = "easy"
    else:
        intensity = "recovery"

    if intensity == "recovery":
        return {
            "session_type": session_type,
            "title": "Active Recovery (auto-generated fallback)",
            "format": "Active Recovery",
            "duration_min": 30,
            "intensity": "recovery",
            "warmup": {"duration_min": 5, "movements": ["200m easy treadmill walk", "10 air squats", "10 glute bridges"]},
            "workout": {
                "block_type": "Main",
                "movements": [
                    {"reps": "10", "movement_name": "Air squat", "load": None},
                    {"reps": "10", "movement_name": "Push-up", "load": None},
                    {"reps": "5", "movement_name": "Strict pull-up", "load": "BW"},
                    {"reps": "200m", "movement_name": "Treadmill walk", "load": None},
                ],
                "rounds": 3,
                "time_cap": None,
                "notes": "Easy pace. Focus on movement quality."
            },
            "cooldown": {"duration_min": 5, "movements": ["Pigeon stretch 60s each", "Couch stretch 60s each"]},
            "why_this_workout": f"Readiness {readiness} — body needs recovery. Auto-generated fallback because AI generation failed.",
            "mental_challenge": "Discipline is doing less when your ego wants more.",
            "estimated_calories": 150,
            "fallback": True,
        }

    return {
        "session_type": session_type,
        "title": "Baseline WOD (auto-generated fallback)",
        "format": "For Time",
        "duration_min": 45,
        "intensity": intensity,
        "warmup": {"duration_min": 8, "movements": ["400m treadmill jog", "10 air squats", "10 push-ups", "5 strict pull-ups", "10 DB deadlifts (light)"]},
        "workout": {
            "block_type": "Main",
            "movements": [
                {"reps": "15", "movement_name": "DB goblet squat", "load": "40lb"},
                {"reps": "10", "movement_name": "Push-up", "load": None},
                {"reps": "10", "movement_name": "DB bent-over row", "load": "2x40lb"},
                {"reps": "10", "movement_name": "DB Romanian deadlift", "load": "2x40lb"},
                {"reps": "200m", "movement_name": "Treadmill run", "load": None},
            ],
            "rounds": 4,
            "time_cap": 20,
            "notes": "Steady pace. Scale load as needed."
        },
        "cooldown": {"duration_min": 5, "movements": ["Pigeon stretch 60s each", "Couch stretch 60s each", "Doorway chest stretch 60s"]},
        "why_this_workout": f"Readiness {readiness} — solid {intensity} day. Auto-generated fallback because AI generation failed.",
        "mental_challenge": "Round 3 is where it gets quiet. Stay in it.",
        "estimated_calories": 350,
        "fallback": True,
    }
