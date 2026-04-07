"""
AI Workout Generator — uses real Oura biometrics to program the optimal session.
Gemini 2.5 Pro generates workouts adapted to current recovery state.
"""

import os
import json
from datetime import datetime
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    env_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        ".env"
    )
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    GEMINI_API_KEY = line.split("=", 1)[1].strip()


WORKOUT_PROMPT = """You are an elite CrossFit and functional fitness programmer. You design one workout at a time, adapted to real biometric data from an Oura Ring.

ATHLETE CONTEXT:
- Startup founder, high daily cognitive stress, no alcohol
- Trains 1 session per day, ~60 minutes (adjust based on recovery state)
- Equipment ONLY: Pair of dumbbells (35/40/45/50 lb), treadmill, strict pull-up bar. NO box, NO bench, NO barbell, NO rings, NO ropes, NO kettlebells.
- Goals: strength, great physical shape, lean body composition, low body fat
- MENTAL TOUGHNESS IS A CORE GOAL. Every workout should have a moment where the athlete wants to quit and has to push through. This builds the same discipline that runs a startup. Include a "dark place" segment — the part of the workout designed to break you mentally so you come out stronger.
- Even on easy days, include one small challenge that tests willpower (a 2-min plank hold, a final sprint, an extra round). The body may need rest but the mind always needs to grow.
- On push days, go all out. Program workouts that are genuinely hard — not "hard for beginners." This athlete can handle pain.
- On low-recovery days, the mental challenge shifts: discipline to hold back, do less, trust the process. That's its own form of mental strength.

EQUIPMENT CONSTRAINT: ONLY use movements possible with dumbbells, treadmill, pull-up bar, and bodyweight. NO box jumps, NO step-ups, NO bench press, NO HSPU, NO toes-to-bar, NO pistol squats, NO kettlebell moves, NO rope climbs. If a movement requires equipment not listed, DO NOT include it.

MOVEMENT CATALOG (ONLY use these):
Squat: DB front squat, goblet squat, air squat, tempo squat, jump squat, sumo squat, DB overhead squat, DB back squat, zercher DB squat
Lunge (BODYWEIGHT ONLY): forward lunge, reverse lunge, walking lunge, lateral lunge, curtsy lunge, split squat, jump lunge
Hinge: DB deadlift, DB Romanian deadlift, single-leg DB RDL, staggered-stance DB deadlift, glute bridge, hip thrust
Horizontal Push: push-up, hand-release push-up, diamond push-up, decline push-up, archer push-up, plyometric push-up, DB floor press, alternating DB floor press
Vertical Push: DB strict press, DB push press, DB push jerk, Arnold press, Z-press, DB lateral raise
Pull (bar): strict pull-up, strict chin-up, tempo pull-up, chest-to-bar pull-up, weighted pull-up, hanging knee raise, hanging leg raise, L-hang
Pull (DB): DB bent-over row, single-arm DB row, renegade row, DB reverse fly, DB seal row
Olympic: DB power clean, DB hang power clean, DB squat clean, single-arm DB power snatch, alternating DB snatch, man maker, devil press, cluster
Core: V-up, tuck-up, hollow hold, hollow rock, dead bug, Russian twist, DB weighted sit-up, plank hold, side plank, butterfly sit-up, DB side bend
Cardio: treadmill run, burpees, burpee to pull-up, lateral burpee over DB, burpee broad jump, treadmill incline sprint
Carry: DB farmer carry, single-arm farmer carry, front rack carry, overhead carry
Plyo: tuck jump, squat jump, broad jump, skater jump

FORMAT OPTIONS (choose based on recovery state):
- AMRAP (high readiness): long grinders, 20-30 min, high volume
- For Time (good readiness): sprint workouts, 12-20 min, race pace
- EMOM (moderate readiness): skill + conditioning, controlled effort
- Intervals (low readiness): work/rest ratios, managed intensity
- Strength + Metcon (high readiness): heavy DB work then a burner
- Active Recovery (very low readiness): Zone 2 treadmill + mobility, lower heart rate

INTENSITY RULES:
- Readiness > 80 AND HRV above baseline → PUSH DAY. Go hard. Long AMRAPs, heavy loads, sprints.
- Readiness 65-80 → WORK DAY. Solid session, moderate-high intensity, good volume.
- Readiness 50-65 → EASY DAY. Lower intensity, more rest, focus on movement quality.
- Readiness < 50 → RECOVERY DAY. Zone 2 only, mobility, no heavy loading.

RESPONSE FORMAT (return valid JSON only, no markdown):
{
  "session_type": "crossfit",
  "title": "Short punchy name for the workout",
  "format": "AMRAP / For Time / EMOM / Intervals / Strength + Metcon / Active Recovery",
  "duration_min": 45-70,
  "intensity": "push / work / easy / recovery",
  "warmup": {
    "duration_min": 8-12,
    "movements": ["movement 1 - reps/duration", "movement 2", ...]
  },
  "workout": {
    "description": "The main workout written exactly as a coach would write it on a whiteboard. Example: '5 Rounds For Time: 400m Run, 15 DB Devil Press (2x50lb), 12 Toes-to-Bar, 9 DB Hang Power Clean (2x50lb). Time cap: 25 min.'",
    "movements": ["Full movement name with EXACT reps and weights. Example: '15 DB Devil Press (2x50lb)', '400m Treadmill Run', '12 Toes-to-Bar'. ALWAYS include reps, weight, distance. Never just the movement name alone."],
    "rounds": "number of rounds if applicable",
    "time_cap": "time cap if applicable",
    "notes": "Pacing strategy, scaling options, what to focus on"
  },
  "cooldown": {
    "duration_min": 5-8,
    "movements": ["stretch/mobility 1", "stretch/mobility 2", ...]
  },
  "why_this_workout": "2-3 sentences explaining why this specific workout was chosen based on the biometric data. Reference actual numbers. Explain like you're talking to a friend.",
  "mental_challenge": "1-2 sentences describing the moment in this workout where you'll want to quit. Name it. Tell the athlete what it will feel like and why pushing through matters.",
  "target_zones": {
    "zone2_min": estimated minutes in Zone 2,
    "zone3_min": estimated minutes in Zone 3,
    "zone4_min": estimated minutes in Zone 4
  },
  "estimated_calories": estimated total burn
}"""


