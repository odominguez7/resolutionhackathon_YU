"""
Identity API routes.
"""

from fastapi import APIRouter
from .service import get_profile, create_profile, update_profile, update_equipment, list_profiles

router = APIRouter()


@router.get("/me")
def get_me(user_id: str = "omar"):
    return get_profile(user_id)


@router.post("/register")
def register(payload: dict):
    uid = (payload or {}).get("user_id", "")
    if not uid:
        return {"error": "user_id required"}
    return create_profile(uid, payload)


@router.put("/profile")
def update(payload: dict):
    uid = (payload or {}).get("user_id", "omar")
    return update_profile(uid, {k: v for k, v in (payload or {}).items() if k != "user_id"})


@router.put("/equipment")
def equip(payload: dict):
    uid = (payload or {}).get("user_id", "omar")
    equipment = (payload or {}).get("equipment", {})
    return update_equipment(uid, equipment)


@router.get("/users")
def users():
    return {"users": list_profiles()}
