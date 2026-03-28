"""
Recovery recommendations engine — breathwork, meditation, social breaks, screen cutoff.
"""


def compute_recovery_items(
    readiness: int,
    stress_min: int,
    hrv: float,
    baseline_hrv: float,
    wind_down_time: str,
    events: list,
    energy_curve: list,
) -> list[dict]:
    """Generate recovery recommendations based on biometrics + calendar context."""

    items = []

    # 1. Breathwork — at energy dip, scaled by stress
    dip_hours = [p for p in energy_curve if p["zone"] == "dip" and 8 <= p["hour"] <= 20]
    if dip_hours:
        dip_hour = dip_hours[0]["hour"]
        breathwork_time = f"{dip_hour:02d}:30"
    else:
        breathwork_time = "14:30"

    if stress_min > 90:
        items.append({
            "time": breathwork_time,
            "type": "breathwork",
            "title": "Box Breathing (5 min)",
            "description": f"Stress is high ({stress_min}min today). Box breathing: 4 sec in, 4 hold, 4 out, 4 hold. Resets cortisol.",
            "icon": "wind",
            "color": "purple",
            "action": None,
        })
        # Add a second session in the evening
        items.append({
            "time": _sub_30(wind_down_time),
            "type": "breathwork",
            "title": "Evening Breathwork",
            "description": "Second session before wind-down. 5 rounds of 4-7-8 breathing.",
            "icon": "wind",
            "color": "purple",
            "action": None,
        })
    elif stress_min > 40:
        items.append({
            "time": breathwork_time,
            "type": "breathwork",
            "title": "5-Min Breathwork",
            "description": "Quick cortisol reset. Box breathing: 4-4-4-4 pattern. Pairs with your energy dip.",
            "icon": "wind",
            "color": "purple",
            "action": None,
        })

    # 2. Active recovery walk — if readiness < 70
    if readiness < 70:
        items.append({
            "time": "15:00",
            "type": "recovery_walk",
            "title": "20-Min Recovery Walk",
            "description": f"Readiness {readiness}. Light movement clears stress hormones without taxing recovery.",
            "icon": "footprints",
            "color": "green",
            "action": None,
        })

    # 3. Meditation — transition from work to evening
    items.append({
        "time": "18:00",
        "type": "meditation",
        "title": "Transition Meditation (10 min)",
        "description": "Mark the shift from work to personal time. Guided or silent. Reduces evening rumination.",
        "icon": "brain",
        "color": "purple",
        "action": None,
    })

    # 4. Social recovery — if calendar is all solo
    solo_hours = 0
    for event in events:
        attendees = event.get("attendees", 0)
        if attendees <= 1:
            start_h = int(event.get("start", "00:00").split(":")[0])
            end_h = int(event.get("end", "00:00").split(":")[0])
            solo_hours += max(0, end_h - start_h)

    if solo_hours >= 6 or len(events) == 0:
        items.append({
            "time": "17:00",
            "type": "social",
            "title": "Social Break",
            "description": "You've been solo all day. Call a friend, grab coffee with someone, or just talk to a human.",
            "icon": "users",
            "color": "green",
            "action": None,
        })

    # 5. HRV recovery — if significantly below baseline
    if hrv < baseline_hrv * 0.8:
        items.append({
            "time": "19:00",
            "type": "hrv_recovery",
            "title": "HRV Recovery Session",
            "description": f"HRV {round(hrv)}ms is {round((1 - hrv/baseline_hrv)*100)}% below your baseline. 15min legs-up-wall + nasal breathing.",
            "icon": "heart",
            "color": "red",
            "action": None,
        })

    items.sort(key=lambda x: x["time"])
    return items


def _sub_30(time_str: str) -> str:
    """Subtract 30 minutes from HH:MM."""
    h, m = map(int, time_str.split(":"))
    total = h * 60 + m - 30
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"
