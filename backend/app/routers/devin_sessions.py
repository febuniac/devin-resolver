import json
import logging
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from app.db.database import get_db
from app.models.schemas import DevinSessionCreate, DevinSessionResponse
from app.services.devin_service import DevinService
from app.services.slack_service import SlackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devin", tags=["devin"])


async def get_devin_service(db: aiosqlite.Connection = Depends(get_db)) -> DevinService:
    cursor = await db.execute("SELECT devin_api_token, devin_org_id FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    org_id = row[1] if row and row[1] else ""
    return DevinService(token, org_id=org_id)


async def get_slack_service(db: aiosqlite.Connection = Depends(get_db)) -> SlackService:
    cursor = await db.execute("SELECT slack_webhook_url FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    webhook = row[0] if row and row[0] else ""
    return SlackService(webhook_url=webhook)


def parse_session_row(row) -> DevinSessionResponse:
    return DevinSessionResponse(
        id=row[0],
        session_id=row[1],
        session_url=row[2],
        issue_id=row[3],
        finding_id=row[4],
        status=row[5] or "pending",
        created_at=row[6] or "",
        updated_at=row[7],
        pr_url=row[8],
        pr_number=row[9],
        recording_url=row[10],
    )


def parse_session_row_with_issue(row) -> DevinSessionResponse:
    return DevinSessionResponse(
        id=row[0],
        session_id=row[1],
        session_url=row[2],
        issue_id=row[3],
        finding_id=row[4],
        status=row[5] or "pending",
        created_at=row[6] or "",
        updated_at=row[7],
        pr_url=row[8],
        pr_number=row[9],
        recording_url=row[10],
        issue_title=row[11] if len(row) > 11 else None,
        issue_number=row[12] if len(row) > 12 else None,
        repo_full_name=row[13] if len(row) > 13 else None,
    )


@router.get("/sessions", response_model=list[DevinSessionResponse])
async def list_sessions(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """SELECT ds.*, i.title, i.number, i.repo_full_name
        FROM devin_sessions ds
        LEFT JOIN issues i ON ds.issue_id = i.id
        ORDER BY ds.created_at DESC"""
    )
    rows = await cursor.fetchall()
    return [parse_session_row_with_issue(row) for row in rows]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
):
    # First check local DB
    cursor = await db.execute(
        "SELECT * FROM devin_sessions WHERE session_id = ?", (session_id,)
    )
    row = await cursor.fetchone()

    # Also fetch live status from Devin API
    live_status = None
    if devin.token:
        try:
            live_status = await devin.get_session(session_id)
        except Exception:
            pass

    if not row and not live_status:
        raise HTTPException(status_code=404, detail="Session not found")

    result = {}
    if row:
        result = parse_session_row(row).model_dump()

    if live_status:
        result["live_status"] = live_status.get("status_enum", "unknown")
        result["session_url"] = live_status.get("url", result.get("session_url"))

        # Update local DB with live status
        if row:
            new_status = live_status.get("status_enum", row[5])
            await db.execute(
                "UPDATE devin_sessions SET status = ?, updated_at = datetime('now') WHERE session_id = ?",
                (new_status, session_id),
            )
            await db.commit()

    return result


@router.post("/sessions")
async def create_session(
    request: DevinSessionCreate,
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
):
    if not devin.token:
        raise HTTPException(
            status_code=400,
            detail="Devin API token not configured. Go to Settings to add it.",
        )

    # Build prompt based on issue or finding
    prompt = request.prompt or ""

    if request.issue_id:
        cursor = await db.execute("SELECT * FROM issues WHERE id = ?", (request.issue_id,))
        issue_row = await cursor.fetchone()
        if not issue_row:
            raise HTTPException(status_code=404, detail="Issue not found")

        labels = json.loads(issue_row[6] or "[]")
        issue_dict = {
            "number": issue_row[2],
            "title": issue_row[3],
            "body": issue_row[4] or "",
            "labels": labels,
        }
        prompt = devin.build_issue_prompt(issue_dict, issue_row[5])

        # Update issue status
        await db.execute(
            "UPDATE issues SET status = 'in_progress' WHERE id = ?",
            (request.issue_id,),
        )

    elif request.finding_id:
        cursor = await db.execute(
            "SELECT * FROM security_findings WHERE id = ?", (request.finding_id,)
        )
        finding_row = await cursor.fetchone()
        if not finding_row:
            raise HTTPException(status_code=404, detail="Finding not found")

        finding_dict = {
            "rule": finding_row[2],
            "severity": finding_row[4],
            "file_path": finding_row[5],
            "line_number": finding_row[6],
            "description": finding_row[7],
            "cwe_id": finding_row[10],
        }
        prompt = devin.build_security_prompt(finding_dict, finding_row[8])

        # Update finding status
        await db.execute(
            "UPDATE security_findings SET status = 'in_progress' WHERE id = ?",
            (request.finding_id,),
        )

    if not prompt:
        raise HTTPException(status_code=400, detail="No prompt provided and no issue/finding specified")

    # Create Devin session
    try:
        session_data = await devin.create_session(prompt=prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Devin session: {str(e)}")

    session_id = session_data.get("session_id", "")
    session_url = session_data.get("url", f"https://app.devin.ai/sessions/{session_id}")

    # Store in database
    cursor = await db.execute(
        """INSERT INTO devin_sessions (session_id, session_url, issue_id, finding_id, status)
        VALUES (?, ?, ?, ?, 'running')""",
        (session_id, session_url, request.issue_id, request.finding_id),
    )
    await db.commit()

    # Update issue/finding with session info
    if request.issue_id:
        await db.execute(
            "UPDATE issues SET devin_session_id = ?, devin_session_url = ? WHERE id = ?",
            (session_id, session_url, request.issue_id),
        )
    elif request.finding_id:
        await db.execute(
            "UPDATE security_findings SET devin_session_id = ?, devin_session_url = ? WHERE id = ?",
            (session_id, session_url, request.finding_id),
        )
    await db.commit()

    return {
        "session_id": session_id,
        "session_url": session_url,
        "status": "running",
        "db_id": cursor.lastrowid,
    }


@router.post("/sessions/{session_id}/refresh")
async def refresh_session(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
):
    if not devin.token:
        raise HTTPException(status_code=400, detail="Devin API token not configured")

    try:
        live_data = await devin.get_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session: {str(e)}")

    status = live_data.get("status_enum", "unknown")

    # Update local DB
    await db.execute(
        "UPDATE devin_sessions SET status = ?, updated_at = datetime('now') WHERE session_id = ?",
        (status, session_id),
    )

    # If session is finished, check for PR
    if status in ("finished", "stopped"):
        # Check if there's a structured output with PR info
        structured = live_data.get("structured_output", {})
        pr_url = structured.get("pr_url", "")
        if pr_url:
            await db.execute(
                "UPDATE devin_sessions SET pr_url = ? WHERE session_id = ?",
                (pr_url, session_id),
            )

            # Update the linked issue or finding
            cursor = await db.execute(
                "SELECT issue_id, finding_id FROM devin_sessions WHERE session_id = ?",
                (session_id,),
            )
            row = await cursor.fetchone()
            if row:
                if row[0]:
                    await db.execute(
                        "UPDATE issues SET status = 'pr_open', pr_url = ? WHERE id = ?",
                        (pr_url, row[0]),
                    )
                if row[1]:
                    await db.execute(
                        "UPDATE security_findings SET status = 'pr_open', pr_url = ? WHERE id = ?",
                        (pr_url, row[1]),
                    )

    await db.commit()
    return {"session_id": session_id, "status": status, "data": live_data}


@router.post("/sessions/poll")
async def poll_all_sessions(
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
    slack: SlackService = Depends(get_slack_service),
):
    """Poll all active Devin sessions, update statuses, send Slack notifications, and fetch recordings."""
    if not devin.token:
        return {"polled": 0, "message": "No Devin API token configured"}

    # Get all running/pending sessions
    cursor = await db.execute(
        "SELECT session_id, issue_id, finding_id, status FROM devin_sessions WHERE status IN ('running', 'pending')"
    )
    active_sessions = await cursor.fetchall()

    results = []
    for session_row in active_sessions:
        sid = session_row[0]
        issue_id = session_row[1]
        finding_id = session_row[2]
        old_status = session_row[3]

        try:
            live_data = await devin.get_session(sid)
            new_status = live_data.get("status_enum", old_status)

            # Update session status
            await db.execute(
                "UPDATE devin_sessions SET status = ?, updated_at = datetime('now') WHERE session_id = ?",
                (new_status, sid),
            )

            # Extract PR URL and recording URL from session data
            structured = live_data.get("structured_output") or {}
            pr_url = structured.get("pr_url", "")
            playback_url = live_data.get("playback_url", "")

            # Update recording URL on the session
            if playback_url:
                await db.execute(
                    "UPDATE devin_sessions SET recording_url = ? WHERE session_id = ?",
                    (playback_url, sid),
                )

            # If session finished/stopped and has a PR
            if new_status in ("finished", "stopped"):
                if pr_url:
                    await db.execute(
                        "UPDATE devin_sessions SET pr_url = ? WHERE session_id = ?",
                        (pr_url, sid),
                    )

                # Update linked issue
                if issue_id:
                    update_fields = {"status": "pr_open" if pr_url else "resolved"}
                    set_clauses = [f"status = ?"]
                    params = [update_fields["status"]]

                    if pr_url:
                        set_clauses.append("pr_url = ?")
                        params.append(pr_url)
                    if playback_url:
                        set_clauses.append("video_url = ?")
                        params.append(playback_url)

                    params.append(issue_id)
                    await db.execute(
                        f"UPDATE issues SET {', '.join(set_clauses)} WHERE id = ?",
                        params,
                    )

                    # Send Slack notification
                    if slack.webhook_url:
                        issue_cursor = await db.execute(
                            "SELECT title, number, repo_full_name, devin_session_url FROM issues WHERE id = ?",
                            (issue_id,),
                        )
                        issue_row = await issue_cursor.fetchone()
                        if issue_row:
                            session_url = issue_row[3] or f"https://app.devin.ai/sessions/{sid}"
                            action = "PR Opened" if pr_url else "Resolved"
                            await slack.send_issue_notification(
                                issue_title=issue_row[0],
                                issue_number=issue_row[1],
                                repo=issue_row[2],
                                action=action,
                                pr_url=pr_url or None,
                                devin_session_url=session_url,
                            )
                            # Mark as notified
                            await db.execute(
                                "UPDATE issues SET slack_notified = 1 WHERE id = ?",
                                (issue_id,),
                            )
                            logger.info(f"Slack notification sent for issue #{issue_id}")

                # Update linked finding
                if finding_id:
                    update_fields_f = {"status": "pr_open" if pr_url else "resolved"}
                    set_clauses_f = ["status = ?"]
                    params_f = [update_fields_f["status"]]

                    if pr_url:
                        set_clauses_f.append("pr_url = ?")
                        params_f.append(pr_url)

                    params_f.append(finding_id)
                    await db.execute(
                        f"UPDATE security_findings SET {', '.join(set_clauses_f)} WHERE id = ?",
                        params_f,
                    )

                    # Send Slack notification for security finding
                    if slack.webhook_url:
                        finding_cursor = await db.execute(
                            "SELECT rule, severity, repo_full_name FROM security_findings WHERE id = ?",
                            (finding_id,),
                        )
                        finding_row = await finding_cursor.fetchone()
                        if finding_row:
                            await slack.send_security_notification(
                                finding_rule=finding_row[0],
                                severity=finding_row[1],
                                repo=finding_row[2],
                                action="PR Opened" if pr_url else "Resolved",
                                pr_url=pr_url or None,
                            )

            results.append({
                "session_id": sid,
                "old_status": old_status,
                "new_status": new_status,
                "has_pr": bool(pr_url),
                "has_recording": bool(playback_url),
            })

        except Exception as e:
            logger.error(f"Failed to poll session {sid}: {e}")
            results.append({"session_id": sid, "error": str(e)})

    await db.commit()
    return {"polled": len(results), "results": results}
