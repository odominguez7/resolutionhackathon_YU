import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.checkin.routes import router as checkin_router
from backend.drift.routes import router as drift_router
from backend.coaching.routes import router as coaching_router
from backend.actions.routes import router as actions_router
from backend.feedback.routes import router as feedback_router
from backend.oura.routes import router as oura_router
from backend.optimize.routes import router as optimize_router
from backend.calendar.routes import router as calendar_router
from backend.agent.routes import router as agent_router

app = FastAPI(title="YU RestOS", version="2.0.0")


@app.on_event("startup")
async def startup_refresh():
    """Auto-refresh Oura data and start 24h agent scheduler."""
    # Refresh Oura data
    try:
        from backend.oura.live import has_live_token
        if has_live_token():
            from backend.oura.routes import refresh_from_oura
            result = await refresh_from_oura()
            print(f"[YU Cortex] Startup refresh: {result.get('message', 'done')}")
        else:
            print("[YU Cortex] No Oura token -- using static data files")
    except Exception as e:
        print(f"[YU Cortex] Startup refresh failed: {e}")

    # Start 24h autonomous agent loop
    import asyncio
    async def _auto_loop():
        while True:
            await asyncio.sleep(86400)  # 24 hours
            try:
                from backend.agent.loop import agent_tick
                result = await agent_tick()
                print(f"[YU Cortex] Auto-tick #{result.get('tick_number', '?')} completed in {result.get('duration_ms', '?')}ms")
            except Exception as e:
                print(f"[YU Cortex] Auto-tick failed: {e}")

    asyncio.create_task(_auto_loop())
    print("[YU Cortex] 24h autonomous loop scheduled")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(checkin_router, prefix="/api/checkin", tags=["checkin"])
app.include_router(drift_router, prefix="/api/drift", tags=["drift"])
app.include_router(coaching_router, prefix="/api/coaching", tags=["coaching"])
app.include_router(actions_router, prefix="/api/actions", tags=["actions"])
app.include_router(feedback_router, prefix="/api/feedback", tags=["feedback"])
app.include_router(oura_router, prefix="/api/oura", tags=["oura"])
app.include_router(optimize_router, prefix="/api/optimize", tags=["optimize"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["calendar"])
app.include_router(agent_router, prefix="/api/agent", tags=["agent"])

DIST = Path(__file__).parent / "frontend" / "dist"


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "YU RestOS", "version": "2.0", "ai": "gemini"}


# Mount /assets for JS/CSS bundles
if (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")


# Catch-all: serve static files if they exist, otherwise index.html for SPA
@app.api_route("/{path:path}", methods=["GET", "HEAD"])
async def serve_frontend(path: str):
    # Try to serve a static file from dist
    file_path = DIST / path
    if file_path.is_file():
        # Guess content type
        suffix = file_path.suffix.lower()
        media = {
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml", ".ico": "image/x-icon",
            ".js": "application/javascript", ".css": "text/css",
            ".html": "text/html", ".json": "application/json",
            ".txt": "text/plain", ".woff2": "font/woff2", ".woff": "font/woff",
        }.get(suffix, "application/octet-stream")
        return FileResponse(str(file_path), media_type=media)

    # SPA fallback
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(str(index), media_type="text/html")
    return JSONResponse({"error": "Frontend not built"}, status_code=404)


# Root
@app.get("/")
async def root():
    index = DIST / "index.html"
    if index.exists():
        return FileResponse(str(index), media_type="text/html")
    return JSONResponse({"error": "Frontend not built"}, status_code=404)