YOGA_PROMPT = """The athlete chose a hot flow yoga session today. Based on their biometric data, provide brief pre and post session guidance.

CONTEXT: Hot flow yoga sessions are guided (they don't control the flow). Typical session: ~60 min, ~400 kcal burn, ~25 min Zone 2, ~10 min Zone 3, ~25 min Zone 1/low Zone 2. Low impact, mostly stretch and flow.

RESPONSE FORMAT (return valid JSON only, no markdown):
{
  "session_type": "yoga",
  "title": "Hot Flow Yoga",
  "pre_session": "1-2 sentences of advice before the session based on their current state",
  "post_session": "1-2 sentences of what to do after based on their recovery needs",
  "hydration_note": "Quick hydration tip based on their data",
  "why_good_choice": "2-3 sentences on why yoga is a smart choice today given their biometrics. Reference actual numbers.",
  "estimated_calories": 400,
  "duration_min": 60
}"""


REST_PROMPT = """The athlete needs a rest and recovery day. Based on their biometric data, design a set of micro-interventions that will actively accelerate their recovery.

This is NOT a lazy day. This is a strategic recovery protocol. The athlete is a startup founder who thinks rest = weakness. Reframe rest as a performance investment.

RESPONSE FORMAT (return valid JSON only, no markdown):
{
  "session_type": "rest",
  "title": "Short name for the recovery day theme",
  "why_rest": "2-3 sentences explaining WHY rest is the right call today based on their specific numbers. Be direct. Reference their actual HRV, readiness, sleep. Explain what happens physiologically if they train hard right now.",
  "micro_interventions": [
    {
      "category": "Nervous System Reset / Mobility / Breathwork / Cold/Heat / Nutrition / Sleep Prep",
      "title": "Name of the intervention",
      "duration": "how long (e.g., 10 min)",
      "description": "What to do, explained simply",
      "science": "One sentence: why this works at the physiological level",
      "color": "#hex color for the category"
    }
  ],
  "walk": "Optional: describe a specific walk protocol if beneficial (Zone 1 only, duration, when). Null if not needed.",
  "sleep_protocol": "What to do tonight specifically to maximize recovery based on their data. Be specific about timing, temperature, and habits.",
  "estimated_calories": estimated total burn for the day's activities
}

MICRO-INTERVENTION OPTIONS (pick 3-5 based on what their data needs most):
- Box breathing 4-4-4-4 (vagal tone activation, drops HR 5-10 bpm in 5 min)
- Cold shower 2 min (norepinephrine spike → alertness without cortisol)
- 15 min Zone 1 walk (lymphatic circulation, doesn't spike cortisol)
- Hip/ankle mobility flow (maintains range of motion, prevents stiffness)
- Foam rolling (myofascial release, increases blood flow to damaged tissue)
- 20 min nap before 2 PM (adenosine clearance without disrupting night sleep)
- Magnesium + tart cherry before bed (melatonin precursor + anti-inflammatory)
- 10 min sun exposure before 10 AM (circadian anchor, cortisol rhythm reset)
- Legs up the wall 10 min (venous return, parasympathetic activation)
- Journaling / brain dump 5 min (cognitive offloading reduces pre-sleep rumination)

Choose based on what their specific data shows they need. If HRV is crashed, prioritize vagal tone. If sleep is short, prioritize sleep protocol. If stress is high, prioritize nervous system reset."""


