from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from eight_sleep.routes import router as sleep_router
from checkin.routes import router as checkin_router
from drift.routes import router as drift_router
from coaching.routes import router as coaching_router
from actions.routes import router as actions_router
from feedback.routes import router as feedback_router

app = FastAPI(title="YU RestOS", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sleep_router, prefix="/api/sleep", tags=["sleep"])
app.include_router(checkin_router, prefix="/api/checkin", tags=["checkin"])
app.include_router(drift_router, prefix="/api/drift", tags=["drift"])
app.include_router(coaching_router, prefix="/api/coaching", tags=["coaching"])
app.include_router(actions_router, prefix="/api/actions", tags=["actions"])
app.include_router(feedback_router, prefix="/api/feedback", tags=["feedback"])


@app.get("/api/health")
def health():
    return {"status": "ok", "product": "YU RestOS", "version": "2.0", "ai": "local"}
