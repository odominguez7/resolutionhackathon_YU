"""
Legacy workout.py — REPLACED.

The deterministic workout builder that lived here has been superseded by
the 3-layer hybrid in backend/oura/ (skeleton → progression → Gemini).
This shim exists only so optimize/routes.py's `generate_workout(biometrics)`
calls don't break. It converts the legacy biometrics dict into a simple
synchronous fallback workout since the full pipeline is async.
"""

from backend.oura.workout_validator import build_fallback_workout


def generate_workout(biometrics: dict) -> dict:
    """Thin shim: legacy callers get a safe deterministic workout.
    The real generation happens via /api/oura/workout (async + Gemini)."""
    fallback = build_fallback_workout(biometrics, "crossfit")

    # Map to the shape optimize/routes.py expects
    main = fallback.get("workout") or {}
    warmup = fallback.get("warmup") or {}
    cooldown = fallback.get("cooldown") or {}

    movements = []
    for m in (main.get("movements") or []):
        if isinstance(m, dict):
            movements.append(f"{m.get('reps', '')} {m.get('movement_name', '')} ({m.get('load', 'BW')})".strip())
        else:
            movements.append(str(m))

    return {
        "format": fallback.get("format", "For Time"),
        "format_desc": fallback.get("title", ""),
        "duration_min": fallback.get("duration_min", 45),
        "target_rpe": 6,
        "db_weight_lbs": 40,
        "adjustments": [],
        "movements": movements,
        "warmup": warmup.get("movements", []),
        "cooldown": cooldown.get("movements", []),
        "workout_text": " | ".join(movements),
        "estimated_calories": fallback.get("estimated_calories", 300),
        "pacing_note": "",
        "biometric_flags": [],
    }
