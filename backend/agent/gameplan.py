"""
YU Game Plan generator.

Turns the user's biometric baseline + recent signals into the 3-card morning
game plan from the YU brief: cognitive (amber), physical (teal), sleep (indigo).

Each card = claim + numeric evidence + concrete action.
"""

import json
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from .tools import execute_get_biometrics, execute_detect_drift

BOSTON_TZ = ZoneInfo("America/New_York")

LANES = [
    {
        "lane": "cognitive",
        "color": "amber",
        "hex": "#F59E0B",
        "icon": "bolt",
        "focus": "When the user's brain is sharpest today, and how to protect that window.",
    },
    {
        "lane": "physical",
        "color": "teal",
        "hex": "#00BFA6",
        "icon": "target",
        "focus": "Whether the body is in a window for hard training, or needs to back off.",
    },
    {
        "lane": "sleep",
        "color": "indigo",
        "hex": "#6366F1",
        "icon": "moon",
        "focus": "One concrete sleep behavior to test tonight, based on the user's own pattern.",
    },
]


def _load_gemini_key() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip()
    return os.getenv("GEMINI_API_KEY", "")


def _fallback_card(lane: dict, bio: dict, drift: dict) -> dict:
    latest = bio.get("latest", {}) or {}
    avgs = bio.get("averages", {}) or {}
    if lane["lane"] == "cognitive":
        hrv = latest.get("hrv") or avgs.get("hrv") or 0
        return {
            "lane": "cognitive",
            "color": "amber",
            "hex": "#F59E0B",
            "title": "Protect your morning hours",
            "evidence": f"Your HRV is {round(hrv)}ms today. Book the hard call before noon.",
        }
    if lane["lane"] == "physical":
        readiness = latest.get("readinessScore") or avgs.get("readiness") or 0
        if readiness >= 75:
            return {
                "lane": "physical",
                "color": "teal",
                "hex": "#00BFA6",
                "title": "Your body is ready. Go",
                "evidence": f"Readiness {round(readiness)}. This is your window.",
            }
        return {
            "lane": "physical",
            "color": "teal",
            "hex": "#00BFA6",
            "title": "Hold the volume today",
            "evidence": f"Readiness {round(readiness)} is below your line. Easy aerobic only.",
        }
    deep = latest.get("deepSleepMin") or 0
    return {
        "lane": "sleep",
        "color": "indigo",
        "hex": "#6366F1",
        "title": "Cut screens by 9:30pm tonight",
        "evidence": f"Last 14 nights show {round(deep)} min deep sleep on average. Test the change.",
    }


