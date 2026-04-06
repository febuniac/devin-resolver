"""Authentication router for BacklogZero admin access."""
import hashlib
import os
import secrets
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Default credential hash (sha256 digest); override via BZ_AUTH_SECRET env var
_DEFAULT_HASH = "74291ea78a37146d7e0c14f0d2a9f769a0c65a8926f520541302338a43ece1e2"
_AUTH_USER = os.environ.get("ADMIN_USER", "admin")
_AUTH_SECRET_OVERRIDE = os.environ.get("BZ_AUTH_SECRET")

# Simple token store (in-memory; resets on restart)
_active_tokens: dict[str, dict] = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str
    role: str


def _check_credential(provided: str) -> bool:
    """Compare provided value against stored hash or env-var override."""
    provided_hash = hashlib.sha256(provided.encode()).hexdigest()
    if _AUTH_SECRET_OVERRIDE:
        return provided_hash == hashlib.sha256(_AUTH_SECRET_OVERRIDE.encode()).hexdigest()
    return provided_hash == _DEFAULT_HASH


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    if req.username != _AUTH_USER or not _check_credential(req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = secrets.token_hex(32)
    _active_tokens[token] = {
        "username": _AUTH_USER,
        "role": "admin",
        "created_at": time.time(),
    }
    return LoginResponse(token=token, username=_AUTH_USER, role="admin")


@router.post("/logout")
async def logout(token: str = ""):
    _active_tokens.pop(token, None)
    return {"ok": True}


@router.get("/verify")
async def verify_token(token: str = ""):
    info = _active_tokens.get(token)
    if info:
        return {"valid": True, "username": info["username"], "role": info["role"]}
    return {"valid": False}
