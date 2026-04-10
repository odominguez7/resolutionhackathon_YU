"""
Apple HealthKit adapter — converts HealthKit export data into BiometricSamples.

This is adapter #2, proving the pattern works with a second provider.
HealthKit data typically comes via:
1. User exports health data as XML/JSON from the Health app
2. A companion iOS app posts samples to our API
3. A third-party integration (e.g. Terra, Vital) forwards webhooks

For now, this adapter accepts a normalized JSON payload matching the
shape a companion app or integration would send. The important thing
is that the output is identical BiometricSample objects — downstream
code never knows which provider produced the data.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from .schema import BaseAdapter, BiometricSample, Provider, SampleType

BOSTON_TZ = ZoneInfo("America/New_York")

# HealthKit type identifiers → our SampleType
HK_TYPE_MAP = {
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": SampleType.HRV_RMSSD,
    "HKQuantityTypeIdentifierRestingHeartRate": SampleType.RHR,
    "HKCategoryTypeIdentifierSleepAnalysis": SampleType.TOTAL_SLEEP_MIN,
    "HKQuantityTypeIdentifierRespiratoryRate": SampleType.RESPIRATORY_RATE,
    "HKQuantityTypeIdentifierStepCount": SampleType.STEPS,
    "HKQuantityTypeIdentifierActiveEnergyBurned": SampleType.ACTIVE_CALORIES,
    "HKQuantityTypeIdentifierBodyTemperature": SampleType.BODY_TEMPERATURE_DELTA,
}

# Unit conversions
HK_UNIT_MAP = {
    SampleType.HRV_RMSSD: ("ms", 1.0),
    SampleType.RHR: ("bpm", 1.0),
    SampleType.TOTAL_SLEEP_MIN: ("min", 1.0),
    SampleType.RESPIRATORY_RATE: ("br/min", 1.0),
    SampleType.STEPS: ("count", 1.0),
    SampleType.ACTIVE_CALORIES: ("kcal", 1.0),
    SampleType.BODY_TEMPERATURE_DELTA: ("C", 1.0),
}


class AppleHealthKitAdapter(BaseAdapter):
    provider = Provider.APPLE_HK

    def normalize(self, raw_data: dict, user_id: str = "omar") -> list[BiometricSample]:
        """Convert a HealthKit payload into BiometricSamples.
        Expected shape: {"samples": [{"type": "HK...", "value": float, "date": "YYYY-MM-DD", "start": "ISO", "end": "ISO"}]}"""
        samples: list[BiometricSample] = []
        now = datetime.now(BOSTON_TZ)

        for entry in (raw_data.get("samples") or []):
            hk_type = entry.get("type", "")
            sample_type = HK_TYPE_MAP.get(hk_type)
            if not sample_type:
                continue

            value = entry.get("value")
            if value is None:
                continue

            unit, factor = HK_UNIT_MAP.get(sample_type, ("", 1.0))
            day = entry.get("date") or entry.get("start", "")[:10]

            try:
                ts = datetime.fromisoformat(entry.get("start") or f"{day}T06:00:00-04:00")
            except Exception:
                ts = now

            samples.append(BiometricSample(
                user_id=user_id,
                provider=self.provider,
                sample_type=sample_type,
                value=round(float(value) * factor, 2),
                unit=unit,
                recorded_at=ts,
                ingested_at=now,
                day=day,
                confidence=0.9,
                raw_ref=entry.get("id", ""),
            ))

        return samples

    def fetch(self, user_id: str = "omar") -> list[BiometricSample]:
        """HealthKit doesn't have a server-side polling API — data comes
        from the companion app via POST /api/wearable/ingest. This method
        is a no-op; the ingest endpoint calls normalize() directly."""
        return []
