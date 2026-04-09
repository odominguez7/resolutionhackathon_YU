"""
Telegram notifier with a session-scoped 1-message limit (demo safety rail).
Resets on process restart.
"""

import os
from typing import Optional

import httpx

_sent_count = 0
DEMO_LIMIT = int(os.getenv("DEMO_NOTIFY_LIMIT", "1"))


def _load_env(key: str) -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    return os.getenv(key, "")


async def send_telegram(message: str) -> dict:
    global _sent_count
    token = _load_env("TELEGRAM_BOT_TOKEN")
    chat_id = _load_env("TELEGRAM_CHAT_ID")

    if _sent_count >= DEMO_LIMIT:
        return {
            "sent": False,
            "mode": "demo_cap_reached",
            "would_send": message,
            "limit": DEMO_LIMIT,
        }

    if not token or not chat_id:
        return {
            "sent": False,
            "mode": "stub",
            "would_send": message,
            "missing": [k for k, v in {"TELEGRAM_BOT_TOKEN": token, "TELEGRAM_CHAT_ID": chat_id}.items() if not v],
        }

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            from .security import assert_egress_allowed
            assert_egress_allowed(url)
            resp = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"})
            resp.raise_for_status()
        _sent_count += 1
        return {"sent": True, "mode": "telegram", "message": message, "remaining": DEMO_LIMIT - _sent_count}
    except Exception as e:
        return {"sent": False, "mode": "error", "error": str(e), "would_send": message}


def reset_notify_counter():
    global _sent_count
    _sent_count = 0
