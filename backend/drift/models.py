from pydantic import BaseModel
from typing import Optional


class DriftSignal(BaseModel):
    date: str
    sleepScore: int
    hrv: float
    mood: int
    energy: int
    sleepDrop: float
    hrvDrop: float
    moodDrop: float
    energyDrop: float


class DriftBaseline(BaseModel):
    sleepScore: float
    hrv: float
    mood: float
    energy: float


class DriftAnalysis(BaseModel):
    drift_detected: bool
    severity: str
    severity_score: float
    consecutive_days: int
    drift_start_date: Optional[str]
    baseline: DriftBaseline
    signals: list[DriftSignal]
    summary: str
