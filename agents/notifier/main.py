"""
Notifier agent. The only agent allowed to talk to the outside world.
Receives a chosen action from the council and fires a Telegram message.
Has a session-scoped 1-message cap (per process) for the demo.
"""

import os
import time
from fastapi import FastAPI
from pydantic import BaseModel
import httpx
import uvicorn

PORT = int(os.environ.get("PORT", "8086"))
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
DEMO_LIMIT = int(os.environ.get("DEMO_NOTIFY_LIMIT", "100"))  # high so HW7 trials can fire

app = FastAPI(title="yu-notifier-agent")
_sent = 0


class Notification(BaseModel):
    title: str
    data_line: str
    narrative: str
    implication: str
    dry_run: bool = False


@app.get("/healthz")
def healthz():
    return {"ok": True, "agent": "notifier", "sent": _sent, "cap": DEMO_LIMIT}


@app.post("/send")
async def send(payload: Notification):
    global _sent
    t0 = time.time()
    msg = (
        f"*YU · {payload.title} agent*\n\n"
        f"{payload.data_line}\n\n"
        f"{payload.narrative}\n\n"
        f"_{payload.implication}_"
    )

    if payload.dry_run:
        return {"sent": False, "mode": "dry_run", "would_send": msg, "elapsed_ms": int((time.time() - t0) * 1000)}

    if _sent >= DEMO_LIMIT:
        return {"sent": False, "mode": "cap_reached", "would_send": msg, "elapsed_ms": int((time.time() - t0) * 1000)}

    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return {"sent": False, "mode": "stub", "would_send": msg, "missing": [k for k, v in {"TELEGRAM_BOT_TOKEN": TELEGRAM_BOT_TOKEN, "TELEGRAM_CHAT_ID": TELEGRAM_CHAT_ID}.items() if not v]}

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "Markdown"})
            resp.raise_for_status()
        _sent += 1
        return {"sent": True, "mode": "telegram", "remaining": DEMO_LIMIT - _sent, "elapsed_ms": int((time.time() - t0) * 1000)}
    except Exception as e:
        return {"sent": False, "mode": "error", "error": str(e), "elapsed_ms": int((time.time() - t0) * 1000)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
