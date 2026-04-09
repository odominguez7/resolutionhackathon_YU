"""Thin Gemini wrapper used by every agent. Returns text + token usage."""

import json
import os
import re
from typing import Optional

import httpx

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def load_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


async def call_gemini(prompt: str, temperature: float = 0.5, max_tokens: int = 400) -> dict:
    """Returns { text, prompt_tokens, completion_tokens, total_tokens, ok, error }."""
    key = load_key()
    if not key:
        return {"text": "", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "ok": False, "error": "no_key"}

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens, "thinkingConfig": {"thinkingBudget": 0}},
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {}) or {}
        return {
            "text": text,
            "prompt_tokens": usage.get("promptTokenCount", 0),
            "completion_tokens": usage.get("candidatesTokenCount", 0),
            "total_tokens": usage.get("totalTokenCount", 0),
            "ok": True,
        }
    except Exception as e:
        return {"text": "", "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "ok": False, "error": f"{type(e).__name__}:{e}"}


def parse_json_block(text: str) -> Optional[dict]:
    m = re.search(r"\{[\s\S]*\}", text or "")
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None
