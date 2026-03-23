import time

MODEL = "granite3.3:8b"


async def generate_coaching_local(system_prompt: str, user_prompt: str) -> dict:
    """Generate coaching via local Granite 3.3 through Ollama."""
    start = time.time()
    try:
        import ollama
        response = ollama.chat(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        )
        elapsed = time.time() - start
        return {
            "source": "local",
            "model": MODEL,
            "response": response["message"]["content"],
            "latency_ms": round(elapsed * 1000),
            "data_location": "on-device",
            "privacy": "No data sent to external servers",
        }
    except Exception as e:
        return {
            "source": "local",
            "model": MODEL,
            "response": f"[Local AI unavailable: {str(e)}. Ensure Granite 3.3 is running via Ollama.]",
            "latency_ms": 0,
            "data_location": "on-device",
            "privacy": "No data sent to external servers",
        }
