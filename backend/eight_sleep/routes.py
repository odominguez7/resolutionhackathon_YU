from fastapi import APIRouter
from .mock_data import MOCK_INTERVALS, MOCK_TRENDS, MOCK_CURRENT

router = APIRouter()


@router.get("/history")
def get_sleep_history():
    return {"intervals": MOCK_INTERVALS, "count": len(MOCK_INTERVALS)}


@router.get("/trends")
def get_sleep_trends():
    return {"trends": MOCK_TRENDS}


@router.get("/current")
def get_current_night():
    return MOCK_CURRENT


@router.get("/summary")
def get_sleep_summary():
    latest = MOCK_TRENDS[-1]
    baseline_avg = sum(t["sleepScore"] for t in MOCK_TRENDS[:5]) / 5
    current = latest["sleepScore"]
    drop_pct = round(((baseline_avg - current) / baseline_avg) * 100, 1)

    return {
        "currentScore": current,
        "baselineAvg": round(baseline_avg, 1),
        "dropPercent": drop_pct,
        "currentHRV": latest["hrv"],
        "baselineHRV": round(sum(t["hrv"] for t in MOCK_TRENDS[:5]) / 5, 1),
        "trendDirection": "declining",
        "daysTracked": 14,
        "alertLevel": "high" if drop_pct > 20 else "medium" if drop_pct > 10 else "low",
    }
