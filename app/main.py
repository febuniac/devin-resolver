from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import aiosqlite

from app.db.database import init_db, get_db
from app.routers import repos, issues, security, devin_sessions, settings, analytics, slack, github_pr, dashboard, wiki, audit_report
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
app.include_router(dashboard.router)
app.include_router(wiki.router)
app.include_router(audit_report.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/status")
async def get_status(db: aiosqlite.Connection = Depends(get_db)):
    # Real repo count
    cursor = await db.execute("SELECT COUNT(*) FROM connected_repos")
    repo_count = (await cursor.fetchone())[0]

    # Devin connection status — just check if token exists (fast, no network call)
    cursor = await db.execute("SELECT devin_api_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    devin_connected = bool(row and row[0])

    # Issue Triage badge — only triaged issues needing attention (excludes security)
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE category != 'security' AND status = 'triaged'")
    issues_count = (await cursor.fetchone())[0]

    # Security badge — only triaged security issues needing attention
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE category = 'security' AND status = 'triaged'")
    security_count = (await cursor.fetchone())[0]

    # Review work count — active sessions + queued issues waiting for a slot
    cursor = await db.execute("SELECT COUNT(*) FROM devin_sessions WHERE status IN ('running','pending','suspended')")
    session_count = (await cursor.fetchone())[0]
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status IN ('queued', 'approved')")
    queued_count = (await cursor.fetchone())[0]
    review_count = session_count + queued_count

    return {
        "repos_connected": repo_count,
        "devin_connected": devin_connected,
        "issues_count": issues_count,
        "security_count": security_count,
        "review_count": review_count,
    }
