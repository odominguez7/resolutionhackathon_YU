COACHING_SYSTEM_PROMPT = """You are YU RestOS, a personal sleep and recovery coach.
You analyze biometric sleep data from Oura Ring (sleep score, HRV, heart rate,
temperature, sleep stages) combined with daily self-reported wellbeing (mood,
energy, stress) to deliver actionable recovery recommendations.

Rules:
- Be direct and specific. Cite exact numbers from the data.
- Give exactly 3 prioritized recovery actions.
- Each action should be concrete and executable (not vague advice).
- Keep language warm but professional. You're a coach, not a therapist.
- Never diagnose medical conditions. Recommend professional help if patterns are severe.
- Keep response under 200 words.
"""


def build_coaching_prompt(drift_analysis: dict, latest_sleep: dict, latest_checkin: dict) -> str:
    return f"""Based on the following data, provide personalized recovery coaching:

## Sleep Data (Latest Night)
- Sleep Score: {latest_sleep['sleepScore']}/100
- HRV: {latest_sleep['hrv']}ms
- Deep Sleep: {latest_sleep['deepSleepPct']*100:.1f}%
- REM Sleep: {latest_sleep['remSleepPct']*100:.1f}%
- Toss & Turns: {latest_sleep['tnt']}
- Avg Bed Temperature: {latest_sleep['avgBedTempC']}C
- Avg Heart Rate: {latest_sleep['avgHeartRate']} bpm

## Self-Report (Latest Check-in)
- Mood: {latest_checkin['mood']}/10
- Energy: {latest_checkin['energy']}/10
- Stress: {latest_checkin['stress']}/10
- Self-rated Sleep Quality: {latest_checkin['sleep_quality_self']}/10

## Drift Analysis
- Pattern Detected: {drift_analysis['drift_detected']}
- Severity: {drift_analysis['severity']}
- Consecutive Decline Days: {drift_analysis['consecutive_days']}
- Sleep Score Drop: {drift_analysis['signals'][-1]['sleepDrop'] if drift_analysis['signals'] else 0}%
- HRV Drop: {drift_analysis['signals'][-1]['hrvDrop'] if drift_analysis['signals'] else 0}%

## Baseline (Healthy Period Average)
- Sleep Score: {drift_analysis['baseline']['sleepScore']}
- HRV: {drift_analysis['baseline']['hrv']}ms
- Mood: {drift_analysis['baseline']['mood']}/10
- Energy: {drift_analysis['baseline']['energy']}/10

Provide 3 specific, actionable recovery recommendations based on this data."""
