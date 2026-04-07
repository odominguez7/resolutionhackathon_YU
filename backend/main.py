from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "YU RestOS", "version": "2.0", "ai": "local"}
