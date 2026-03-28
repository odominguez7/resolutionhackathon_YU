"""
Energy curve engine — maps Oura biometrics to hourly energy levels.
Calendar audit, focus block finder.
"""
import math


def compute_energy_curve(
    wake_hour: float,
    readiness: int,
    hrv: float,
    baseline_hrv: float,
    sleep_hours: float,
    stress_min: int,
) -> list[dict]:
    """Generate 24 hourly energy data points based on circadian rhythm + Oura data."""

    readiness_factor = readiness / 100
    hrv_factor = min(hrv / baseline_hrv, 1.2) if baseline_hrv > 0 else 0.8
    sleep_factor = min(sleep_hours / 7.0, 1.0)
    stress_penalty = max(0, (stress_min - 60) / 300)  # 0-0.2 penalty

    # Peak is primarily readiness-driven, with HRV and sleep as modifiers
    # readiness 83 should still produce a strong peak (~85+)
    peak_energy = min(readiness_factor * 105 * sleep_factor - stress_penalty * 10, 95)
    # HRV modulates +-10% around the readiness-driven peak
    hrv_mod = (hrv_factor - 1.0) * 15  # e.g., 0.89 → -1.65, 1.1 → +1.5
    peak_energy = max(60, min(95, peak_energy + hrv_mod))

    curve = []
    for hour in range(5, 25):  # 5am to midnight+1
        h = hour % 24
        hours_awake = hour - wake_hour

        if hours_awake < 0:
            energy = 10
            zone, emoji, label = "sleep", "😴", "Sleeping"
        elif hours_awake < 0.5:
            energy = 20 + 15 * (hours_awake / 0.5) * readiness_factor
            zone, emoji, label = "waking", "🌅", "Waking up"
        elif hours_awake < 1.5:
            progress = (hours_awake - 0.5) / 1.0
            energy = 35 + 35 * progress * readiness_factor
            zone, emoji, label = "waking", "🌅", "Ramping up"
        elif hours_awake < 2.5:
            progress = (hours_awake - 1.5) / 1.0
            energy = 70 * readiness_factor + (peak_energy - 70 * readiness_factor) * progress
            zone, emoji, label = "productive", "⚡", "Getting sharp"
        elif hours_awake < 5:
            energy = peak_energy
            zone, emoji, label = "peak", "🔥", "Peak performance"
        elif 13 <= hour <= 14:
            dip_base = peak_energy * 0.7  # 70% of peak
            dip_pos = (hour - 13) / 1.0
            energy = dip_base - 5 * math.sin(dip_pos * math.pi)
            if sleep_hours < 6:
                energy -= 10
            zone, emoji, label = "dip", "🔋", "Post-lunch dip"
        elif 14 < hour <= 15:
            energy = peak_energy * 0.72 + (hour - 14) * 5
            zone, emoji, label = "dip", "🔋", "Energy dip"
        elif 15 < hour < 17:
            base = peak_energy * 0.78
            energy = base + 3 * (hour - 15)
            zone, emoji, label = "productive", "⚡", "Afternoon push"
        elif 17 <= hour < 20:
            decline = (hour - 17) / 3.0
            energy = peak_energy * 0.75 * (1 - decline * 0.55)
            zone, emoji, label = "low", "🌆", "Winding down"
        elif 20 <= hour < 22:
            energy = 30 - (hour - 20) * 8
            zone, emoji, label = "recovery", "🌙", "Recovery mode"
        else:
            energy = max(8, 15 - (hour - 22) * 5)
            zone, emoji, label = "sleep", "😴", "Time for bed"

        energy = max(5, min(95, round(energy)))

        curve.append({
            "hour": h,
            "hour_label": f"{h:02d}:00",
            "energy": energy,
            "zone": zone,
            "emoji": emoji,
            "label": label,
        })

    return curve


def get_energy_at_hour(curve: list, hour: int) -> dict:
    for point in curve:
        if point["hour"] == hour:
            return point
    return {"energy": 50, "zone": "productive", "emoji": "⚡"}


def find_peak_windows(curve: list) -> list[dict]:
    """Find contiguous windows where energy >= 80."""
    windows = []
    start = None
    for point in curve:
        if point["energy"] >= 78:
            if start is None:
                start = point["hour"]
        else:
            if start is not None:
                end_h = point["hour"]
                pts = [p for p in curve if start <= p["hour"] < end_h]
                windows.append({
                    "start": f"{start:02d}:00",
                    "end": f"{end_h:02d}:00",
                    "avg_energy": round(sum(p["energy"] for p in pts) / max(1, len(pts))),
                    "label": "Peak Performance Window",
                })
                start = None
    return windows


