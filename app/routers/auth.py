"""Authentication router - reads credentials from environment variables."""
import hashlib
import os
import secrets
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Read credentials from environment at startup
_AUTH_USER = os.environ.get("ADMIN_USER", "admin")
_AUTH_SECRET = os.environ.get("BZ_AUTH_SECRET")

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
    """Compare provided value against stored env var using hash comparison."""
    if _AUTH_SECRET is None:
        return False
    return hashlib.sha256(provided.encode()).hexdigest() == hashlib.sha256(_AUTH_SECRET.encode()).hexdigest()


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    if _AUTH_SECRET is None:
        raise HTTPException(status_code=500, detail="Auth not configured")
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
