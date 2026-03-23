import httpx
import time
import os


async def generate_coaching_cloud(system_prompt: str, user_prompt: str) -> dict:
    """Generate coaching via cloud API for X-Ray Mode comparison."""
    start = time.time()
    api_key = os.getenv("ANTHROPIC_API_KEY", "")

    if not api_key:
        return {
            "source": "cloud",
            "model": "claude-sonnet-4-20250514",
            "response": "[Cloud response would appear here with an API key. "
                        "In production, your biometric data, mood scores, and sleep patterns "
                        "would be sent to external servers for processing. "
                        "With YU RestOS local AI, none of this data ever leaves your device.]",
            "latency_ms": 1200,
            "data_location": "External cloud servers",
            "privacy": "Data transmitted to third-party API",
        }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "content-type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 500,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
                timeout=30,
            )
            data = response.json()
            elapsed = time.time() - start
            return {
                "source": "cloud",
                "model": "claude-sonnet-4-20250514",
                "response": data["content"][0]["text"],
                "latency_ms": round(elapsed * 1000),
                "data_location": "External cloud servers",
                "privacy": "Data transmitted to third-party API",
            }
    except Exception as e:
        return {
            "source": "cloud",
            "model": "claude-sonnet-4-20250514",
            "response": f"[Cloud AI error: {str(e)}]",
            "latency_ms": 0,
            "data_location": "External cloud servers",
            "privacy": "Data transmitted to third-party API",
        }
