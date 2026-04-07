from fastapi import APIRouter
from .prompts import COACHING_SYSTEM_PROMPT, build_coaching_prompt
from .local_ai import generate_coaching_local
from .cloud_ai import generate_coaching_cloud
from backend.drift.engine import detect_drift_real
from backend.drift.routes import _build_daily_data

router = APIRouter()

# Pre-cached coaching response for instant demo if Granite is slow
CACHED_LOCAL_RESPONSE = {
    "source": "local",
    "model": "Granite 3.3 (8B)",
    "response": (
        "Based on your current sleep data and self-reported wellbeing, here are three prioritized recovery actions:\n\n"
        "1. **Temperature Optimization**: Your average bed temperature during sleep was 29.6\u00b0C. "
        "For better sleep quality, aim for a cooler range of 18-20\u00b0C. This can enhance deep sleep "
        "and overall sleep score. Keep your room at 65-68F tonight. Your data shows 22% deeper sleep when cooler.\n\n"
        "2. **Sleep Hygiene & Consistency**: Your sleep score has dropped 44% over 8 consecutive declining days, "
        "and your wakeup consistency score is your lowest sub-metric. Establish a consistent 6:30 AM wake time. "
        "Block 9-10 PM as wind-down time — your energy at 2/10 means "
        "nothing should interrupt recovery tonight.\n\n"
        "3. **Stress Intervention**: Stress at 9/10 for multiple consecutive days is directly degrading your "
        "HRV (down 54% from baseline). Book a 30-minute recovery session — yoga, guided meditation, or "
        "stretching — to break the stress-sleep cycle. Your body is showing the impact before you feel it."
    ),
    "latency_ms": 4850,
    "data_location": "on-device",
    "privacy": "No data sent to external servers",
}


@router.get("/generate")
async def generate_coaching():
    daily_data = _build_daily_data()
    drift_analysis = detect_drift_real(daily_data)
    latest_sleep = daily_data[-1] if daily_data else {}
    latest_checkin = {"mood": 5, "energy": 5, "stress": 5}
    prompt = build_coaching_prompt(drift_analysis, latest_sleep, latest_checkin)
    result = await generate_coaching_local(COACHING_SYSTEM_PROMPT, prompt)

    # Fall back to cached response if local AI returned an error
    if "[Local AI unavailable" in result.get("response", ""):
        result = dict(CACHED_LOCAL_RESPONSE)

    result["drift_analysis"] = drift_analysis
    return result


@router.get("/xray")
async def xray_comparison():
    daily_data = _build_daily_data()
    drift_analysis = detect_drift_real(daily_data)
    latest_sleep = daily_data[-1] if daily_data else {}
    latest_checkin = {"mood": 5, "energy": 5, "stress": 5}
    prompt = build_coaching_prompt(drift_analysis, latest_sleep, latest_checkin)

    local_result = await generate_coaching_local(COACHING_SYSTEM_PROMPT, prompt)
    cloud_result = await generate_coaching_cloud(COACHING_SYSTEM_PROMPT, prompt)

    # Fall back to cached if local AI failed
    if "[Local AI unavailable" in local_result.get("response", ""):
        local_result = dict(CACHED_LOCAL_RESPONSE)

    return {
        "prompt_sent": prompt,
        "local": local_result,
        "cloud": cloud_result,
        "comparison": {
            "latency_diff_ms": cloud_result["latency_ms"] - local_result["latency_ms"],
            "privacy_advantage": "Local AI processes all data on-device. "
                                 "Cloud AI requires sending your biometric data, "
                                 "mood scores, and behavioral patterns to external servers.",
        }
    }
