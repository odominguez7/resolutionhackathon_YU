"""
Drift Detection Engine v3 — Recovery Readiness Score + Warning Flags + Overtraining Continuum.

Based on "Recovery Forecasting & Performance Optimization: A Wearable Data Decision Engine"
(Dominguez, April 2026) — 60-page research document grounded in 35 scientific sources.

ARCHITECTURE:
1. BASELINE: 28-day rolling average per metric (idiographic, not population)
2. Z-SCORES: Each metric scored against personal baseline
3. RRS (Recovery Readiness Score): Weighted composite 0-100
4. WARNING FLAGS: 10 clinical flags with defined thresholds (Meeusen et al. 2013)
5. ZONE CLASSIFICATION: GREEN (push) / YELLOW (moderate) / RED (rest)
6. OVERTRAINING STAGING: Acute Fatigue → FOR → NFOR → OTS (Meeusen continuum)
7. DRIFT DETECTION: 3+ days in YELLOW/RED within 7-day window = active drift

SIGNAL WEIGHTS (from RRS model, validated against Plews et al. 2012, 2013):
- HRV (LnRMSSD):     0.30 — most sensitive autonomic marker, earliest signal
- RHR:               0.20 — slower but highly specific when elevated
- Sleep Score:        0.20 — composite of duration, efficiency, architecture
- Deep Sleep:         0.10 — GH pulsatility, physical recovery
- Stress:             0.10 — allostatic load accumulation
- Readiness:          0.10 — Oura's composite recovery indicator

SOURCES:
- Meeusen et al. 2013 — Overtraining consensus (ECSS/ACSM)
- Plews et al. 2012 — NFOR case study via HRV
- Plews et al. 2013 — HRV saturation in endurance athletes
- Buchheit 2014 — Monitoring training with HR measures
- Halson 2014 — Sleep and the elite athlete
- McEwen 2006 — Allostatic load and stress
"""

import statistics
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

# ── RRS Component Weights (sum = 1.0) ─────────────────────────────────────
WEIGHTS = {
    "hrv": 0.30,
    "rhr": 0.20,
    "sleep_score": 0.20,
    "deep_sleep": 0.10,
    "stress": 0.10,
    "readiness": 0.10,
}

# ── Windows ────────────────────────────────────────────────────────────────
BASELINE_WINDOW = 28       # 28-day rolling baseline (research standard)
CURRENT_WINDOW = 7         # 7-day assessment window
MIN_FLAGS_FOR_DRIFT = 3    # 3+ days with flags = drift detected

# ── Warning Flag Thresholds (from research document) ──────────────────────
FLAGS = [
    {"id": "F1", "name": "HRV below baseline",       "metric": "hrv_z",       "threshold": -1.0,  "compare": "lt",  "weight": "primary"},
    {"id": "F2", "name": "RHR elevated",              "metric": "rhr_delta",   "threshold": 5.0,   "compare": "gt",  "weight": "primary"},
    {"id": "F3", "name": "Sleep duration short",       "metric": "total_sleep", "threshold": 6.5,   "compare": "lt",  "weight": "primary"},
    {"id": "F4", "name": "Sleep efficiency low",       "metric": "efficiency",  "threshold": 80.0,  "compare": "lt",  "weight": "secondary"},
    {"id": "F5", "name": "Deep sleep deficit",         "metric": "deep_min",    "threshold": 45.0,  "compare": "lt",  "weight": "secondary"},
    {"id": "F6", "name": "Sustained HRV decline",      "metric": "hrv_trend",   "threshold": 5,     "compare": "gte", "weight": "drift"},
    {"id": "F7", "name": "High stress load",           "metric": "stress_min",  "threshold": 120.0, "compare": "gt",  "weight": "secondary"},
    {"id": "F8", "name": "Readiness below threshold",  "metric": "readiness",   "threshold": 60.0,  "compare": "lt",  "weight": "secondary"},
]

