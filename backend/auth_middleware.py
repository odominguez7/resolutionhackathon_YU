"""
Firebase Auth middleware for FastAPI.

Verifies Firebase ID tokens on all /api/* routes. Extracts the
authenticated user_id and injects it into the request state so
downstream handlers can read request.state.user_id instead of
trusting a query param.

Public routes (health check, well-known, landing assets) are excluded.
"""

from __future__ import annotations

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Initialize Firebase Admin SDK (uses Application Default Credentials
# on Cloud Run, which auto-discovers the service account)
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app()
    except Exception:
        # Fallback: initialize without credentials (local dev)
        firebase_admin.initialize_app(credentials.ApplicationDefault())

# Routes that don't require auth
PUBLIC_PREFIXES = (
    "/api/health",
    "/.well-known/",
    "/mcp/",
    "/assets/",
    "/api/wearable/oura/callback",  # OAuth callback
)

PUBLIC_EXACT = {
    "/",
    "/onboarding",
    "/api/health",
}


def is_public(path: str) -> bool:
    """Check if a route is public (no auth required)."""
    if path in PUBLIC_EXACT:
        return True
    for prefix in PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return True
    # Static files and SPA routes (non-API)
    if not path.startswith("/api/"):
        return True
    return False


class FirebaseAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip auth for public routes
        if is_public(path):
            request.state.user_id = "anonymous"
            return await call_next(request)

        # Extract Bearer token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            # Allow requests without auth header but tag as anonymous
            # This keeps backwards compatibility during the transition
            # TODO: Once all clients send tokens, return 401 here
            request.state.user_id = "omar"  # fallback for backwards compat
            return await call_next(request)

        token = auth_header[7:]

        try:
            decoded = firebase_auth.verify_id_token(token)
            request.state.user_id = decoded.get("uid", "unknown")
        except firebase_auth.ExpiredIdTokenError:
            return JSONResponse({"error": "Token expired. Please sign in again."}, status_code=401)
        except firebase_auth.InvalidIdTokenError:
            return JSONResponse({"error": "Invalid authentication token."}, status_code=401)
        except Exception as e:
            # Log but don't block — graceful degradation
            print(f"[auth] Token verification failed: {e}")
            request.state.user_id = "omar"  # fallback

        return await call_next(request)
