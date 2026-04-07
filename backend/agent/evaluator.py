"""
Agent Evaluator — measures whether interventions actually worked.

This is the CLOSED LOOP from the MIT 100K application. After an intervention
is executed, the evaluator waits 24 hours, then compares pre-intervention
biometrics to post-intervention biometrics and scores the result.

Scoring:
  +2  = strong recovery (metrics clearly improved)
  +1  = mild recovery (some improvement)
   0  = neutral (no meaningful change)
  -1  = worsened (metrics got worse despite intervention)
"""


def evaluate_intervention(pre_metrics: dict, post_metrics: dict) -> dict:
    """Compare pre/post biometrics to score intervention effectiveness."""

    pre_hrv = pre_metrics.get("hrv", 0)
    post_hrv = post_metrics.get("hrv", 0)
    pre_sleep = pre_metrics.get("sleepScore", 0)
    post_sleep = post_metrics.get("sleepScore", 0)
    pre_readiness = pre_metrics.get("readinessScore", 0)
    post_readiness = post_metrics.get("readinessScore", 0)
    pre_rhr = pre_metrics.get("avgHeartRate", 0)
    post_rhr = post_metrics.get("avgHeartRate", 0)

    score = 0
    signals = []

    # HRV improvement (most important signal)
    if pre_hrv and post_hrv:
        hrv_delta = post_hrv - pre_hrv
        hrv_pct = (hrv_delta / pre_hrv * 100) if pre_hrv else 0
        if hrv_pct > 10:
            score += 2
            signals.append(f"HRV improved {hrv_pct:.0f}% ({pre_hrv}→{post_hrv}ms)")
        elif hrv_pct > 3:
            score += 1
            signals.append(f"HRV slightly improved ({pre_hrv}→{post_hrv}ms)")
        elif hrv_pct < -10:
            score -= 1
            signals.append(f"HRV worsened ({pre_hrv}→{post_hrv}ms)")

    # Sleep score
    if pre_sleep and post_sleep:
        sleep_delta = post_sleep - pre_sleep
        if sleep_delta > 5:
            score += 1
            signals.append(f"Sleep score improved ({pre_sleep}→{post_sleep})")
        elif sleep_delta < -5:
            score -= 1
            signals.append(f"Sleep score dropped ({pre_sleep}→{post_sleep})")

    # Readiness
    if pre_readiness and post_readiness:
        readiness_delta = post_readiness - pre_readiness
        if readiness_delta > 5:
            score += 1
            signals.append(f"Readiness improved ({pre_readiness}→{post_readiness})")
        elif readiness_delta < -5:
            score -= 1
            signals.append(f"Readiness dropped ({pre_readiness}→{post_readiness})")

    # RHR (lower is better)
    if pre_rhr and post_rhr:
        rhr_delta = pre_rhr - post_rhr
        if rhr_delta > 3:
            score += 1
            signals.append(f"RHR decreased ({pre_rhr}→{post_rhr} bpm)")
        elif rhr_delta < -3:
            score -= 1
            signals.append(f"RHR increased ({pre_rhr}→{post_rhr} bpm)")

    # Determine verdict
    if score >= 2:
        verdict = "recovering"
    elif score >= 1:
        verdict = "slightly_improving"
    elif score == 0:
        verdict = "neutral"
    else:
        verdict = "worsened"

    return {
        "score": score,
        "verdict": verdict,
        "signals": signals,
        "pre_metrics": {
            "hrv": pre_hrv,
            "sleep_score": pre_sleep,
            "readiness": pre_readiness,
            "rhr": pre_rhr,
        },
        "post_metrics": {
            "hrv": post_hrv,
            "sleep_score": post_sleep,
            "readiness": post_readiness,
            "rhr": post_rhr,
        },
    }