# ── Zone Thresholds ───────────────────────────────────────────────────────
ZONES = {
    "GREEN":  {"rrs_min": 70, "max_flags": 1, "label": "Push", "description": "Your body is ready to perform. Train hard, prioritize intensity."},
    "YELLOW": {"rrs_min": 40, "max_flags": 2, "label": "Moderate", "description": "Recovery is incomplete. Move and recover, but don't degrade further."},
    "RED":    {"rrs_min": 0,  "max_flags": 99, "label": "Rest", "description": "Rest is the highest ROI decision today. Your body needs time to rebuild."},
}

# ── Overtraining Continuum ────────────────────────────────────────────────
CONTINUUM = [
    {"stage": "Baseline",                "days_in_yellow_red": 0,  "description": "Normal recovery. All systems nominal."},
    {"stage": "Acute Fatigue",            "days_in_yellow_red": 2,  "description": "Normal homeostatic disruption. Recovery expected within 24-48h."},
    {"stage": "Functional Overreaching",  "days_in_yellow_red": 5,  "description": "Deliberate short-term performance dip. Supercompensation possible with 1-2 weeks rest."},
    {"stage": "Non-Functional Overreaching", "days_in_yellow_red": 10, "description": "Performance decline with psychological disturbances. Weeks to months for recovery."},
    {"stage": "Overtraining Syndrome",    "days_in_yellow_red": 21, "description": "Multi-system maladaptation. Requires clinical intervention. Months to years."},
]


