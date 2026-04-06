from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from app.db.database import get_db
from app.models.schemas import SlackNotification
from app.services.slack_service import SlackService

router = APIRouter(prefix="/api/slack", tags=["slack"])


async def get_slack_service(db: aiosqlite.Connection = Depends(get_db)) -> SlackService:
    cursor = await db.execute("SELECT slack_webhook_url FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    webhook = row[0] if row and row[0] else ""
    return SlackService(webhook_url=webhook)


@router.post("/notify")
async def send_notification(
    notification: SlackNotification,
    db: aiosqlite.Connection = Depends(get_db),
    slack: SlackService = Depends(get_slack_service),
):
    if not slack.webhook_url:
        raise HTTPException(
            status_code=400,
            detail="Slack webhook URL not configured. Go to Settings to add it.",
        )

    # If linked to an issue, send enriched notification
    if notification.issue_id:
        cursor = await db.execute(
            "SELECT number, title, repo_full_name, pr_url, devin_session_url FROM issues WHERE id = ?",
            (notification.issue_id,),
        )
        row = await cursor.fetchone()
        if row:
            success = await slack.send_issue_notification(
                issue_title=row[1],
                issue_number=row[0],
                repo=row[2],
                action=notification.message,
                pr_url=row[3],
                devin_session_url=row[4],
            )
            if success:
                await db.execute(
                    "UPDATE issues SET slack_notified = 1 WHERE id = ?",
                    (notification.issue_id,),
                )
                await db.commit()
            return {"sent": success}

    # If linked to a finding, send enriched notification
    if notification.finding_id:
        cursor = await db.execute(
            "SELECT rule, severity, repo_full_name, pr_url FROM security_findings WHERE id = ?",
            (notification.finding_id,),
        )
        row = await cursor.fetchone()
        if row:
            success = await slack.send_security_notification(
                finding_rule=row[0],
                severity=row[1],
                repo=row[2],
                action=notification.message,
                pr_url=row[3],
            )
            return {"sent": success}

    # Generic notification
    success = await slack.send_webhook(
        notification.message, notification.channel
    )
    return {"sent": success}


@router.post("/test")
async def test_slack(
    slack: SlackService = Depends(get_slack_service),
):
    if not slack.webhook_url:
        raise HTTPException(
            status_code=400,
            detail="Slack webhook URL not configured",
        )

    success = await slack.validate_webhook()
    return {"success": success}
