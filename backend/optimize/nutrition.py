"""
Nutrition timing engine — meals, hydration, caffeine, fasting windows.
All algorithmic. No API needed.
"""


def _add_hours(time_str: str, hours: float) -> str:
    """Add hours to HH:MM string."""
    h, m = map(int, time_str.split(":"))
    total_min = h * 60 + m + int(hours * 60)
    return f"{(total_min // 60) % 24:02d}:{total_min % 60:02d}"


def _sub_hours(time_str: str, hours: float) -> str:
    return _add_hours(time_str, -hours)


def compute_nutrition_timeline(
    wake_time: str,
    workout_time: str,
    workout_end: str,
    caffeine_cutoff: str,
    bedtime: str,
    wind_down: str,
    stress_min: int = 60,
) -> list[dict]:
    """Generate nutrition/hydration timeline items."""

    items = []

    # 1. Morning water — on wake
    items.append({
        "time": wake_time,
        "type": "hydration",
        "title": "Morning Water",
        "description": "16oz water + electrolytes. Rehydrate after 8h without water.",
        "icon": "droplet",
        "color": "cyan",
        "action": None,
    })

    # 2. Pre-workout fuel — 60min before workout
    pre_workout = _sub_hours(workout_time, 1.0)
    items.append({
        "time": pre_workout,
        "type": "pre_workout",
        "title": "Pre-Workout Fuel",
        "description": "Light carbs + protein. Banana + whey shake or oats + egg whites.",
        "icon": "utensils",
        "color": "green",
        "action": None,
    })

    # 3. Workout hydration — during workout
    items.append({
        "time": workout_time,
        "type": "hydration",
        "title": "Workout Hydration",
        "description": "16-24oz water during session. Add electrolytes if >30min.",
        "icon": "droplet",
        "color": "cyan",
        "action": None,
    })

    # 4. Post-workout recovery meal — 30min after workout
    post_workout = _add_hours(workout_end, 0.5)
    items.append({
        "time": post_workout,
        "type": "post_workout",
        "title": "Recovery Meal",
        "description": "30-60min post-workout window. 30g protein + carbs. Chicken + rice or shake + fruit.",
        "icon": "utensils",
        "color": "green",
        "action": None,
    })

    # 5. Mid-morning hydration
    mid_morning = _add_hours(wake_time, 3.0)
    items.append({
        "time": mid_morning,
        "type": "hydration",
        "title": "Hydration Check",
        "description": "12-16oz water. Stay ahead of dehydration.",
        "icon": "droplet",
        "color": "cyan",
        "action": None,
    })

    # 6. Lunch
    items.append({
        "time": "12:30",
        "type": "meal",
        "title": "Lunch",
        "description": "Balanced plate: lean protein + complex carbs + vegetables. Avoid heavy fats that cause afternoon crash.",
        "icon": "utensils",
        "color": "green",
        "action": None,
    })

    # 7. Caffeine cutoff (from engine.py)
    items.append({
        "time": caffeine_cutoff,
        "type": "caffeine_cutoff",
        "title": "Last Call for Caffeine ☕",
        "description": "No more coffee, tea, or energy drinks after this. Caffeine half-life is 5-6 hours.",
        "icon": "coffee",
        "color": "amber",
        "action": None,
    })

    # 8. Afternoon hydration
    items.append({
        "time": "15:00",
        "type": "hydration",
        "title": "Afternoon Water",
        "description": "12-16oz water. Dehydration tanks focus and energy.",
        "icon": "droplet",
        "color": "cyan",
        "action": None,
    })

    # 9. Last meal — 3h before bedtime
    last_meal = _sub_hours(bedtime, 3.0)
    items.append({
        "time": last_meal,
        "type": "last_meal",
        "title": "Last Meal",
        "description": "3h before bed. Lean protein + complex carbs. Salmon + sweet potato. Avoid sugar and heavy fats.",
        "icon": "utensils",
        "color": "green",
        "action": None,
    })

    # 10. Screen cutoff — 60min before wind-down
    screen_off = _sub_hours(wind_down, 1.0)
    items.append({
        "time": screen_off,
        "type": "screen_cutoff",
        "title": "Screens Off",
        "description": "Blue light blocks melatonin. Switch to paper, audio, or conversation.",
        "icon": "monitor-off",
        "color": "red",
        "action": None,
    })

    # Sort by time
    items.sort(key=lambda x: x["time"])

    return items
