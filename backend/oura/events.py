"""
Event bus — Pub/Sub integration for workout events (v2.1 step 5-7).

First event-driven behavior in the system. When feedback is logged,
a workout.completed (or session.skipped) message is published to Pub/Sub.
Subscribers (behavioral agent, analytics, etc.) consume asynchronously.
"""

from __future__ import annotations

import json
import os

PROJECT = "resolution-hack"
TOPIC = "workout-completed"


def _get_publisher():
    try:
        from google.cloud import pubsub_v1
        return pubsub_v1.PublisherClient()
    except Exception:
        return None


def publish_workout_event(event_type: str, payload: dict) -> bool:
    """Publish a workout event to Pub/Sub.
    event_type: 'workout.completed' | 'session.skipped' | 'session.partial'
    """
    publisher = _get_publisher()
    if not publisher:
        return False

    topic_path = publisher.topic_path(PROJECT, TOPIC)
    message = {
        "event_type": event_type,
        "payload": payload,
    }
    try:
        future = publisher.publish(
            topic_path,
            json.dumps(message, default=str).encode("utf-8"),
            event_type=event_type,
        )
        future.result(timeout=5)
        return True
    except Exception as e:
        print(f"[events] Pub/Sub publish failed: {e}")
        return False
