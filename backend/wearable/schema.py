"""
BiometricSample — the normalized schema every wearable adapter produces.

v2.1 spec: "Oura, Whoop, Apple Watch, Garmin, Polar all funnel into one
unified schema. Never write vendor-specific code above the ingestion layer."

Every adapter (Oura, HealthKit, Whoop, etc.) converts raw provider data
into BiometricSample objects. Everything downstream reads these — never
the raw provider-specific dicts.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any


class Provider(str, Enum):
    OURA = "oura"
    APPLE_HK = "apple_hk"
    WHOOP = "whoop"
    GARMIN = "garmin"
    POLAR = "polar"
    MANUAL = "manual"


class SampleType(str, Enum):
    HRV_RMSSD = "hrv_rmssd"
    RHR = "rhr"
    SLEEP_SCORE = "sleep_score"
    READINESS_SCORE = "readiness_score"
    DEEP_SLEEP_MIN = "deep_sleep_min"
    TOTAL_SLEEP_MIN = "total_sleep_min"
    SLEEP_EFFICIENCY = "sleep_efficiency"
    STRESS_HIGH_MIN = "stress_high_min"
    RESPIRATORY_RATE = "respiratory_rate"
    STEPS = "steps"
    ACTIVE_CALORIES = "active_calories"
    WORKOUT_DURATION_MIN = "workout_duration_min"
    WORKOUT_CALORIES = "workout_calories"
    WORKOUT_HR_AVG = "workout_hr_avg"
    BODY_TEMPERATURE_DELTA = "body_temperature_delta"


@dataclass
class BiometricSample:
    """One normalized data point from any wearable provider."""
    user_id: str
    provider: Provider
    sample_type: SampleType
    value: float
    unit: str
    recorded_at: datetime          # wearable's timestamp
    ingested_at: datetime = field(default_factory=datetime.utcnow)
    confidence: float = 1.0        # adapter-reported data quality 0-1
    day: str = ""                  # YYYY-MM-DD for daily aggregates
    raw_ref: str = ""              # pointer to raw payload for replay
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["provider"] = self.provider.value
        d["sample_type"] = self.sample_type.value
        d["recorded_at"] = self.recorded_at.isoformat()
        d["ingested_at"] = self.ingested_at.isoformat()
        return d


class BaseAdapter:
    """Abstract base for wearable adapters. Each provider implements this."""
    provider: Provider = Provider.MANUAL

    def normalize(self, raw_data: dict, user_id: str = "omar") -> list[BiometricSample]:
        """Convert provider-specific raw data into BiometricSample list."""
        raise NotImplementedError

    def fetch(self, user_id: str = "omar") -> list[BiometricSample]:
        """Fetch latest data from the provider API and normalize it."""
        raise NotImplementedError