def detect_drift_real(daily_data: list[dict]) -> dict:
    """Analyze real Oura biometric data using RRS + Warning Flags + Overtraining Continuum."""

    if len(daily_data) < BASELINE_WINDOW + CURRENT_WINDOW:
        return {
            "drift_detected": False,
            "reason": f"Need {BASELINE_WINDOW + CURRENT_WINDOW} days, have {len(daily_data)}",
            "signals": [], "daily_scores": [],
        }

    data = sorted(daily_data, key=lambda d: d["day"])
    daily_scores = []

    for i in range(BASELINE_WINDOW, len(data)):
        day = data[i]
        baseline = data[max(0, i - BASELINE_WINDOW):i]

        def vals(arr, key):
            return [d[key] for d in arr if d.get(key) is not None and d.get(key) != 0]

        bl = {
            "hrv": vals(baseline, "hrv"),
            "rhr": vals(baseline, "avgHeartRate"),
            "sleep": vals(baseline, "sleepScore"),
            "readiness": vals(baseline, "readinessScore"),
            "deep": vals(baseline, "deepSleepMin"),
            "stress": vals(baseline, "stressMin"),
        }

        if len(bl["hrv"]) < 14 or len(bl["sleep"]) < 14:
            continue

        # Current values
        c = {
            "hrv": day.get("hrv"),
            "rhr": day.get("avgHeartRate"),
            "sleep": day.get("sleepScore"),
            "readiness": day.get("readinessScore"),
            "deep": day.get("deepSleepMin"),
            "stress": day.get("stressMin"),
            "total_sleep": day.get("totalSleepHours"),
            "efficiency": day.get("efficiency"),
        }

        # ── Z-scores ──────────────────────────────────────────────────────
        z = {}
        bl_means = {}

        for metric, key, invert in [
            ("hrv", "hrv", False),
            ("rhr", "rhr", True),
            ("sleep_score", "sleep", False),
            ("readiness", "readiness", False),
            ("deep_sleep", "deep", False),
            ("stress", "stress", True),
        ]:
            if c[key] and len(bl[key]) >= 2:
                mean = statistics.mean(bl[key])
                std = statistics.stdev(bl[key]) or 1
                raw_z = (c[key] - mean) / std
                z[metric] = -raw_z if invert else raw_z
                bl_means[key] = mean

        # ── RRS (Recovery Readiness Score) ────────────────────────────────
        rrs = 50  # neutral starting point
        total_w = 0
        for metric, weight in WEIGHTS.items():
            if metric in z:
                # Map z-score to 0-100 contribution: z=0 → 50, z=+2 → 100, z=-2 → 0
                contribution = max(0, min(100, 50 + z[metric] * 25))
                rrs += (contribution - 50) * weight
                total_w += weight

        rrs = max(0, min(100, round(rrs)))

        # ── Warning Flags ─────────────────────────────────────────────────
        active_flags = []

        # F1: HRV z-score below baseline
        if z.get("hrv", 0) < -1.0:
            active_flags.append({"id": "F1", "name": "HRV below baseline", "value": f"z={z['hrv']:.2f}", "weight": "primary"})

        # F2: RHR elevated
        rhr_delta = (c["rhr"] - bl_means.get("rhr", c["rhr"] or 60)) if c["rhr"] else 0
        if rhr_delta > 5:
            active_flags.append({"id": "F2", "name": "RHR elevated", "value": f"+{rhr_delta:.1f} bpm", "weight": "primary"})

        # F3: Sleep duration short
        if c["total_sleep"] and c["total_sleep"] < 6.5:
            active_flags.append({"id": "F3", "name": "Sleep duration short", "value": f"{c['total_sleep']:.1f}h", "weight": "primary"})

        # F4: Sleep efficiency low
        if c["efficiency"] and c["efficiency"] < 80:
            active_flags.append({"id": "F4", "name": "Sleep efficiency low", "value": f"{c['efficiency']:.0f}%", "weight": "secondary"})

        # F5: Deep sleep deficit
        if c["deep"] and c["deep"] < 45:
            active_flags.append({"id": "F5", "name": "Deep sleep deficit", "value": f"{c['deep']:.0f} min", "weight": "secondary"})

        # F6: Sustained HRV decline (check 5-day trend)
        if i >= 5:
            recent_hrv = [data[j].get("hrv") for j in range(i - 4, i + 1) if data[j].get("hrv")]
            if len(recent_hrv) >= 5 and all(recent_hrv[j] <= recent_hrv[j - 1] for j in range(1, len(recent_hrv))):
                active_flags.append({"id": "F6", "name": "Sustained HRV decline", "value": "5+ consecutive days", "weight": "drift"})

        # F7: High stress load
        if c["stress"] and c["stress"] > 120:
            active_flags.append({"id": "F7", "name": "High stress load", "value": f"{c['stress']:.0f} min", "weight": "secondary"})

        # F8: Readiness below threshold
        if c["readiness"] and c["readiness"] < 60:
            active_flags.append({"id": "F8", "name": "Readiness below threshold", "value": f"{c['readiness']}", "weight": "secondary"})

        # ── Compounding penalty (from research: 3+ flags → 15% RRS penalty) ──
        if len(active_flags) >= 3:
            rrs = round(rrs * 0.85)

        # ── Zone classification ───────────────────────────────────────────
        if rrs >= 70 and len(active_flags) <= 1:
            zone = "GREEN"
        elif rrs >= 40 and len(active_flags) <= 2:
            zone = "YELLOW"
        else:
            zone = "RED"

        daily_scores.append({
            "day": day["day"],
            "rrs": rrs,
            "zone": zone,
            "flags": active_flags,
            "flag_count": len(active_flags),
            "z_scores": {k: round(v, 2) for k, v in z.items()},
            "values": {
                "hrv": c["hrv"],
                "rhr": round(c["rhr"], 1) if c["rhr"] else None,
                "sleep_score": c["sleep"],
                "readiness": c["readiness"],
                "deep_sleep_min": c["deep"],
                "stress_min": c["stress"],
                "total_sleep_hours": c["total_sleep"],
                "efficiency": c["efficiency"],
            },
            # Keep backward compatibility
            "drift_score": round((rrs - 50) / 25, 2),
        })

    # ── Drift detection: 3+ YELLOW/RED days in last 7 ─────────────────────
    recent = daily_scores[-CURRENT_WINDOW:] if daily_scores else []
    yellow_red_days = [d for d in recent if d["zone"] in ("YELLOW", "RED")]
    red_days = [d for d in recent if d["zone"] == "RED"]
    drift_detected = len(yellow_red_days) >= MIN_FLAGS_FOR_DRIFT

    # ── Overtraining continuum staging ─────────────────────────────────────
    # Count consecutive YELLOW/RED days from most recent
    consecutive_impaired = 0
    for d in reversed(daily_scores):
        if d["zone"] in ("YELLOW", "RED"):
            consecutive_impaired += 1
        else:
            break

    stage = CONTINUUM[0]
    for s in CONTINUUM:
        if consecutive_impaired >= s["days_in_yellow_red"]:
            stage = s

    # ── Severity from RRS and flags ───────────────────────────────────────
    if drift_detected and recent:
        avg_rrs = statistics.mean([d["rrs"] for d in yellow_red_days])
        avg_flags = statistics.mean([d["flag_count"] for d in yellow_red_days])
        if avg_rrs < 35 or avg_flags >= 4:
            severity = "high"
        elif avg_rrs < 55 or avg_flags >= 2.5:
            severity = "medium"
        else:
            severity = "low"
    else:
        severity = "none"
        avg_rrs = recent[-1]["rrs"] if recent else 50

    # ── Baseline display ──────────────────────────────────────────────────
    bl_data = data[max(0, len(data) - BASELINE_WINDOW - CURRENT_WINDOW):max(0, len(data) - CURRENT_WINDOW)]
    baseline_display = {}
    for key, field in [("sleepScore", "sleepScore"), ("hrv", "hrv"), ("rhr", "avgHeartRate"), ("readiness", "readinessScore")]:
        v = [d[field] for d in bl_data if d.get(field)]
        baseline_display[key] = round(statistics.mean(v), 1) if v else 0

    # ── Chart signals ─────────────────────────────────────────────────────
    chart_signals = []
    for ds in daily_scores[-21:]:
        chart_signals.append({
            "date": ds["day"],
            "sleepScore": ds["values"]["sleep_score"],
            "hrv": ds["values"]["hrv"],
            "readiness": ds["values"]["readiness"],
            "rrs": ds["rrs"],
            "zone": ds["zone"],
            "flagCount": ds["flag_count"],
            "driftScore": ds["drift_score"],
            "inDrift": ds["zone"] in ("YELLOW", "RED"),
        })

    # ── Drivers ───────────────────────────────────────────────────────────
    drivers = []
    if drift_detected and yellow_red_days:
        avg_z = {}
        for metric in WEIGHTS:
            zvals = [d["z_scores"].get(metric) for d in yellow_red_days if metric in d["z_scores"]]
            if zvals:
                avg_z[metric] = statistics.mean(zvals)

        labels = {
            "hrv": "Nervous system recovery is slow -- your body isn't recharging between days",
            "rhr": "Heart working harder at rest -- sign of incomplete recovery",
            "sleep_score": "Sleep quality dropping -- you're sleeping but not recovering",
            "readiness": "Body not bouncing back -- needs more rest than it's getting",
            "deep_sleep": "Deep sleep deficit -- growth hormone repair is impaired",
            "stress": "Sustained stress load -- sympathetic dominance is blocking recovery",
        }

        for metric, zval in sorted(avg_z.items(), key=lambda x: x[1]):
            if zval < -0.3:
                drivers.append({
                    "metric": metric, "z_score": round(zval, 2),
                    "weight": WEIGHTS[metric],
                    "description": labels.get(metric, metric),
                })

    # ── Active flags summary (most recent day) ────────────────────────────
    today_flags = recent[-1]["flags"] if recent else []
    today_rrs = recent[-1]["rrs"] if recent else 50
    today_zone = recent[-1]["zone"] if recent else "GREEN"

    return {
        "drift_detected": drift_detected,
        "currently_active": len(yellow_red_days) >= MIN_FLAGS_FOR_DRIFT,
        "severity": severity,
        "severity_score": round(100 - avg_rrs),
        "consecutive_days": len(yellow_red_days),
        "consecutive_impaired": consecutive_impaired,
        "drift_start_date": yellow_red_days[0]["day"] if yellow_red_days else None,
        "baseline": baseline_display,
        "signals": chart_signals,
        "drivers": drivers,

        # New: RRS + Warning Flags + Zones + Continuum
        "rrs": {
            "score": today_rrs,
            "zone": today_zone,
            "zone_label": ZONES[today_zone]["label"],
            "zone_description": ZONES[today_zone]["description"],
        },
        "warning_flags": {
            "active": today_flags,
            "count": len(today_flags),
            "primary": [f for f in today_flags if f["weight"] == "primary"],
            "secondary": [f for f in today_flags if f["weight"] != "primary"],
        },
        "overtraining_stage": {
            "stage": stage["stage"],
            "days_impaired": consecutive_impaired,
            "description": stage["description"],
        },

        "summary": _build_summary(drift_detected, severity, drivers, baseline_display, yellow_red_days, today_rrs, today_zone, stage, today_flags),
        "algorithm": {
            "version": "3.0",
            "name": "RRS + Warning Flags + Overtraining Continuum",
            "baseline_window": BASELINE_WINDOW,
            "current_window": CURRENT_WINDOW,
            "weights": WEIGHTS,
            "flags_defined": len(FLAGS),
            "sources": "Meeusen et al. 2013, Plews et al. 2012/2013, Buchheit 2014, Halson 2014",
        },
    }


