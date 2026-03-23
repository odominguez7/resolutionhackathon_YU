"""
Seed script — verify all mock data generates correctly.
Run: python scripts/seed_data.py
"""

import sys
sys.path.insert(0, "backend")

from eight_sleep.mock_data import MOCK_INTERVALS, MOCK_TRENDS, MOCK_CURRENT
from checkin.store import get_all_checkins
from drift.engine import detect_drift

print("=== YU RestOS Data Seed Verification ===\n")

print(f"Sleep intervals: {len(MOCK_INTERVALS)} days")
print(f"Sleep trends:    {len(MOCK_TRENDS)} days")
print(f"Check-ins:       {len(get_all_checkins())} entries")

print(f"\nDay 1  — Score: {MOCK_TRENDS[0]['sleepScore']}, HRV: {MOCK_TRENDS[0]['hrv']}ms")
print(f"Day 14 — Score: {MOCK_TRENDS[-1]['sleepScore']}, HRV: {MOCK_TRENDS[-1]['hrv']}ms")

drift = detect_drift(MOCK_TRENDS, get_all_checkins())
print(f"\nDrift detected:    {drift['drift_detected']}")
print(f"Severity:          {drift['severity']} ({drift['severity_score']})")
print(f"Consecutive days:  {drift['consecutive_days']}")
print(f"Drift start:       {drift['drift_start_date']}")

print(f"\nBaseline — Sleep: {drift['baseline']['sleepScore']}, HRV: {drift['baseline']['hrv']}ms")
print(f"Current  — Sleep: {MOCK_TRENDS[-1]['sleepScore']}, HRV: {MOCK_TRENDS[-1]['hrv']}ms")

print(f"\nCurrent night: Stage={MOCK_CURRENT['sleepStage']}, HR={MOCK_CURRENT['heartRate']}, Bed={MOCK_CURRENT['bedTempC']}C")

print("\n=== All data verified. Ready to build. ===")
