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
    cursor = await db.execute(
        """SELECT github_token, devin_api_token, devin_org_id, slack_webhook_url,
        slack_channels, auto_approve_enabled, auto_approve_confidence,
        auto_approve_max_severity, codeql_enabled, scan_frequency, notifications,
        github_pat
        FROM settings WHERE id = 1"""
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="Settings not initialized")

    return SettingsResponse(
        github_token_set=bool(row[0]),
        github_pat_set=bool(row[11]) if len(row) > 11 else False,
        devin_api_token_set=bool(row[1]),
        devin_org_id=row[2] or "",
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
    if settings.github_pat is not None:
        updates.append("github_pat = ?")
        params.append(settings.github_pat)
    if settings.devin_api_token is not None:
        updates.append("devin_api_token = ?")
        params.append(settings.devin_api_token)
    if settings.devin_org_id is not None:
        updates.append("devin_org_id = ?")
        params.append(settings.devin_org_id)
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
    cursor = await db.execute("SELECT devin_api_token, devin_org_id FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    org_id = row[1] if row and row[1] else ""

    if not token:
        return {"valid": False, "error": "No Devin API token configured"}

    service = DevinService(token, org_id=org_id)
    valid, detail = await service.validate_token()
    return {"valid": valid, "error": None if valid else detail}


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


@router.post("/reset-demo-data")
async def reset_demo_data(db: aiosqlite.Connection = Depends(get_db)):
    """Clear all demo data (issues, sessions, repos, wiki, security) but keep settings."""
    await db.execute("DELETE FROM session_events")
    await db.execute("DELETE FROM devin_sessions")
    await db.execute("DELETE FROM security_findings")
    await db.execute("DELETE FROM wiki_pages")
    await db.execute("DELETE FROM issues")
    await db.execute("DELETE FROM connected_repos")
    await db.commit()
    return {"message": "Demo data reset successfully", "tables_cleared": ["session_events", "devin_sessions", "security_findings", "wiki_pages", "issues", "connected_repos"]}


@router.post("/notifications/daily-summary")
async def send_daily_summary(db: aiosqlite.Connection = Depends(get_db)):
    """Manually trigger the daily summary Slack notification."""
    # Get settings
    cursor = await db.execute("SELECT slack_webhook_url, notifications FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    webhook = row[0] if row and row[0] else ""
    notif_prefs = json.loads(row[1]) if row and row[1] else {}

    if not webhook:
        return {"sent": False, "error": "No Slack webhook URL configured"}

    # Gather stats
    # Issues triaged today
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE triaged_at >= date('now', 'start of day')"
    )
    issues_triaged = (await cursor.fetchone())[0]

    # Total open
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status IN ('open', 'triaged')")
    total_open = (await cursor.fetchone())[0]

    # Sent to Devin (approved/in_progress today)
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE approved_at >= date('now', 'start of day')"
    )
    sent_to_devin = (await cursor.fetchone())[0]

    # PRs created
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status = 'pr_open'")
    prs_created = (await cursor.fetchone())[0]

    # PRs merged
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status = 'resolved'")
    prs_merged = (await cursor.fetchone())[0]

    # Needs attention (waiting for user)
    cursor = await db.execute(
        "SELECT COUNT(*) FROM devin_sessions WHERE status_detail = 'waiting_for_user' AND status = 'running'"
    )
    needs_attention = (await cursor.fetchone())[0]

    # Active repos
    cursor = await db.execute(
        "SELECT DISTINCT repo_full_name FROM issues WHERE status IN ('open', 'triaged', 'in_progress', 'pr_open') LIMIT 5"
    )
    top_repos = [r[0] for r in await cursor.fetchall()]

    slack = SlackService(webhook_url=webhook)
    sent = await slack.notify_daily_summary(
        issues_triaged=issues_triaged,
        total_open=total_open,
        sent_to_devin=sent_to_devin,
        prs_created=prs_created,
        prs_merged=prs_merged,
        needs_attention=needs_attention,
        top_repos=top_repos,
    )

    return {"sent": sent, "stats": {
        "issues_triaged": issues_triaged,
        "total_open": total_open,
        "sent_to_devin": sent_to_devin,
        "prs_created": prs_created,
        "prs_merged": prs_merged,
        "needs_attention": needs_attention,
    }}
