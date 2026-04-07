"""
Personalized workout generator — fuses Omar's Athlete Profile with real-time Oura biometrics.
Every workout is full body, home-gym compatible, and adjusted to today's recovery state.
"""
import random
from datetime import datetime

# ─── ATHLETE PROFILE (hardcoded from Omar's profile) ─────────────────

EQUIPMENT = {
    "dumbbells": [35, 40, 45, 50],  # per hand, lbs
    "treadmill": True,
    "pull_up_bar": True,
    "barbell": False,
}

DB_LOADS = {
    "light": 35,
    "moderate": 40,
    "heavy": 45,
    "max": 50,
}

# Movement library — home gym only, tagged by pattern
# Rules: lunges are ALWAYS bodyweight (load: False). Everything else can be loaded with DBs.
MOVEMENTS = {
    "hip_hinge": [
        {"name": "DB Deadlift", "pattern": "hip_hinge", "load": True, "pressing": False},
        {"name": "DB Romanian Deadlift", "pattern": "hip_hinge", "load": True, "pressing": False},
        {"name": "Single-Leg DB RDL (each)", "pattern": "hip_hinge", "load": True, "pressing": False},
        {"name": "Staggered-Stance DB Deadlift", "pattern": "hip_hinge", "load": True, "pressing": False},
        {"name": "Glute Bridge", "pattern": "hip_hinge", "load": False, "pressing": False},
        {"name": "Single-Leg Glute Bridge", "pattern": "hip_hinge", "load": False, "pressing": False},
        {"name": "Hip Thrust", "pattern": "hip_hinge", "load": False, "pressing": False},
    ],
    "squat": [
        {"name": "DB Front Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "DB Goblet Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "Air Squat", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Tempo Squat (3s down)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Jump Squat", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Narrow-Stance Squat", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Sumo Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "Single-Arm Front Rack Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "DB Overhead Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "DB Back Squat", "pattern": "squat", "load": True, "pressing": False},
        {"name": "Zercher DB Squat", "pattern": "squat", "load": True, "pressing": False},
        # Lunges — ALL bodyweight only
        {"name": "Split Squat (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Forward Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Reverse Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Walking Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Lateral Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Curtsy Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Split Squat (BW)", "pattern": "squat", "load": False, "pressing": False},
        {"name": "Jump Lunge (BW)", "pattern": "squat", "load": False, "pressing": False},
    ],
    "h_push": [
        {"name": "Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Hand-Release Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Diamond Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Wide-Grip Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Decline Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Archer Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Plyometric Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "Shoulder Tap Push-Up", "pattern": "h_push", "load": False, "pressing": True},
        {"name": "DB Floor Press", "pattern": "h_push", "load": True, "pressing": True},
        {"name": "Alternating DB Floor Press", "pattern": "h_push", "load": True, "pressing": True},
        {"name": "Single-Arm DB Floor Press", "pattern": "h_push", "load": True, "pressing": True},
        {"name": "Glute-Bridge DB Floor Press", "pattern": "h_push", "load": True, "pressing": True},
    ],
    "v_push": [
        {"name": "DB Strict Press", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "DB Push Press", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "DB Push Jerk", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "Single-Arm DB Press", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "Arnold Press", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "Z-Press", "pattern": "v_push", "load": True, "pressing": True},
        {"name": "DB Lateral Raise", "pattern": "v_push", "load": True, "pressing": False},
        {"name": "DB Front Raise", "pattern": "v_push", "load": True, "pressing": False},
    ],
    "v_pull": [
        {"name": "Strict Pull-Up", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "Strict Chin-Up", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "Tempo Pull-Up (slow eccentric)", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "Chest-to-Bar Pull-Up", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "Weighted Pull-Up", "pattern": "v_pull", "load": True, "pressing": False},
        {"name": "Hanging Knee Raise", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "Hanging Leg Raise", "pattern": "v_pull", "load": False, "pressing": False},
        {"name": "L-Hang", "pattern": "v_pull", "load": False, "pressing": False, "time_based": True},
    ],
    "h_pull": [
        {"name": "DB Bent-Over Row", "pattern": "h_pull", "load": True, "pressing": False},
        {"name": "Single-Arm DB Row", "pattern": "h_pull", "load": True, "pressing": False},
        {"name": "Pendlay-Style DB Row", "pattern": "h_pull", "load": True, "pressing": False},
        {"name": "Renegade Row", "pattern": "h_pull", "load": True, "pressing": False},
        {"name": "DB Reverse Fly", "pattern": "h_pull", "load": True, "pressing": False},
        {"name": "DB Seal Row", "pattern": "h_pull", "load": True, "pressing": False},
    ],
    "core": [
        {"name": "V-Up", "pattern": "core", "load": False, "pressing": False},
        {"name": "Tuck-Up", "pattern": "core", "load": False, "pressing": False},
        {"name": "Hollow Hold", "pattern": "core", "load": False, "pressing": False, "time_based": True},
        {"name": "Hollow Rock", "pattern": "core", "load": False, "pressing": False},
        {"name": "Dead Bug", "pattern": "core", "load": False, "pressing": False},
        {"name": "Russian Twist", "pattern": "core", "load": False, "pressing": False},
        {"name": "DB Weighted Sit-Up", "pattern": "core", "load": True, "pressing": False},
        {"name": "Plank Hold", "pattern": "core", "load": False, "pressing": False, "time_based": True},
        {"name": "Side Plank", "pattern": "core", "load": False, "pressing": False, "time_based": True},
        {"name": "Plank DB Drag", "pattern": "core", "load": True, "pressing": False},
        {"name": "Butterfly Sit-Up", "pattern": "core", "load": False, "pressing": False},
        {"name": "DB Side Bend", "pattern": "core", "load": True, "pressing": False},
        {"name": "Arch Hold", "pattern": "core", "load": False, "pressing": False, "time_based": True},
    ],
    "olympic": [
        {"name": "DB Power Clean", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "DB Hang Power Clean", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "DB Squat Clean", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "Single-Arm DB Power Snatch", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "Alternating DB Snatch", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "Man Maker", "pattern": "olympic", "load": True, "pressing": True},
        {"name": "Devil Press", "pattern": "olympic", "load": True, "pressing": True},
        {"name": "DB Hang Squat Clean", "pattern": "olympic", "load": True, "pressing": False},
        {"name": "Cluster (DB Squat Clean Thruster)", "pattern": "olympic", "load": True, "pressing": True},
    ],
    "cardio": [
        {"name": "Treadmill Run", "pattern": "cardio", "load": False, "pressing": False, "distance": True},
        {"name": "Burpees", "pattern": "cardio", "load": False, "pressing": True},
        {"name": "Treadmill Incline Sprint", "pattern": "cardio", "load": False, "pressing": False, "distance": True},
        {"name": "Burpee to Pull-Up", "pattern": "cardio", "load": False, "pressing": True},
        {"name": "Lateral Burpee Over DB", "pattern": "cardio", "load": False, "pressing": True},
        {"name": "Burpee Broad Jump", "pattern": "cardio", "load": False, "pressing": True},
        {"name": "Tuck Jump", "pattern": "cardio", "load": False, "pressing": False},
        {"name": "Broad Jump", "pattern": "cardio", "load": False, "pressing": False},
    ],
    "carry": [
        {"name": "DB Farmer Carry", "pattern": "carry", "load": True, "pressing": False, "distance": True},
        {"name": "Single-Arm Farmer Carry", "pattern": "carry", "load": True, "pressing": False, "distance": True},
        {"name": "Front Rack Carry", "pattern": "carry", "load": True, "pressing": False, "distance": True},
        {"name": "Overhead Carry", "pattern": "carry", "load": True, "pressing": False, "distance": True},
    ],
    "plyometric": [
        {"name": "Tuck Jump", "pattern": "plyometric", "load": False, "pressing": False},
        {"name": "Squat Jump", "pattern": "plyometric", "load": False, "pressing": False},
        {"name": "Jump Lunge", "pattern": "plyometric", "load": False, "pressing": False},
        {"name": "Skater Jump", "pattern": "plyometric", "load": False, "pressing": False},
        {"name": "Broad Jump", "pattern": "plyometric", "load": False, "pressing": False},
        {"name": "Single-Leg Pogo Hop", "pattern": "plyometric", "load": False, "pressing": False},
    ],
}

# Workout templates by type
FORMATS = {
    "amrap": {"name": "AMRAP", "loves": True, "desc": "As Many Rounds As Possible"},
    "chipper": {"name": "Chipper", "loves": True, "desc": "Complete all reps for time"},
    "emom": {"name": "EMOM", "loves": False, "desc": "Every Minute On the Minute"},
    "rounds": {"name": "For Rounds", "loves": True, "desc": "Complete prescribed rounds"},
    "recovery": {"name": "Recovery", "loves": False, "desc": "Active recovery session"},
}


def _pick(lst, n=1, exclude=None):
    """Pick n random items from list, excluding specified."""
    pool = [x for x in lst if x not in (exclude or [])]
    return random.sample(pool, min(n, len(pool)))


def _get_pull_pool():
    """Return combined pull pool: h_pull + v_pull (since we have a pull-up bar)."""
    if EQUIPMENT.get("pull_up_bar"):
        return MOVEMENTS["h_pull"] + MOVEMENTS["v_pull"]
    return MOVEMENTS["h_pull"]


def generate_workout(biometrics: dict) -> dict:
    """
    Generate a personalized workout based on Oura biometrics.

    biometrics dict should have:
      readiness, hrv, baseline_hrv, sleep_score, sleep_hours,
      avg_sleep_hours, stress_min, resting_hr, baseline_rhr, deep_sleep_pct
    """
    readiness = biometrics.get("readiness", 75)
    hrv = biometrics.get("hrv", 35)
    baseline_hrv = biometrics.get("baseline_hrv", 40)
    sleep_hours = biometrics.get("sleep_hours", 7)
    sleep_score = biometrics.get("sleep_score", 80)
    stress_min = biometrics.get("stress_min", 60)
    resting_hr = biometrics.get("resting_hr", 55)
    baseline_rhr = biometrics.get("baseline_rhr", 55)
    deep_sleep_pct = biometrics.get("deep_sleep_pct", 18)

    # ─── BIOMETRIC AUTO-ADJUSTMENTS (from athlete profile section 9.2) ───

    adjustments = []
    target_rpe = 8.5
    target_duration = 35  # minutes
    db_tier = "moderate"  # 40 lb default
    format_type = "amrap"
    overhead_allowed = True
    volume_multiplier = 1.0

    # Rule 1: HRV check
    if hrv < baseline_hrv * 0.85:
        target_rpe -= 1
        format_type = "emom"  # structured pacing
        adjustments.append(f"HRV {hrv}ms is {round((1 - hrv/baseline_hrv)*100)}% below your {baseline_hrv}ms baseline. Reducing intensity.")

    # Rule 2: Resting HR elevated
    if resting_hr > baseline_rhr + 5:
        volume_multiplier *= 0.8
        overhead_allowed = False
        adjustments.append(f"Resting HR {resting_hr}bpm is elevated (+{round(resting_hr - baseline_rhr)}bpm). Reducing volume, no overhead pressing.")

    # Rule 3: Sleep < 6 hours
    if sleep_hours < 6:
        target_duration = min(target_duration, 25)
        db_tier = "light"
        format_type = "recovery"
        adjustments.append(f"Only {sleep_hours}h sleep. Capping at 25min, lighter loads, recovery focus.")
    elif sleep_hours < 7:
        target_duration = min(target_duration, 30)
        adjustments.append(f"{sleep_hours}h sleep (below your {biometrics.get('avg_sleep_hours', 7)}h avg). Slightly shorter session.")

    # Rule 4: Readiness-based
    if readiness >= 80 and hrv >= baseline_hrv:
        target_rpe = 8.5
        target_duration = 35
        db_tier = "heavy"
        format_type = random.choice(["amrap", "chipper", "rounds"])
        if not adjustments:
            adjustments.append(f"Readiness {readiness}, HRV {hrv}ms. You're primed. Go hard today.")
    elif readiness >= 65:
        target_rpe = min(target_rpe, 7.5)
        target_duration = min(target_duration, 30)
        db_tier = "moderate"
        if not adjustments:
            adjustments.append(f"Readiness {readiness}. Solid day for moderate effort.")
    elif readiness < 65:
        target_rpe = min(target_rpe, 6.5)
        target_duration = min(target_duration, 25)
        db_tier = "light"
        format_type = "recovery"
        adjustments.append(f"Readiness {readiness}. Your body needs recovery today.")

    # Rule 5: High stress
    if stress_min > 120:
        adjustments.append(f"Stress elevated ({stress_min}min). Adding extra mobility and breathwork.")

    db_weight = DB_LOADS[db_tier]
    fmt = FORMATS[format_type]

    # ─── BUILD THE WORKOUT ───

    from zoneinfo import ZoneInfo
    seed = int(datetime.now(ZoneInfo("America/New_York")).strftime("%Y%m%d"))
    random.seed(seed)  # same workout all day, different tomorrow

    if format_type == "recovery":
        workout = _build_recovery(db_weight, target_duration)
    elif format_type == "emom":
        workout = _build_emom(db_weight, target_duration, overhead_allowed, volume_multiplier, readiness)
    elif format_type == "chipper":
        workout = _build_chipper(db_weight, target_duration, overhead_allowed, volume_multiplier, readiness)
    elif format_type == "rounds":
        workout = _build_rounds(db_weight, target_duration, overhead_allowed, volume_multiplier, readiness)
    else:  # amrap
        workout = _build_amrap(db_weight, target_duration, overhead_allowed, volume_multiplier, readiness)

    random.seed()  # reset seed

    return {
        "format": fmt["name"],
        "format_desc": fmt["desc"],
        "duration_min": target_duration,
        "target_rpe": target_rpe,
        "db_weight_lbs": db_weight,
        "adjustments": adjustments,
        "movements": workout["movements"],
        "warmup": _build_warmup(),
        "cooldown": _build_cooldown(stress_min > 120),
        "workout_text": workout["text"],
        "estimated_calories": _estimate_calories(target_duration, target_rpe),
        "pacing_note": workout.get("pacing_note", ""),
        "biometric_flags": _get_flags(biometrics, baseline_hrv, baseline_rhr),
    }


def _build_amrap(db_wt, duration, overhead, vol_mult, readiness=75):
    movements = []
    text_lines = [f"AMRAP {duration} Minutes:"]

    # Full body: cardio, hinge, squat, push, pull (h+v), core, + optional olympic
    cardio = _pick(MOVEMENTS["cardio"])[0]
    hinge = _pick(MOVEMENTS["hip_hinge"])[0]
    squat = _pick(MOVEMENTS["squat"])[0]
    push_pool = MOVEMENTS["h_push"] + (MOVEMENTS["v_push"] if overhead else [])
    push = _pick(push_pool)[0]
    pull = _pick(_get_pull_pool())[0]
    core = _pick(MOVEMENTS["core"])[0]

    base_reps = round(12 * vol_mult)
    cardio_dist = "400m" if duration >= 30 else "200m"

    sequence = [
        (cardio, cardio_dist if cardio.get("distance") else str(round(15 * vol_mult))),
        (hinge, f"{base_reps}" + (f" (2x{db_wt} lb)" if hinge["load"] else "")),
        (push, f"{round(15 * vol_mult)}" + (f" (2x{db_wt} lb)" if push["load"] else "")),
        (squat, f"{base_reps}" + (f" (2x{db_wt} lb)" if squat["load"] else "")),
        (pull, f"{base_reps}" + (f" (2x{db_wt} lb)" if pull["load"] else "")),
        (core, f"{round(15 * vol_mult)}" if not core.get("time_based") else "30 sec"),
    ]

    # Add olympic movement when readiness is high
    if readiness >= 75 and MOVEMENTS.get("olympic"):
        oly = _pick(MOVEMENTS["olympic"])[0]
        oly_reps = round(8 * vol_mult)
        sequence.insert(3, (oly, f"{oly_reps}" + f" (2x{db_wt} lb)"))

    # Ensure no 2 consecutive pressing movements
    reordered = _reorder_no_consecutive_press(sequence)

    for mv, reps in reordered:
        movements.append({"name": mv["name"], "reps": reps, "pattern": mv["pattern"]})
        text_lines.append(f"  {reps} {mv['name']}")

    return {
        "movements": movements,
        "text": "\n".join(text_lines),
        "pacing_note": f"Target: even round splits. Don't go out too fast. Aim for {max(2, round(duration / 10))}+ rounds.",
    }


def _build_chipper(db_wt, duration, overhead, vol_mult, readiness=75):
    movements = []
    text_lines = ["For Time:"]

    cardio = _pick(MOVEMENTS["cardio"])[0]
    hinge = _pick(MOVEMENTS["hip_hinge"])[0]
    squat = _pick(MOVEMENTS["squat"])[0]
    push_pool = MOVEMENTS["h_push"] + (MOVEMENTS["v_push"] if overhead else [])
    push1 = _pick(push_pool)[0]
    push2 = _pick(MOVEMENTS["h_push"], exclude=[push1])[0] if overhead else None
    pull = _pick(_get_pull_pool())[0]
    core = _pick(MOVEMENTS["core"])[0]
    carry = _pick(MOVEMENTS["carry"])[0]

    high_reps = round(30 * vol_mult)
    med_reps = round(20 * vol_mult)
    low_reps = round(15 * vol_mult)

    sequence = [
        (cardio, "800m" if cardio.get("distance") else str(high_reps)),
        (squat, f"{high_reps}" + (f" (2x{db_wt} lb)" if squat["load"] else "")),
        (push1, f"{med_reps}" + (f" (2x{db_wt} lb)" if push1["load"] else "")),
        (hinge, f"{med_reps}" + (f" (2x{db_wt} lb)" if hinge["load"] else "")),
        (pull, f"{low_reps}" + (f" (2x{db_wt} lb)" if pull["load"] else "")),
        (core, f"{high_reps}" if not core.get("time_based") else "60 sec"),
        (carry, f"200m (2x{db_wt} lb)"),
        (cardio, "400m" if cardio.get("distance") else str(med_reps)),
    ]

    # Add olympic movement when readiness is high
    if readiness >= 75 and MOVEMENTS.get("olympic"):
        oly = _pick(MOVEMENTS["olympic"])[0]
        oly_reps = round(10 * vol_mult)
        sequence.insert(4, (oly, f"{oly_reps}" + f" (2x{db_wt} lb)"))

    reordered = _reorder_no_consecutive_press(sequence)

    for mv, reps in reordered:
        movements.append({"name": mv["name"], "reps": reps, "pattern": mv["pattern"]})
        text_lines.append(f"  {reps} {mv['name']}")

    return {
        "movements": movements,
        "text": "\n".join(text_lines),
        "pacing_note": f"Target: {duration}min cap. Break it into thirds mentally. Don't sprint the first movement.",
    }


def _build_rounds(db_wt, duration, overhead, vol_mult, readiness=75):
    rounds = 4 if duration >= 30 else 3
    movements = []
    text_lines = [f"{rounds} Rounds:"]

    cardio = _pick(MOVEMENTS["cardio"])[0]
    hinge = _pick(MOVEMENTS["hip_hinge"])[0]
    squat = _pick(MOVEMENTS["squat"])[0]
    push_pool = MOVEMENTS["h_push"] + (MOVEMENTS["v_push"] if overhead else [])
    push = _pick(push_pool)[0]
    pull = _pick(_get_pull_pool())[0]
    core = _pick(MOVEMENTS["core"])[0]

    base_reps = round(12 * vol_mult)

    sequence = [
        (cardio, "400m" if cardio.get("distance") else str(round(15 * vol_mult))),
        (hinge, f"{base_reps}" + (f" (2x{db_wt} lb)" if hinge["load"] else "")),
        (push, f"{round(15 * vol_mult)}" + (f" (2x{db_wt} lb)" if push["load"] else "")),
        (squat, f"{base_reps}" + (f" (2x{db_wt} lb)" if squat["load"] else "")),
        (pull, f"{base_reps}" + (f" (2x{db_wt} lb)" if pull["load"] else "")),
        (core, f"{round(15 * vol_mult)}" if not core.get("time_based") else "30 sec"),
    ]

    # Add olympic movement when readiness is high
    if readiness >= 75 and MOVEMENTS.get("olympic"):
        oly = _pick(MOVEMENTS["olympic"])[0]
        oly_reps = round(8 * vol_mult)
        sequence.insert(3, (oly, f"{oly_reps}" + f" (2x{db_wt} lb)"))

    reordered = _reorder_no_consecutive_press(sequence)

    for mv, reps in reordered:
        movements.append({"name": mv["name"], "reps": reps, "pattern": mv["pattern"]})
        text_lines.append(f"  {reps} {mv['name']}")

    return {
        "movements": movements,
        "text": "\n".join(text_lines),
        "pacing_note": f"Target: even splits. Round 1 pace = Round {rounds} pace. Rest only between rounds if needed.",
    }


def _build_emom(db_wt, duration, overhead, vol_mult, readiness=75):
    movements = []
    # Alternate minutes between stations (now 6 with v_pull)
    cardio = _pick(MOVEMENTS["cardio"])[0]
    hinge = _pick(MOVEMENTS["hip_hinge"])[0]
    push_pool = MOVEMENTS["h_push"] + (MOVEMENTS["v_push"] if overhead else [])
    push = _pick(push_pool)[0]
    pull = _pick(_get_pull_pool())[0]
    core = _pick(MOVEMENTS["core"])[0]

    reps = round(10 * vol_mult)

    stations = [
        (cardio, "200m" if cardio.get("distance") else str(round(12 * vol_mult))),
        (hinge, f"{reps}" + (f" (2x{db_wt} lb)" if hinge["load"] else "")),
        (push, f"{reps}" + (f" (2x{db_wt} lb)" if push["load"] else "")),
        (pull, f"{reps}" + (f" (2x{db_wt} lb)" if pull["load"] else "")),
        (core, f"{round(12 * vol_mult)}" if not core.get("time_based") else "30 sec"),
    ]

    # Add olympic station when readiness is high
    if readiness >= 75 and MOVEMENTS.get("olympic"):
        oly = _pick(MOVEMENTS["olympic"])[0]
        oly_reps = round(6 * vol_mult)
        stations.insert(3, (oly, f"{oly_reps}" + f" (2x{db_wt} lb)"))

    num_stations = len(stations)
    text_lines = [f"EMOM {duration} Minutes ({num_stations} stations, rotating):"]

    for i, (mv, reps) in enumerate(stations):
        movements.append({"name": mv["name"], "reps": reps, "pattern": mv["pattern"]})
        text_lines.append(f"  Min {i+1}: {reps} {mv['name']}")

    text_lines.append(f"  (Repeat for {duration // num_stations} cycles)")

    return {
        "movements": movements,
        "text": "\n".join(text_lines),
        "pacing_note": "Finish each minute's work in :40-:45. Use remaining time to transition and breathe.",
    }


def _build_recovery(db_wt, duration):
    movements = []
    text_lines = [f"Active Recovery — {duration} Minutes:"]

    sequence = [
        "5 min Treadmill Walk (3.5 mph, slight incline)",
        "2 min Arm Circles + Shoulder Pass-Throughs",
        f"3 x 8 Light DB Romanian Deadlift (2x{DB_LOADS['light']} lb)",
        "3 x 10 Air Squats (slow tempo, 3 sec down)",
        "3 x 8 DB Bent-Over Row (2x{} lb, controlled)".format(DB_LOADS["light"]),
        "2 x 30 sec Plank Hold",
        "2 x 15 V-Up",
        "2 x 5 Strict Pull-Up (slow negative)" if EQUIPMENT.get("pull_up_bar") else "2 x 10 Dead Bug",
        "5 min Treadmill Walk (cooldown pace)",
        "5 min Stretching (hip flexors, shoulders, hamstrings)",
    ]

    for line in sequence:
        text_lines.append(f"  {line}")
        movements.append({"name": line, "reps": "", "pattern": "recovery"})

    return {
        "movements": movements,
        "text": "\n".join(text_lines),
        "pacing_note": "This is a recovery day. Keep effort at RPE 5-6. Focus on movement quality, not speed.",
    }


def _build_warmup():
    warmup = [
        "2 min Treadmill Jog (easy pace)",
        "10 Arm Circles (each direction)",
        "10 Air Squats",
        "10 Inchworms",
        "5 World's Greatest Stretch (each side)",
        "10 DB Deadlifts (light, warm-up weight)",
    ]
    if EQUIPMENT.get("pull_up_bar"):
        warmup.append("5 Scap Pull-Ups + 10 sec Dead Hang")
    return warmup


def _build_cooldown(high_stress=False):
    base = [
        "3 min Treadmill Walk (cooldown pace)",
        "Pigeon Stretch — 1 min each side",
        "Doorway Chest Stretch — 30 sec each side",
        "Standing Hamstring Stretch — 1 min each side",
    ]
    if EQUIPMENT.get("pull_up_bar"):
        base.append("Dead Hang — 30 sec x 2")
    if high_stress:
        base.extend([
            "Box Breathing — 4 rounds (4 sec in, 4 hold, 4 out, 4 hold)",
            "Legs Up Wall — 3 min",
        ])
    return base


def _reorder_no_consecutive_press(sequence):
    """Ensure no 2 consecutive pressing movements (athlete profile rule)."""
    pressing = [(i, s) for i, s in enumerate(sequence) if s[0].get("pressing")]
    non_pressing = [(i, s) for i, s in enumerate(sequence) if not s[0].get("pressing")]

    result = []
    p_idx = 0
    np_idx = 0

    # Alternate: non-pressing, pressing, non-pressing...
    while p_idx < len(pressing) or np_idx < len(non_pressing):
        if np_idx < len(non_pressing):
            result.append(non_pressing[np_idx][1])
            np_idx += 1
        if p_idx < len(pressing):
            result.append(pressing[p_idx][1])
            p_idx += 1

    return result


def _estimate_calories(duration, rpe):
    """Rough estimate: 12-14 kcal/min at RPE 8.5 (from athlete profile benchmarks)."""
    base_rate = 10 + (rpe - 6) * 2  # ~10 kcal/min at RPE 6, ~15 at RPE 8.5
    return round(base_rate * duration)


def _get_flags(bio, baseline_hrv, baseline_rhr):
    """Return biometric flags for display."""
    flags = []
    hrv = bio.get("hrv", 0)
    rhr = bio.get("resting_hr", 0)
    sleep = bio.get("sleep_hours", 7)

    if hrv < baseline_hrv * 0.85:
        flags.append({"type": "warning", "message": f"HRV {hrv}ms is significantly below baseline ({baseline_hrv}ms)"})
    elif hrv < baseline_hrv:
        flags.append({"type": "caution", "message": f"HRV {hrv}ms is below baseline ({baseline_hrv}ms)"})
    else:
        flags.append({"type": "good", "message": f"HRV {hrv}ms is at or above baseline"})

    if rhr > baseline_rhr + 5:
        flags.append({"type": "warning", "message": f"Resting HR {rhr}bpm is elevated"})

    if sleep < 6:
        flags.append({"type": "warning", "message": f"Only {sleep}h sleep — session auto-capped"})
    elif sleep < 7:
        flags.append({"type": "caution", "message": f"{sleep}h sleep — slightly below average"})

    return flags
