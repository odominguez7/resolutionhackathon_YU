from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class ActionType(str, Enum):
    CALENDAR = "calendar"
    WELLNESS = "wellness"
    SHOPPING = "shopping"
    SOCIAL = "social"


class ActionStatus(str, Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExecutionMethod(str, Enum):
    API_CALL = "api_call"
    CONCIERGE = "concierge"
    PRODUCT_LINK = "product_link"
    IN_APP = "in_app"


class Action(BaseModel):
    id: str
    title: str
    description: str
    action_type: ActionType
    execution_method: ExecutionMethod
    priority: int
    estimated_impact: str
    impact_reason: str
    sponsor: Optional[str] = None
    parameters: dict = {}
    status: ActionStatus = ActionStatus.PENDING
    executed_at: Optional[datetime] = None
    result: Optional[dict] = None


class RecoveryPlan(BaseModel):
    id: str
    generated_at: datetime
    drift_severity: str
    actions: list[Action]
    estimated_recovery_days: int
    ai_rationale: str
    total_actions: int
    accepted_actions: int = 0
    executed_actions: int = 0


class ActionExecutionResult(BaseModel):
    action_id: str
    status: ActionStatus
    executed_at: datetime
    result_message: str
    api_response: Optional[dict] = None
    task_id: Optional[str] = None
    product_url: Optional[str] = None
