"""
Rule-based skeleton builder (v2.1 planner-svc phase 6, layer 1).

Before Gemini sees anything, this module deterministically decides:
- Block structure (warmup / strength / metcon / cool, or warmup / AMRAP / cool)
- Target patterns (from balancer)
- Duration (from adherence profile — shorter if streak-rebuild)
- Loads per movement (from progression ledger)
- Intensity tier (from readiness)

The skeleton is passed to Gemini with a hard rule: "Fill in the creative
layer only — title, specific movement selection within the pattern,
pacing notes, mental challenge, warmup creativity. Do NOT change the
structure, target patterns, prescribed loads, or duration."

This is the single biggest architectural shift in v2.1: the LLM stops
being the system and becomes one collaborator inside it.
"""

from __future__ import annotations

import random

# Block structure templates keyed by intensity tier
BLOCK_TEMPLATES = {
    "push": [
        {"structure": "strength_metcon", "strength_sets": 5, "metcon_rounds": 3, "total_min": 60},
        {"structure": "amrap", "duration_min": 25, "total_min": 55},
        {"structure": "for_time", "rounds": 5, "time_cap": 25, "total_min": 55},
    ],
    "work": [
        {"structure": "strength_metcon", "strength_sets": 4, "metcon_rounds": 3, "total_min": 55},
        {"structure": "emom", "duration_min": 20, "total_min": 50},
        {"structure": "for_time", "rounds": 4, "time_cap": 20, "total_min": 50},
    ],
    "easy": [
        {"structure": "emom", "duration_min": 16, "total_min": 40},
        {"structure": "intervals", "work_sec": 40, "rest_sec": 20, "rounds": 12, "total_min": 40},
    ],
    "recovery": [
        {"structure": "active_recovery", "total_min": 30},
    ],
}

# Pattern families — maps each pattern to movement-keyword hints
# Gemini will pick specific movements from the catalog within each pattern
PATTERN_FAMILIES = {
    "squat": "any squat variation from the catalog",
    "hinge": "any deadlift / RDL / hip thrust / glute bridge variation",
    "push_h": "any push-up / floor press variation",
    "push_v": "any overhead press / push press / jerk variation",
    "pull_v": "any pull-up / chin-up variation from the bar",
    "pull_h": "any row variation (bent-over, renegade, seal)",
    "olympic": "any clean / snatch / man maker / devil press / cluster",
    "core": "any plank / hollow / v-up / sit-up / dead bug / russian twist",
    "cardio": "treadmill run or burpee variation",
    "plyo": "any jump variation (tuck, broad, skater)",
}


