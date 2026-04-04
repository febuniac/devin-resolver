from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import aiosqlite

from app.db.database import init_db, get_db
from app.routers import repos, issues, security, devin_sessions, settings, analytics, slack, github_pr
from app.services.devin_service import DevinService


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="DevinResolver API", lifespan=lifespan)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(repos.router)
app.include_router(issues.router)
app.include_router(security.router)
app.include_router(devin_sessions.router)
app.include_router(settings.router)
app.include_router(analytics.router)
app.include_router(slack.router)
app.include_router(github_pr.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/status")
async def get_status(db: aiosqlite.Connection = Depends(get_db)):
    # Real repo count
    cursor = await db.execute("SELECT COUNT(*) FROM connected_repos")
    repo_count = (await cursor.fetchone())[0]

    # Real Devin connection status
    devin_connected = False
    cursor = await db.execute("SELECT devin_api_token, devin_org_id FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    org_id = row[1] if row and row[1] else ""
    if token:
        service = DevinService(token, org_id=org_id)
        valid, _ = await service.validate_token()
        devin_connected = valid

    # Issue counts
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status IN ('open','triaged','approved')")
    issues_count = (await cursor.fetchone())[0]

    # Security findings count
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM security_findings WHERE status IN ('open','triaged')")
        security_count = (await cursor.fetchone())[0]
    except Exception:
        security_count = 0

    # Review work count (in_progress or pr_open)
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status IN ('in_progress','pr_open')")
    review_count = (await cursor.fetchone())[0]

    return {
        "repos_connected": repo_count,
        "devin_connected": devin_connected,
        "issues_count": issues_count,
        "security_count": security_count,
        "review_count": review_count,
    }