def _build_summary(detected, severity, drivers, baseline, drift_days, rrs, zone, stage, flags):
    if not detected:
        return (
            f"Recovery Readiness Score: {rrs}/100 (Zone {zone}). "
            f"Your body looks good. All signals are within your personal baseline. "
            f"Keep doing what you're doing."
        )

    days = len(drift_days)
    driver_plain = {
        "hrv": "your nervous system is recovering slower than normal",
        "rhr": "your resting heart rate is elevated, meaning your body is working harder at rest",
        "sleep_score": "your sleep quality has declined",
        "readiness": "your body isn't bouncing back like it usually does",
        "deep_sleep": "you're not getting enough deep sleep for physical repair",
        "stress": "you're spending too much time in a stressed state",
    }

    top = [driver_plain.get(d["metric"], d["description"]) for d in drivers[:2]]
    cause = " and ".join(top) if top else "multiple signals are below your baseline"

    flag_names = ", ".join(f["name"] for f in flags[:3])

    return (
        f"Recovery Readiness Score: {rrs}/100 (Zone {zone}). "
        f"{days} of the last 7 days show impaired recovery. "
        f"The main issue: {cause}. "
        f"Active warning flags: {flag_names or 'none'}. "
        f"Overtraining continuum: {stage['stage']}. {stage['description']}"
    )


# Backward compatibility
def detect_drift(sleep_trends, checkins):
    checkin_by_date = {c["date"]: c for c in checkins}
    daily_data = []
    for t in sleep_trends:
        day = t["day"]
        c = checkin_by_date.get(day, {})
        daily_data.append({
            "day": day, "sleepScore": t.get("sleepScore", 0),
            "hrv": t.get("hrv", 0), "avgHeartRate": t.get("avgHeartRate", 60),
            "deepSleepMin": t.get("deepSleepPct", 0.2) * t.get("totalSleepHours", 7) * 60,
            "totalSleepHours": t.get("totalSleepHours", 7),
            "readinessScore": c.get("mood", 7) * 10,
            "stressMin": (10 - c.get("stress", 5)) * 15,
            "efficiency": t.get("efficiency", 85),
        })
    return detect_drift_real(daily_data)