def build_skeleton(ctx: dict) -> dict:
    """Given an AthleteContext, produce a deterministic skeleton.
    Returns a dict the prompt builder injects as constraints."""

    intensity = ctx.get("intensity_tier", "work")
    adherence = ctx.get("adherence_profile") or {}
    balance = ctx.get("balance") or {}
    progression = ctx.get("progression_ledger") or {}
    streak_rebuild = adherence.get("streak_rebuild", False)

    # Pick block template — seeded from today's date so same structure all day,
    # different tomorrow. This is deterministic, not random.
    from datetime import datetime
    from zoneinfo import ZoneInfo
    day_seed = int(datetime.now(ZoneInfo("America/New_York")).strftime("%Y%m%d"))
    templates = BLOCK_TEMPLATES.get(intensity, BLOCK_TEMPLATES["work"])
    template = templates[day_seed % len(templates)]
    structure = template["structure"]
    total_min = template.get("total_min", 50)

    # Adherence: cut duration if streak-rebuild
    if streak_rebuild:
        total_min = max(25, total_min - 15)

    # Target patterns from balancer
    must_include = balance.get("must_include", [])
    avoid = balance.get("avoid", [])

    # Build pattern assignments per block
    if structure == "strength_metcon":
        # Strength gets 1-2 compound patterns, metcon gets 3-4
        strength_patterns = [p for p in must_include[:1] if p in ("squat", "hinge", "push_v", "pull_v")]
        if not strength_patterns:
            strength_patterns = ["squat"]
        remaining = [p for p in must_include if p not in strength_patterns]
        metcon_patterns = remaining[:3] or ["cardio", "olympic", "core"]
    elif structure == "active_recovery":
        strength_patterns = []
        metcon_patterns = []
    else:
        strength_patterns = []
        metcon_patterns = must_include[:4] or ["squat", "pull_v", "cardio"]

    # Build load prescriptions from progression ledger
    load_hints = {}
    for name, rec in progression.items():
        nxt = rec.get("next_lbs")
        if nxt:
            load_hints[name.lower()] = f"{int(nxt)}lb"

    skeleton = {
        "structure": structure,
        "intensity_tier": intensity,
        "total_duration_min": total_min,
        "warmup_min": 8 if total_min >= 45 else 5,
        "cooldown_min": 5 if total_min >= 40 else 3,
        "streak_rebuild": streak_rebuild,
    }

    if structure == "strength_metcon":
        skeleton["strength"] = {
            "sets": template.get("strength_sets", 4),
            "target_patterns": strength_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in strength_patterns},
        }
        skeleton["metcon"] = {
            "rounds": template.get("metcon_rounds", 3),
            "time_cap": template.get("time_cap"),
            "target_patterns": metcon_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in metcon_patterns},
        }
    elif structure == "amrap":
        skeleton["main"] = {
            "format": "AMRAP",
            "duration_min": template.get("duration_min", 20),
            "target_patterns": metcon_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in metcon_patterns},
        }
    elif structure == "for_time":
        skeleton["main"] = {
            "format": "For Time",
            "rounds": template.get("rounds", 4),
            "time_cap": template.get("time_cap", 20),
            "target_patterns": metcon_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in metcon_patterns},
        }
    elif structure == "emom":
        skeleton["main"] = {
            "format": "EMOM",
            "duration_min": template.get("duration_min", 16),
            "target_patterns": metcon_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in metcon_patterns},
        }
    elif structure == "intervals":
        skeleton["main"] = {
            "format": "Intervals",
            "work_sec": template.get("work_sec", 40),
            "rest_sec": template.get("rest_sec", 20),
            "rounds": template.get("rounds", 12),
            "target_patterns": metcon_patterns,
            "pattern_descriptions": {p: PATTERN_FAMILIES.get(p, p) for p in metcon_patterns},
        }
    else:  # active_recovery
        skeleton["main"] = {
            "format": "Active Recovery",
            "target_patterns": ["cardio"],
            "pattern_descriptions": {"cardio": "Zone 2 treadmill walk or easy jog"},
        }

    skeleton["avoid_patterns"] = avoid
    skeleton["load_hints"] = load_hints

    # Pattern-aware warmup (issue 13): warmup should activate the patterns
    # that the main session targets
    all_target_patterns = list(set(
        (skeleton.get("strength", {}).get("target_patterns") or []) +
        (skeleton.get("metcon", {}).get("target_patterns") or skeleton.get("main", {}).get("target_patterns") or [])
    ))
    WARMUP_MAP = {
        "squat": "hip circles, bodyweight squats, goblet squat holds",
        "hinge": "hip hinges, glute bridges, single-leg RDL (bodyweight)",
        "push_h": "push-up walkouts, scapular push-ups, arm circles",
        "push_v": "band pull-aparts, shoulder dislocates, light DB press",
        "pull_v": "dead hangs, scapular pull-ups, band-assisted pull-ups",
        "pull_h": "band rows, cat-cow, thoracic rotations",
        "olympic": "muscle clean drill (empty hands), hip pops, front rack stretch",
        "core": "dead bugs, bird dogs, plank hold",
        "cardio": "easy treadmill jog, high knees, butt kicks",
    }
    warmup_focus = [WARMUP_MAP.get(p, "") for p in all_target_patterns if p in WARMUP_MAP]
    skeleton["warmup_focus"] = warmup_focus

    # Session-aware cooldown (issue 14): stretch what was just worked
    COOLDOWN_MAP = {
        "squat": "pigeon stretch, couch stretch, quad foam roll",
        "hinge": "seated hamstring stretch, figure-four glute stretch, lower back child's pose",
        "push_h": "doorway chest stretch, tricep stretch, wrist flexor stretch",
        "push_v": "lat stretch on rack, cross-body shoulder stretch, neck rolls",
        "pull_v": "bicep wall stretch, lat foam roll, hang for 30s",
        "pull_h": "cat-cow, thoracic extension on foam roller, rear delt stretch",
        "olympic": "wrist stretches, hip flexor stretch, front rack mobility",
        "core": "cobra stretch, side-lying rotation, diaphragmatic breathing",
        "cardio": "standing quad stretch, calf stretch, easy walk 2 min",
    }
    cooldown_focus = [COOLDOWN_MAP.get(p, "") for p in all_target_patterns if p in COOLDOWN_MAP]
    skeleton["cooldown_focus"] = cooldown_focus

    return skeleton