def find_dip_windows(curve: list) -> list[dict]:
    """Find windows where energy dips during working hours (10am-8pm only)."""
    windows = []
    start = None
    for point in curve:
        if 10 <= point["hour"] <= 20 and point["zone"] == "dip":
            if start is None:
                start = point["hour"]
        else:
            if start is not None:
                windows.append({
                    "start": f"{start:02d}:00",
                    "end": f"{point['hour']:02d}:00",
                    "label": "Energy Dip",
                })
                start = None
    return windows


def audit_calendar(events: list, curve: list) -> list[dict]:
    """Overlay calendar events on energy curve, flag mismatches."""
    GENERIC_TITLES = {"sync", "check-in", "check in", "1:1", "standup", "stand-up",
                      "catch up", "catchup", "weekly", "update", "status"}

    audited = []
    for i, event in enumerate(events):
        start_hour = int(event.get("start", "12:00").split(":")[0])
        energy = get_energy_at_hour(curve, start_hour)
        is_generic = any(g in event.get("summary", "").lower() for g in GENERIC_TITLES)
        attendees = event.get("attendees", 0)

        flag = None
        suggestion = None

        if energy["zone"] == "peak" and is_generic:
            flag = "optimize"
            suggestion = f"'{event.get('summary')}' is during your peak. Make it async or move to afternoon."

        if energy["zone"] == "dip" and attendees >= 3:
            flag = "reschedule"
            suggestion = f"Low energy hour with {attendees} people. Move to morning when you're sharper."

        if i > 0:
            prev_end = events[i - 1].get("end", "00:00")
            curr_start = event.get("start", "00:00")
            if prev_end >= curr_start and flag is None:
                flag = "optimize"
                suggestion = "Back-to-back with previous meeting. Add a 10-min buffer."

        audited.append({
            **event,
            "energy_zone": energy["zone"],
            "energy_level": energy["energy"],
            "energy_emoji": energy["emoji"],
            "flag": flag,
            "suggestion": suggestion,
        })

    return audited


def find_focus_blocks(events: list, curve: list, min_duration_min: int = 60) -> list[dict]:
    """Find gaps in calendar during high-energy times for deep work."""
    occupied = []
    for event in events:
        try:
            sh, sm = map(int, event.get("start", "00:00").split(":"))
            eh, em = map(int, event.get("end", "00:00").split(":"))
            occupied.append((sh * 60 + sm, eh * 60 + em))
        except (ValueError, TypeError):
            continue

    occupied.sort()

    blocks = []
    # Scan from 8am to 6pm
    scan_start = 8 * 60

    boundaries = occupied + [(18 * 60, 18 * 60)]  # sentinel at 6pm

    for occ_start, occ_end in boundaries:
        gap_start = scan_start
        gap_end = min(occ_start, 18 * 60)

        if gap_end > gap_start and (gap_end - gap_start) >= min_duration_min:
            gap_start_h = gap_start // 60
            gap_end_h = min(gap_end // 60 + 1, 18)
            energy_points = [p for p in curve if gap_start_h <= p["hour"] < gap_end_h]
            if energy_points:
                avg_energy = round(sum(p["energy"] for p in energy_points) / len(energy_points))
                if avg_energy >= 60:
                    blocks.append({
                        "start": f"{gap_start // 60:02d}:{gap_start % 60:02d}",
                        "end": f"{gap_end // 60:02d}:{gap_end % 60:02d}",
                        "duration_min": gap_end - gap_start,
                        "energy_avg": avg_energy,
                        "label": "Peak Focus Window" if avg_energy >= 78 else "Focus Time",
                        "action": {
                            "tool_id": "block_calendar",
                            "event_title": "Deep Work (YU RestOS)",
                            "start_time": f"{gap_start // 60:02d}:{gap_start % 60:02d}",
                            "end_time": f"{gap_end // 60:02d}:{gap_end % 60:02d}",
                        },
                    })
        scan_start = max(scan_start, occ_end)

    blocks.sort(key=lambda x: -x["energy_avg"])
    return blocks[:3]
