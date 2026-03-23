from fastapi import APIRouter
from .prompts import COACHING_SYSTEM_PROMPT, build_coaching_prompt
from .local_ai import generate_coaching_local
from .cloud_ai import generate_coaching_cloud
from drift.engine import detect_drift
from eight_sleep.mock_data import MOCK_TRENDS
from checkin.store import get_all_checkins

router = APIRouter()


@router.get("/generate")
async def generate_coaching():
    drift_analysis = detect_drift(MOCK_TRENDS, get_all_checkins())
    latest_sleep = MOCK_TRENDS[-1]
    latest_checkin = get_all_checkins()[-1]
    prompt = build_coaching_prompt(drift_analysis, latest_sleep, latest_checkin)
    result = await generate_coaching_local(COACHING_SYSTEM_PROMPT, prompt)
    result["drift_analysis"] = drift_analysis
    return result


@router.get("/xray")
async def xray_comparison():
    drift_analysis = detect_drift(MOCK_TRENDS, get_all_checkins())
    latest_sleep = MOCK_TRENDS[-1]
    latest_checkin = get_all_checkins()[-1]
    prompt = build_coaching_prompt(drift_analysis, latest_sleep, latest_checkin)

    local_result = await generate_coaching_local(COACHING_SYSTEM_PROMPT, prompt)
    cloud_result = await generate_coaching_cloud(COACHING_SYSTEM_PROMPT, prompt)

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