def build_skeleton_prompt_block(skeleton: dict) -> str:
    """Convert the skeleton into the prompt block Gemini must follow."""
    import json

    lines = [
        "",
        "=" * 60,
        "SKELETON — DETERMINISTIC CONSTRAINTS (DO NOT OVERRIDE)",
        "=" * 60,
        "The rules engine has decided the following structure. Your job is",
        "to fill in the CREATIVE layer only: pick specific movements from",
        "the catalog within each target pattern, write the title, pacing",
        "notes, mental challenge, and warmup flow. You MUST NOT change:",
        "  - Block structure (strength + metcon, or AMRAP, etc.)",
        "  - Number of sets / rounds / time cap",
        "  - Total duration",
        "  - Target patterns (you pick movements WITHIN them, not outside)",
        "  - Prescribed loads from the load_hints (use them exactly)",
        "",
        f"Structure: {skeleton['structure']}",
        f"Intensity tier: {skeleton['intensity_tier']}",
        f"Total duration: {skeleton['total_duration_min']} min",
        f"Warmup: {skeleton.get('warmup_min', 8)} min",
        f"Cooldown: {skeleton.get('cooldown_min', 5)} min",
    ]

    if skeleton.get("streak_rebuild"):
        lines.append("")
        lines.append("*** STREAK REBUILD MODE: session is intentionally shorter and easier ***")

    if skeleton.get("strength"):
        s = skeleton["strength"]
        lines.append("")
        lines.append(f"STRENGTH BLOCK: {s['sets']} sets, NOT for time")
        lines.append(f"  Target patterns: {', '.join(s['target_patterns'])}")
        for p, desc in s.get("pattern_descriptions", {}).items():
            lines.append(f"    {p}: pick {desc}")

    main_key = "metcon" if skeleton.get("metcon") else "main"
    m = skeleton.get(main_key)
    if m:
        lines.append("")
        fmt = m.get("format", skeleton["structure"].upper())
        lines.append(f"{'METCON' if main_key == 'metcon' else 'MAIN'} BLOCK: {fmt}")
        if m.get("rounds"):
            lines.append(f"  Rounds: {m['rounds']}")
        if m.get("time_cap"):
            lines.append(f"  Time cap: {m['time_cap']} min")
        if m.get("duration_min"):
            lines.append(f"  Duration: {m['duration_min']} min")
        lines.append(f"  Target patterns: {', '.join(m.get('target_patterns', []))}")
        for p, desc in m.get("pattern_descriptions", {}).items():
            lines.append(f"    {p}: pick {desc}")

    if skeleton.get("warmup_focus"):
        lines.append("")
        lines.append("WARMUP must include activation for today's target patterns:")
        for w in skeleton["warmup_focus"]:
            if w: lines.append(f"  - {w}")

    if skeleton.get("cooldown_focus"):
        lines.append("")
        lines.append("COOLDOWN must stretch the muscles worked in today's session:")
        for c in skeleton["cooldown_focus"]:
            if c: lines.append(f"  - {c}")

    if skeleton.get("avoid_patterns"):
        lines.append("")
        lines.append(f"AVOID these patterns (worked yesterday): {', '.join(skeleton['avoid_patterns'])}")

    if skeleton.get("load_hints"):
        lines.append("")
        lines.append("PRESCRIBED LOADS (from progression ledger — use these EXACT weights):")
        for name, load in skeleton["load_hints"].items():
            lines.append(f"  {name}: {load}")

    return "\n".join(lines)
