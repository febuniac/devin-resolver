from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import init_db
from app.routers import repos, issues, security, devin_sessions, settings, analytics, slack


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


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