async def generate_workout(session_type: str, biometrics: dict) -> dict:
    """Generate a workout using Gemini 2.5 Pro based on real Oura data."""
    if not GEMINI_API_KEY:
        return {"error": "No GEMINI_API_KEY configured"}

    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)
    now = datetime.now(BOSTON_TZ)

    bio_context = f"""CURRENT BIOMETRIC STATE ({now.strftime('%A, %B %d at %I:%M %p ET')}):

Today's data:
- Sleep Score: {biometrics.get('sleep_score', 'N/A')}
- Readiness: {biometrics.get('readiness', 'N/A')}
- HRV: {biometrics.get('hrv', 'N/A')} ms (30-day baseline: {biometrics.get('hrv_baseline', 'N/A')} ms)
- Resting Heart Rate: {biometrics.get('rhr', 'N/A')} bpm (baseline: {biometrics.get('rhr_baseline', 'N/A')} bpm)
- Stress today: {biometrics.get('stress_min', 'N/A')} minutes of high stress
- Deep sleep last night: {biometrics.get('deep_min', 'N/A')} min
- Total sleep: {biometrics.get('total_sleep_hrs', 'N/A')} hrs

Last 3 days trend:
{json.dumps(biometrics.get('last_3_days', []), indent=2)}

Recovery context: {biometrics.get('recovery_context', '')}
"""

    if session_type == "yoga":
        prompt = YOGA_PROMPT + "\n\n" + bio_context
    elif session_type == "rest":
        prompt = REST_PROMPT + "\n\n" + bio_context
    else:
        prompt = WORKOUT_PROMPT + "\n\n" + bio_context + "\nGenerate today's workout. Return JSON only."

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )

        text = response.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        if text.startswith("json"):
            text = text[4:]

        workout = json.loads(text.strip())
        workout["generated_at"] = now.isoformat()
        workout["biometrics_used"] = {
            "readiness": biometrics.get("readiness"),
            "hrv": biometrics.get("hrv"),
            "sleep_score": biometrics.get("sleep_score"),
        }
        return workout

    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse workout JSON: {str(e)}", "raw": text[:500]}
    except Exception as e:
        return {"error": f"Gemini API error: {str(e)}"}
