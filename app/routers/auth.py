"""Authentication router - reads credentials from environment or /data/auth.json."""
import hashlib
import json
import os
import secrets
import time
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _load_auth_secret() -> str | None:
    """Load auth secret from env var or /data/auth.json fallback."""
    val = os.environ.get("BZ_AUTH_SECRET")
    if val:
        return val
    auth_file = Path("/data/auth.json")
    if auth_file.exists():
        try:
            data = json.loads(auth_file.read_text())
            return data.get("secret")
        except Exception:
            pass
    return None


# Read credentials at startup
_AUTH_USER = os.environ.get("ADMIN_USER", "admin")
_AUTH_SECRET = _load_auth_secret()

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


class SetupRequest(BaseModel):
    secret: str


@router.post("/setup")
async def setup_auth(req: SetupRequest):
    """One-time setup: write auth secret to /data/auth.json. Only works if not already configured."""
    global _AUTH_SECRET
    if _AUTH_SECRET is not None:
        raise HTTPException(status_code=409, detail="Auth already configured")
    auth_file = Path("/data/auth.json")
    auth_file.parent.mkdir(parents=True, exist_ok=True)
    auth_file.write_text(json.dumps({"secret": req.secret}))
    _AUTH_SECRET = req.secret
    return {"ok": True, "message": "Auth configured"}
