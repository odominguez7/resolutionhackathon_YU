"""
Oura adapter — converts raw Oura API data into BiometricSample objects.

This is adapter #1. It wraps the existing backend/oura/live.py data
and normalizes it into the unified schema. Downstream consumers should
read BiometricSample, never _sleep_by_day or _readiness_by_day directly.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from .schema import BaseAdapter, BiometricSample, Provider, SampleType

BOSTON_TZ = ZoneInfo("America/New_York")


class OuraAdapter(BaseAdapter):
    provider = Provider.OURA

    def normalize(self, raw_data: dict, user_id: str = "omar") -> list[BiometricSample]:
        """Convert the existing Oura in-memory caches into BiometricSamples.
        raw_data expects: {sleep_by_day, score_by_day, readiness_by_day, stress_by_day}."""
        samples: list[BiometricSample] = []
        now = datetime.now(BOSTON_TZ)

        sleep_by_day = raw_data.get("sleep_by_day", {})
        score_by_day = raw_data.get("score_by_day", {})
        readiness_by_day = raw_data.get("readiness_by_day", {})
        stress_by_day = raw_data.get("stress_by_day", {})

        for day, session in sleep_by_day.items():
            ts = datetime.fromisoformat(f"{day}T06:00:00-04:00")

            hrv = session.get("average_hrv")
            if hrv is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.HRV_RMSSD,
                    value=float(hrv), unit="ms",
                    recorded_at=ts, ingested_at=now, day=day,
                    confidence=0.95,
                ))

            rhr = session.get("average_heart_rate")
            if rhr is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.RHR,
                    value=round(float(rhr), 1), unit="bpm",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

            deep = session.get("deep_sleep_duration")
            if deep is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.DEEP_SLEEP_MIN,
                    value=round(deep / 60, 1), unit="min",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

            total = session.get("total_sleep_duration")
            if total is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.TOTAL_SLEEP_MIN,
                    value=round(total / 60, 1), unit="min",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

            resp_rate = session.get("average_breath")
            if resp_rate is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.RESPIRATORY_RATE,
                    value=round(float(resp_rate), 1), unit="br/min",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

            eff = session.get("efficiency")
            if eff is not None:
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.SLEEP_EFFICIENCY,
                    value=float(eff), unit="%",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

        for day, score in score_by_day.items():
            if isinstance(score, (int, float)):
                ts = datetime.fromisoformat(f"{day}T06:00:00-04:00")
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.SLEEP_SCORE,
                    value=float(score), unit="0-100",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

        for day, data in readiness_by_day.items():
            score = data.get("score") if isinstance(data, dict) else None
            if score is not None:
                ts = datetime.fromisoformat(f"{day}T06:00:00-04:00")
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.READINESS_SCORE,
                    value=float(score), unit="0-100",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

        for day, data in stress_by_day.items():
            stress_high = (data.get("stress_high") or 0) if isinstance(data, dict) else 0
            if stress_high:
                ts = datetime.fromisoformat(f"{day}T06:00:00-04:00")
                samples.append(BiometricSample(
                    user_id=user_id, provider=self.provider,
                    sample_type=SampleType.STRESS_HIGH_MIN,
                    value=round(stress_high / 60, 1), unit="min",
                    recorded_at=ts, ingested_at=now, day=day,
                ))

        return samples

    def fetch(self, user_id: str = "omar") -> list[BiometricSample]:
        """Fetch from the existing in-memory Oura caches."""
        from backend.oura.routes import _sleep_by_day, _score_by_day, _readiness_by_day, _stress_by_day
        return self.normalize({
            "sleep_by_day": _sleep_by_day,
            "score_by_day": _score_by_day,
            "readiness_by_day": _readiness_by_day,
            "stress_by_day": _stress_by_day,
        }, user_id)
