from fastapi import APIRouter
from .engine import detect_drift
from eight_sleep.mock_data import MOCK_TRENDS
from checkin.store import get_all_checkins

router = APIRouter()


@router.get("/analyze")
def analyze_drift():
    return detect_drift(MOCK_TRENDS, get_all_checkins())


@router.get("/timeline")
def drift_timeline():
    analysis = detect_drift(MOCK_TRENDS, get_all_checkins())
    return {
        "drift_detected": analysis["drift_detected"],
        "signals": analysis["signals"],
        "baseline": analysis["baseline"],
    }
