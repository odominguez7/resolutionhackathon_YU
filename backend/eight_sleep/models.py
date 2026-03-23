from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SleepStage(BaseModel):
    stage: str          # "awake", "light", "deep", "rem", "out"
    duration: int       # seconds


class TimeseriesPoint(BaseModel):
    timestamp: datetime
    value: float


class SleepFitnessSubScore(BaseModel):
    score: int


class SleepFitnessScore(BaseModel):
    total: int
    sleepDurationSeconds: SleepFitnessSubScore
    latencyAsleepSeconds: SleepFitnessSubScore
    latencyOutSeconds: SleepFitnessSubScore
    wakeupConsistency: SleepFitnessSubScore


class SleepInterval(BaseModel):
    ts: datetime
    score: int
    incomplete: bool
    stages: list[SleepStage]
    heartRate: list[list]
    respiratoryRate: list[list]
    tempBedC: list[list]
    tempRoomC: list[list]
    tnt: int
    hrv: float


class SleepTrend(BaseModel):
    day: str
    sleepFitnessScore: SleepFitnessScore
    sleepScore: int
    hrv: float
    avgHeartRate: float
    avgRespRate: float
    avgBedTempC: float
    avgRoomTempC: float
    tnt: int
    deepSleepPct: float
    remSleepPct: float
    lightSleepPct: float
    awakePct: float
    totalSleepSeconds: int


class CurrentNight(BaseModel):
    sleepStage: str
    heartRate: float
    respiratoryRate: float
    bedTempC: float
    roomTempC: float
    heatingLevel: int
    bedPresence: bool
    sessionProcessing: bool
