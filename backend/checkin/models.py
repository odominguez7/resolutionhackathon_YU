from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CheckIn(BaseModel):
    date: str
    mood: int = Field(ge=1, le=10)
    energy: int = Field(ge=1, le=10)
    stress: int = Field(ge=1, le=10)
    sleep_quality_self: int = Field(ge=1, le=10)
    notes: str = ""
    timestamp: Optional[datetime] = None


class CheckInResponse(BaseModel):
    date: str
    mood: int
    energy: int
    stress: int
    sleep_quality_self: int
    notes: str
