from fastapi import APIRouter
from .models import CheckIn
from .store import get_all_checkins, save_checkin, get_checkin

router = APIRouter()


@router.get("/history")
def get_checkin_history():
    return {"checkins": get_all_checkins()}


@router.post("/submit")
def submit_checkin(data: CheckIn):
    checkin_dict = data.model_dump()
    save_checkin(checkin_dict)
    return {"status": "saved", "date": data.date}


@router.get("/{date}")
def get_single_checkin(date: str):
    result = get_checkin(date)
    if result:
        return result
    return {"error": "No check-in found for this date"}
