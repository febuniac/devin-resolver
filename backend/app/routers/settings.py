import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from app.db.database import get_db
from app.models.schemas import SettingsResponse, SettingsUpdate
from app.services.github_service import GitHubService
from app.services.devin_service import DevinService
from app.services.slack_service import SlackService

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Settings not initialized")

    return SettingsResponse(
        github_token_set=bool(row[1]),
        devin_api_token_set=bool(row[2]),
        slack_webhook_url=row[3] or "",
        slack_channels=json.loads(row[4]) if row[4] else [],
        auto_approve_enabled=bool(row[5]),
        auto_approve_confidence=row[6] or 90,
        auto_approve_max_severity=row[7] or "medium",
        codeql_enabled=bool(row[8]),
        scan_frequency=row[9] or "daily",
        notifications=json.loads(row[10]) if row[10] else {},
    )


@router.put("")
async def update_settings(
    settings: SettingsUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    updates = []
    params = []

    if settings.github_token is not None:
        updates.append("github_token = ?")
        params.append(settings.github_token)
    if settings.devin_api_token is not None:
        updates.append("devin_api_token = ?")
        params.append(settings.devin_api_token)
    if settings.slack_webhook_url is not None:
        updates.append("slack_webhook_url = ?")
        params.append(settings.slack_webhook_url)
    if settings.slack_channels is not None:
        updates.append("slack_channels = ?")
        params.append(json.dumps(settings.slack_channels))
    if settings.auto_approve_enabled is not None:
        updates.append("auto_approve_enabled = ?")
        params.append(int(settings.auto_approve_enabled))
    if settings.auto_approve_confidence is not None:
        updates.append("auto_approve_confidence = ?")
        params.append(settings.auto_approve_confidence)
    if settings.auto_approve_max_severity is not None:
        updates.append("auto_approve_max_severity = ?")
        params.append(settings.auto_approve_max_severity)
    if settings.codeql_enabled is not None:
        updates.append("codeql_enabled = ?")
        params.append(int(settings.codeql_enabled))
    if settings.scan_frequency is not None:
        updates.append("scan_frequency = ?")
        params.append(settings.scan_frequency)
    if settings.notifications is not None:
        updates.append("notifications = ?")
        params.append(json.dumps(settings.notifications))

    if not updates:
        return {"message": "No changes"}

    query = f"UPDATE settings SET {', '.join(updates)} WHERE id = 1"
    params.append(1)  # Not used since WHERE id = 1 is hardcoded

    # Remove extra param - fix the query
    query = f"UPDATE settings SET {', '.join(updates)} WHERE id = 1"
    await db.execute(query, params[:-1])
    await db.commit()

    return {"message": "Settings updated"}


@router.post("/validate/github")
async def validate_github(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT github_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""

    if not token:
        return {"valid": False, "error": "No GitHub token configured"}

    service = GitHubService(token)
    valid = await service.validate_token()
    return {"valid": valid, "error": None if valid else "Invalid token"}


@router.post("/validate/devin")
async def validate_devin(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT devin_api_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""

    if not token:
        return {"valid": False, "error": "No Devin API token configured"}

    service = DevinService(token)
    valid = await service.validate_token()
    return {"valid": valid, "error": None if valid else "Invalid token"}


@router.post("/validate/slack")
async def validate_slack(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT slack_webhook_url FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    webhook = row[0] if row and row[0] else ""

    if not webhook:
        return {"valid": False, "error": "No Slack webhook URL configured"}

    service = SlackService(webhook_url=webhook)
    valid = await service.validate_webhook()
    return {"valid": valid, "error": None if valid else "Invalid webhook URL"}
