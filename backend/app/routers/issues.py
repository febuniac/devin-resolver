import json
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional
import aiosqlite

from app.db.database import get_db, get_db_connection
from app.models.schemas import IssueResponse, IssueApproval, IssueRejection
from app.services.devin_service import DevinService
from app.services.slack_service import SlackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/issues", tags=["issues"])


def parse_issue_row(row) -> IssueResponse:
    return IssueResponse(
        id=row[0],
        github_id=row[1],
        number=row[2],
        title=row[3],
        body=row[4] or "",
        repo_full_name=row[5],
        labels=json.loads(row[6]) if row[6] else [],
        state=row[7] or "open",
        author=row[8] or "",
        created_at=row[9],
        updated_at=row[10],
        severity=row[11] or "medium",
        category=row[12] or "bug",
        status=row[13] or "open",
        ai_confidence=row[14] or 0,
        ai_summary=row[15] or "",
        estimated_effort=row[16] or "",
        devin_session_id=row[17],
        devin_session_url=row[18],
        pr_url=row[19],
        pr_number=row[20],
        slack_notified=bool(row[21]),
        video_url=row[22],
    )


@router.get("", response_model=list[IssueResponse])
async def list_issues(
    repo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    query = "SELECT * FROM issues WHERE 1=1"
    params: list = []

    if repo:
        query += " AND repo_full_name = ?"
        params.append(repo)
    if status:
        query += " AND status = ?"
        params.append(status)
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if category:
        query += " AND category = ?"
        params.append(category)
    if search:
        query += " AND (title LIKE ? OR body LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY created_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_issue_row(row) for row in rows]


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(issue_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found")
    return parse_issue_row(row)


async def _create_devin_sessions(issue_ids: list[int]):
    """Background task: create Devin sessions for approved issues."""
    logger.info(f"Starting Devin session creation for issues: {issue_ids}")
    db = await get_db_connection()
    try:
        # Get Devin token + org_id + slack webhook from settings
        cursor = await db.execute(
            "SELECT devin_api_token, devin_org_id, slack_webhook_url FROM settings WHERE id = 1"
        )
        settings_row = await cursor.fetchone()
        token = settings_row[0] if settings_row and settings_row[0] else ""
        org_id = settings_row[1] if settings_row and settings_row[1] else ""
        slack_webhook = settings_row[2] if settings_row and settings_row[2] else ""

        if not token:
            logger.warning("No Devin API token configured — skipping session creation")
            return

        logger.info(f"Using Devin API with org_id={org_id}, token_prefix={token[:10]}...")
        devin = DevinService(token, org_id=org_id)
        slack = SlackService(webhook_url=slack_webhook)

        for issue_id in issue_ids:
            try:
                cursor = await db.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
                issue_row = await cursor.fetchone()
                if not issue_row:
                    logger.warning(f"Issue {issue_id} not found in DB")
                    continue

                repo = issue_row[5]  # repo_full_name
                issue_title = issue_row[3]
                issue_number = issue_row[2]
                logger.info(f"Creating Devin session for issue #{issue_id} in {repo}")
                prompt = devin.build_issue_prompt(
                    {
                        "number": issue_number,
                        "title": issue_title,
                        "body": issue_row[4] or "",
                        "labels": json.loads(issue_row[6]) if issue_row[6] else [],
                    },
                    repo,
                )

                result = await devin.create_session(
                    prompt=prompt,
                    idempotency_key=f"issue-{issue_id}",
                )
                logger.info(f"Devin API response for issue #{issue_id}: {result}")

                session_id = result.get("session_id", "")
                session_url = result.get("url", f"https://app.devin.ai/sessions/{session_id}")

                await db.execute(
                    """UPDATE issues SET status = 'in_progress',
                    devin_session_id = ?, devin_session_url = ? WHERE id = ?""",
                    (session_id, session_url, issue_id),
                )

                await db.execute(
                    """INSERT OR REPLACE INTO devin_sessions
                    (session_id, session_url, issue_id, status, created_at)
                    VALUES (?, ?, ?, 'running', datetime('now'))""",
                    (session_id, session_url, issue_id),
                )

                await db.commit()
                logger.info(f"Created Devin session {session_id} for issue #{issue_id}")

                # Send Slack notification immediately when session is created
                if slack.webhook_url:
                    try:
                        await slack.send_issue_notification(
                            issue_title=issue_title,
                            issue_number=issue_number,
                            repo=repo,
                            action="Sent to Devin",
                            devin_session_url=session_url,
                        )
                        logger.info(f"Slack notification sent for issue #{issue_id} — sent to Devin")
                    except Exception as slack_err:
                        logger.error(f"Failed to send Slack notification for issue {issue_id}: {slack_err}")

            except Exception as e:
                logger.error(f"Failed to create Devin session for issue {issue_id}: {e}", exc_info=True)
                # Mark issue back to triaged so user can retry
                await db.execute(
                    "UPDATE issues SET status = 'triaged' WHERE id = ? AND status = 'approved'",
                    (issue_id,),
                )
                await db.commit()
                continue

    except Exception as e:
        logger.error(f"Background Devin session creation failed: {e}", exc_info=True)
    finally:
        await db.close()


@router.post("/approve")
async def approve_issues(
    approval: IssueApproval,
    background_tasks: BackgroundTasks,
    db: aiosqlite.Connection = Depends(get_db),
):
    approved = []
    already_in_progress = []
    for issue_id in approval.issue_ids:
        cursor = await db.execute("SELECT id, status FROM issues WHERE id = ?", (issue_id,))
        row = await cursor.fetchone()
        if not row:
            continue
        current_status = row[1]
        if current_status in ("in_progress", "pr_open", "resolved"):
            already_in_progress.append(issue_id)
            continue
        # Allow re-sending approved/triaged/open issues
        await db.execute(
            "UPDATE issues SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
            (issue_id,),
        )
        approved.append(issue_id)

    await db.commit()

    # Kick off Devin sessions in the background
    if approved:
        background_tasks.add_task(_create_devin_sessions, approved)

    return {
        "approved": approved,
        "count": len(approved),
        "already_in_progress": already_in_progress,
    }


@router.post("/reject")
async def reject_issues(
    rejection: IssueRejection,
    db: aiosqlite.Connection = Depends(get_db),
):
    rejected = []
    for issue_id in rejection.issue_ids:
        cursor = await db.execute("SELECT id FROM issues WHERE id = ?", (issue_id,))
        row = await cursor.fetchone()
        if row:
            await db.execute(
                "UPDATE issues SET status = 'open' WHERE id = ?",
                (issue_id,),
            )
            rejected.append(issue_id)

    await db.commit()
    return {"rejected": rejected, "count": len(rejected)}


@router.post("/{issue_id}/triage")
async def triage_issue(issue_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM issues WHERE id = ?", (issue_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found")

    # Basic AI triage logic - categorize based on labels and title
    title = (row[3] or "").lower()
    labels_str = row[6] or "[]"
    labels = json.loads(labels_str)
    labels_lower = [l.lower() for l in labels]

    # Determine category
    category = "bug"
    if any(k in title for k in ["feature", "add", "implement", "request"]):
        category = "feature"
    elif any(k in title for k in ["security", "vulnerability", "cve", "xss", "sql injection"]):
        category = "security"
    elif any(k in title for k in ["slow", "performance", "memory", "leak", "optimize"]):
        category = "performance"
    elif any(k in title for k in ["refactor", "cleanup", "tech debt"]):
        category = "refactor"
    elif any(k in title for k in ["doc", "readme", "documentation"]):
        category = "documentation"

    # Override with labels
    if "feature" in labels_lower or "enhancement" in labels_lower:
        category = "feature"
    elif "security" in labels_lower:
        category = "security"
    elif "performance" in labels_lower:
        category = "performance"

    # Determine severity
    severity = "medium"
    if any(k in labels_lower for k in ["p0", "critical", "urgent"]):
        severity = "critical"
    elif any(k in labels_lower for k in ["p1", "high"]):
        severity = "high"
    elif any(k in labels_lower for k in ["p3", "low", "minor"]):
        severity = "low"
    elif "crash" in title or "broken" in title or "security" in title:
        severity = "high"

    # Estimate effort
    body_len = len(row[4] or "")
    if body_len < 200:
        effort = "1-2 hours"
        confidence = 85
    elif body_len < 500:
        effort = "2-4 hours"
        confidence = 80
    else:
        effort = "4-8 hours"
        confidence = 75

    # Generate AI summary
    ai_summary = f"Issue in {row[5]}: {row[3]}. Categorized as {category} with {severity} severity. Estimated effort: {effort}."

    await db.execute(
        """UPDATE issues SET severity = ?, category = ?, status = 'triaged',
        ai_confidence = ?, ai_summary = ?, estimated_effort = ?,
        triaged_at = datetime('now') WHERE id = ?""",
        (severity, category, confidence, ai_summary, effort, issue_id),
    )
    await db.commit()

    return {
        "issue_id": issue_id,
        "severity": severity,
        "category": category,
        "confidence": confidence,
        "summary": ai_summary,
        "effort": effort,
    }


@router.post("/triage-all")
async def triage_all_issues(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM issues WHERE status = 'open'")
    rows = await cursor.fetchall()
    results = []
    for row in rows:
        # Reuse single triage logic
        cursor2 = await db.execute("SELECT * FROM issues WHERE id = ?", (row[0],))
        issue_row = await cursor2.fetchone()
        if issue_row:
            title = (issue_row[3] or "").lower()
            labels = json.loads(issue_row[6] or "[]")
            labels_lower = [l.lower() for l in labels]

            category = "bug"
            if any(k in title for k in ["feature", "add", "implement"]):
                category = "feature"
            elif any(k in title for k in ["security", "vulnerability"]):
                category = "security"
            elif any(k in title for k in ["slow", "performance", "memory"]):
                category = "performance"

            severity = "medium"
            if any(k in labels_lower for k in ["p0", "critical"]):
                severity = "critical"
            elif any(k in labels_lower for k in ["p1", "high"]):
                severity = "high"
            elif any(k in labels_lower for k in ["p3", "low"]):
                severity = "low"

            body_len = len(issue_row[4] or "")
            effort = "1-2 hours" if body_len < 200 else "2-4 hours" if body_len < 500 else "4-8 hours"
            confidence = 85 if body_len < 200 else 80 if body_len < 500 else 75

            ai_summary = f"Issue in {issue_row[5]}: {issue_row[3]}. Categorized as {category} ({severity}). Est: {effort}."

            await db.execute(
                """UPDATE issues SET severity = ?, category = ?, status = 'triaged',
                ai_confidence = ?, ai_summary = ?, estimated_effort = ?,
                triaged_at = datetime('now') WHERE id = ?""",
                (severity, category, confidence, ai_summary, effort, row[0]),
            )
            results.append({"issue_id": row[0], "severity": severity, "category": category})

    await db.commit()
    return {"triaged": len(results), "results": results}