async def generate_gameplan() -> dict:
    bio = execute_get_biometrics({"days": 14})
    drift = execute_detect_drift({})
    latest = bio.get("latest", {}) or {}
    avgs = bio.get("averages", {}) or {}

    context = f"""USER BIOMETRICS (last 14 days, from their own wearable):
- Today: HRV {latest.get('hrv', '?')}ms, Sleep score {latest.get('sleepScore', '?')}, Readiness {latest.get('readinessScore', '?')}, RHR {latest.get('avgHeartRate', '?')} bpm, Deep sleep {latest.get('deepSleepMin', '?')} min
- 14-day averages: {json.dumps(avgs)}
- Baseline (their own): {json.dumps(drift.get('baseline', {}))}
- Drift drivers: {[d['metric'] for d in drift.get('drivers', [])]}
"""

    system = """You are YU. You write a daily game plan, not a generic score.
Output exactly THREE cards as JSON, in this order: cognitive, physical, sleep.
Each card MUST have:
- "title": one short sentence, no period at the end, no em dashes, plain human language, no clinical jargon
- "evidence": one sentence with a SPECIFIC NUMBER from the user's own data (HRV, readiness, sleep score, deep sleep min, RHR) and ONE concrete action they can take today
Tone rules:
- Built from the user's own baseline, never population averages
- No "drift", no "intervention", no "z-score", no medical language
- Speak directly to the user, like a coach who knows them
Return ONLY valid JSON of the form:
{"cards":[{"lane":"cognitive","title":"...","evidence":"..."},{"lane":"physical","title":"...","evidence":"..."},{"lane":"sleep","title":"...","evidence":"..."}]}"""

    key = _load_gemini_key()
    cards = None
    source = "fallback"

    if key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": f"{system}\n\n{context}"}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": 600, "thinkingConfig": {"thinkingBudget": 0}},
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                from .security import assert_egress_allowed
                assert_egress_allowed(url)
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                parsed = json.loads(match.group(0))
                raw_cards = parsed.get("cards", [])
                merged = []
                for lane in LANES:
                    found = next((c for c in raw_cards if c.get("lane") == lane["lane"]), None)
                    if found and found.get("title") and found.get("evidence"):
                        merged.append({
                            "lane": lane["lane"],
                            "color": lane["color"],
                            "hex": lane["hex"],
                            "title": found["title"].rstrip(". ").replace("—", ","),
                            "evidence": found["evidence"].replace("—", ","),
                        })
                    else:
                        merged.append(_fallback_card(lane, bio, drift))
                cards = merged
                source = "gemini"
        except Exception as e:
            cards = None
            source = f"fallback_error:{type(e).__name__}"

    if cards is None:
        cards = [_fallback_card(lane, bio, drift) for lane in LANES]

    today = datetime.now(BOSTON_TZ).strftime("%A, %B %-d")
    return {
        "date": today,
        "based_on": "your last 14 days",
        "cards": cards,
        "source": source,
        "footer": "Built from your baseline. Not population averages.",
    }


def generate_share_summary(audience: str = "self") -> dict:
    """Composes a clinical-quality shareable summary for MD / coach / therapist / self."""
    bio = execute_get_biometrics({"days": 14})
    drift = execute_detect_drift({})
    latest = bio.get("latest", {}) or {}
    avgs = bio.get("averages", {}) or {}
    baseline = drift.get("baseline", {})

    audience = audience if audience in ("md", "coach", "therapist", "self") else "self"
    intro = {
        "md": "Clinical-quality 14-day biometric summary for medical review.",
        "coach": "14-day training-readiness summary for your coach.",
        "therapist": "14-day behavioral and sleep summary for your therapist.",
        "self": "Your personal 14-day summary.",
    }[audience]

    lines = [
        f"# YU Summary — {datetime.now(BOSTON_TZ).strftime('%Y-%m-%d')}",
        "",
        intro,
        "",
        "## Latest day",
        f"- HRV: {latest.get('hrv', '?')} ms",
        f"- Sleep score: {latest.get('sleepScore', '?')}",
        f"- Readiness: {latest.get('readinessScore', '?')}",
        f"- Resting HR: {latest.get('avgHeartRate', '?')} bpm",
        f"- Deep sleep: {latest.get('deepSleepMin', '?')} min",
        "",
        "## 14-day averages",
        f"- HRV: {avgs.get('hrv', '?')} ms",
        f"- Sleep score: {avgs.get('sleep_score', '?')}",
        f"- Readiness: {avgs.get('readiness', '?')}",
        f"- RHR: {avgs.get('rhr', '?')} bpm",
        "",
        "## Personal baseline (not population average)",
    ]
    for k, v in baseline.items():
        lines.append(f"- {k}: {v}")

    if drift.get("drift_detected"):
        lines += [
            "",
            "## Signals worth attention",
            f"- {drift.get('consecutive_days', 0)} consecutive days off baseline",
        ]
        for d in drift.get("drivers", []):
            lines.append(f"- {d.get('metric')}: z-score {d.get('z_score', 0):.2f}")

    lines += ["", "_Source: YU. Built from your baseline._"]
    return {"audience": audience, "markdown": "\n".join(lines)}
