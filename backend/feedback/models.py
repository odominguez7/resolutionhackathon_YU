from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class RecoveryFeedback(BaseModel):
    plan_id: str
    date: str
    overall_rating: int = Field(ge=1, le=5)
    sleep_improved: bool
    energy_improved: bool
    stress_reduced: bool
    most_helpful_action: Optional[str] = None
    least_helpful_action: Optional[str] = None
    notes: str = ""
    timestamp: Optional[datetime] = None


class EffectivenessReport(BaseModel):
    plan_id: str
    feedback_submitted: bool
    sleep_score_change: float
    hrv_change: float
    mood_change: float
    energy_change: float
    actions_executed: int
    actions_effective: int
    recovery_verdict: str
