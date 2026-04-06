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
    # Use dict-like access to handle column order differences between new/migrated DBs
    if hasattr(row, 'keys'):
        d = dict(row)
        return DevinSessionResponse(
            id=d.get("id", 0),
            session_id=d.get("session_id"),
            session_url=d.get("session_url"),
            issue_id=d.get("issue_id"),
            finding_id=d.get("finding_id"),
            status=d.get("status") or "pending",
            status_detail=d.get("status_detail") or "",
            created_at=d.get("created_at") or "",
            updated_at=d.get("updated_at"),
            pr_url=d.get("pr_url"),
            pr_number=d.get("pr_number"),
            recording_url=d.get("recording_url"),
        )
    # Fallback for plain tuples (original column order without status_detail)
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
        recording_url=row[10] if len(row) > 10 else None,
    )


def parse_session_row_with_issue(row) -> DevinSessionResponse:
    # Use dict-like access to handle column order differences between new/migrated DBs
    if hasattr(row, 'keys'):
        d = dict(row)
        return DevinSessionResponse(
            id=d.get("id", 0),
            session_id=d.get("session_id"),
            session_url=d.get("session_url"),
            issue_id=d.get("issue_id"),
            finding_id=d.get("finding_id"),
            status=d.get("status") or "pending",
            status_detail=d.get("status_detail") or "",
            created_at=d.get("created_at") or "",
            updated_at=d.get("updated_at"),
            pr_url=d.get("pr_url"),
            pr_number=d.get("pr_number"),
            recording_url=d.get("recording_url"),
            issue_title=d.get("title"),
            issue_number=d.get("number"),
            repo_full_name=d.get("repo_full_name"),
            issue_body=d.get("body"),
            ai_summary=d.get("ai_summary"),
            issue_severity=d.get("severity"),
            issue_category=d.get("category"),
        )
    # Fallback for plain tuples (ds.* columns + joined issue columns at the end)
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
        recording_url=row[10] if len(row) > 10 else None,
    )


@router.get("/sessions", response_model=list[DevinSessionResponse])
async def list_sessions(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        """SELECT ds.*, i.title, i.number, i.repo_full_name, i.body, i.ai_summary, i.severity, i.category
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
        result["live_status"] = live_status.get("status", live_status.get("status_enum", "unknown"))
        result["status_detail"] = live_status.get("status_detail", "")
        result["session_url"] = live_status.get("url", result.get("session_url"))
        # Extract PR URLs from pull_requests array
        prs = live_status.get("pull_requests") or []
        if prs and isinstance(prs, list) and len(prs) > 0:
            pr_data = prs[0] if isinstance(prs[0], dict) else {"url": prs[0]}
            result["pr_url"] = pr_data.get("url", pr_data.get("html_url", str(prs[0])))
        # Extract playback URL
        if live_status.get("playback_url"):
            result["recording_url"] = live_status["playback_url"]

        # Update local DB with live status
        if row:
            new_status = live_status.get("status", live_status.get("status_enum", row[5]))
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

    # Fetch GitHub PAT for repo write access
    pat_cursor = await db.execute("SELECT github_pat FROM settings WHERE id = 1")
    pat_row = await pat_cursor.fetchone()
    github_pat = ""
    if pat_row:
        github_pat = (pat_row["github_pat"] if hasattr(pat_row, 'keys') else pat_row[0]) or ""

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
        prompt = devin.build_issue_prompt(issue_dict, issue_row[5], github_pat=github_pat)

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
        prompt = devin.build_security_prompt(finding_dict, finding_row[8], github_pat=github_pat)

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

    status = live_data.get("status", live_data.get("status_enum", "unknown"))
    status_detail = live_data.get("status_detail", "")

    # Update local DB
    await db.execute(
        "UPDATE devin_sessions SET status = ?, status_detail = ?, updated_at = datetime('now') WHERE session_id = ?",
        (status, status_detail, session_id),
    )

    # If session is finished, check for PR
    if status in ("finished", "stopped"):
        # Check pull_requests array first, then structured_output
        prs = live_data.get("pull_requests") or []
        pr_url = ""
        if prs and isinstance(prs, list) and len(prs) > 0:
            pr_data = prs[0] if isinstance(prs[0], dict) else {"url": prs[0]}
            pr_url = pr_data.get("url", pr_data.get("html_url", str(prs[0])))
        if not pr_url:
            structured = live_data.get("structured_output") or {}
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

    # Fetch GitHub PAT + notification prefs for auto-sending to stuck sessions
    pat_cursor = await db.execute("SELECT github_pat, notifications FROM settings WHERE id = 1")
    pat_row = await pat_cursor.fetchone()
    github_pat = ""
    notif_prefs = {}
    if pat_row:
        github_pat = (pat_row["github_pat"] if hasattr(pat_row, 'keys') else pat_row[0]) or ""
        notif_json = (pat_row["notifications"] if hasattr(pat_row, 'keys') else pat_row[1]) or "{}"
        notif_prefs = json.loads(notif_json)

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
            new_status = live_data.get("status", live_data.get("status_enum", old_status))

            # Update session status and status_detail
            status_detail = live_data.get("status_detail", "")
            await db.execute(
                "UPDATE devin_sessions SET status = ?, status_detail = ?, updated_at = datetime('now') WHERE session_id = ?",
                (new_status, status_detail, sid),
            )

            # Extract PR URL from pull_requests array first, then structured_output
            prs = live_data.get("pull_requests") or []
            pr_url = ""
            if prs and isinstance(prs, list) and len(prs) > 0:
                pr_data = prs[0] if isinstance(prs[0], dict) else {"url": prs[0]}
                pr_url = pr_data.get("url", pr_data.get("html_url", str(prs[0])))
            if not pr_url:
                structured = live_data.get("structured_output") or {}
                pr_url = structured.get("pr_url", "")
            playback_url = live_data.get("playback_url", "")

            # Update recording URL on the session
            if playback_url:
                await db.execute(
                    "UPDATE devin_sessions SET recording_url = ? WHERE session_id = ?",
                    (playback_url, sid),
                )

            # Update PR URL on session if found (even while running)
            if pr_url:
                await db.execute(
                    "UPDATE devin_sessions SET pr_url = ? WHERE session_id = ?",
                    (pr_url, sid),
                )

            # Auto-send GitHub PAT when session is waiting for push access
            if status_detail == 'waiting_for_user' and github_pat:
                # Check the latest messages to see if Devin is asking for push access
                try:
                    last_msg = ""
                    session_detail = live_data
                    # Check structured_output or last message for push access keywords
                    messages = session_detail.get("messages", [])
                    if messages:
                        last_msg = messages[-1].get("message", "") if isinstance(messages[-1], dict) else str(messages[-1])
                    if not last_msg:
                        last_msg = str(session_detail.get("status_detail_text", ""))

                    push_keywords = ["push access", "write access", "permission denied", "403", "could you grant", "don't have write", "can't push", "cannot push"]
                    needs_pat = any(kw in last_msg.lower() for kw in push_keywords)

                    if needs_pat:
                        # Get the repo for this session
                        repo = ""
                        if issue_id:
                            repo_cursor = await db.execute("SELECT repo_full_name FROM issues WHERE id = ?", (issue_id,))
                            repo_row = await repo_cursor.fetchone()
                            repo = repo_row[0] if repo_row else ""
                        elif finding_id:
                            repo_cursor = await db.execute("SELECT repo_full_name FROM security_findings WHERE id = ?", (finding_id,))
                            repo_row = await repo_cursor.fetchone()
                            repo = repo_row[0] if repo_row else ""

                        if repo:
                            owner = repo.split("/")[0] if "/" in repo else ""
                            pat_message = (
                                f"You already have push access via this PAT. Run these commands NOW:\n\n"
                                f"git remote set-url origin https://{owner}:{github_pat}@github.com/{repo}.git\n\n"
                                f"Then retry your push. Do NOT ask for access again.\n"
                                f"For creating PRs, use curl:\n"
                                f"curl -X POST https://api.github.com/repos/{repo}/pulls "
                                f'-H "Authorization: token {github_pat}" '
                                f'-H "Accept: application/vnd.github.v3+json" '
                                f"-d '{{\"title\": \"your title\", \"head\": \"your-branch\", \"base\": \"initial-setup\"}}'"
                            )
                            await devin.send_message(sid, pat_message)
                            logger.info(f"Auto-sent PAT to session {sid} that was stuck asking for push access")
                except Exception as e:
                    logger.warning(f"Failed to auto-send PAT to session {sid}: {e}")

            # Send Slack notification when session needs user input
            if status_detail == 'waiting_for_user' and slack.webhook_url and notif_prefs.get("devin_needs_input", True):
                # Check if we already notified for this waiting state
                notif_cursor = await db.execute(
                    "SELECT status_detail FROM devin_sessions WHERE session_id = ?",
                    (sid,),
                )
                notif_row = await notif_cursor.fetchone()
                old_detail = notif_row[0] if notif_row else ""
                if old_detail != 'waiting_for_user':
                    # First time seeing waiting_for_user - send notification
                    if issue_id:
                        issue_cursor2 = await db.execute(
                            "SELECT title, number, repo_full_name, devin_session_url, approved_at FROM issues WHERE id = ?",
                            (issue_id,),
                        )
                        issue_row2 = await issue_cursor2.fetchone()
                        if issue_row2:
                            session_url = issue_row2[3] or f"https://app.devin.ai/sessions/{sid}"
                            # Calculate time running
                            time_running = ""
                            if issue_row2[4]:
                                try:
                                    from datetime import datetime
                                    approved = datetime.fromisoformat(issue_row2[4])
                                    elapsed = datetime.utcnow() - approved
                                    mins = int(elapsed.total_seconds() / 60)
                                    time_running = f"{mins}m" if mins < 60 else f"{mins // 60}h {mins % 60}m"
                                except Exception:
                                    pass
                            await slack.notify_devin_needs_input(
                                issue_title=issue_row2[0],
                                issue_number=issue_row2[1],
                                repo=issue_row2[2],
                                session_url=session_url,
                                time_running=time_running,
                            )
                            logger.info(f"Slack notification sent: devin_needs_input for issue #{issue_id}")

            # If session finished/stopped, update linked issues/findings
            if new_status in ("finished", "stopped"):
                # Update linked issue
                if issue_id:
                    update_fields = {"status": "pr_open" if pr_url else "resolved"}
                    set_clauses = ["status = ?"]
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

                    # Send "PR Ready for Review" Slack notification
                    if slack.webhook_url and pr_url and notif_prefs.get("pr_ready_for_review", True):
                        issue_cursor = await db.execute(
                            "SELECT title, number, repo_full_name, devin_session_url, approved_at FROM issues WHERE id = ?",
                            (issue_id,),
                        )
                        issue_row = await issue_cursor.fetchone()
                        if issue_row:
                            # Calculate time to PR
                            time_to_pr = ""
                            if issue_row[4]:
                                try:
                                    from datetime import datetime
                                    approved = datetime.fromisoformat(issue_row[4])
                                    elapsed = datetime.utcnow() - approved
                                    mins = int(elapsed.total_seconds() / 60)
                                    time_to_pr = f"{mins}m" if mins < 60 else f"{mins // 60}h {mins % 60}m"
                                except Exception:
                                    pass
                            await slack.notify_pr_ready(
                                issue_title=issue_row[0],
                                issue_number=issue_row[1],
                                repo=issue_row[2],
                                pr_url=pr_url,
                                time_to_pr=time_to_pr,
                            )
                            await db.execute(
                                "UPDATE issues SET slack_notified = 1 WHERE id = ?",
                                (issue_id,),
                            )
                            logger.info(f"Slack notification sent: pr_ready_for_review for issue #{issue_id}")
                    elif slack.webhook_url and not pr_url:
                        # Session finished without PR - just log
                        logger.info(f"Session {sid} finished without PR for issue #{issue_id}")

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

            # Send "Devin Session Failed" notification for error/suspended
            if new_status in ("error", "suspended") and old_status not in ("error", "suspended"):
                if slack.webhook_url and notif_prefs.get("devin_session_failed", True) and issue_id:
                    try:
                        fail_cursor = await db.execute(
                            "SELECT title, number, repo_full_name, devin_session_url, approved_at FROM issues WHERE id = ?",
                            (issue_id,),
                        )
                        fail_row = await fail_cursor.fetchone()
                        if fail_row:
                            session_url = fail_row[3] or f"https://app.devin.ai/sessions/{sid}"
                            time_elapsed = ""
                            if fail_row[4]:
                                try:
                                    from datetime import datetime
                                    approved = datetime.fromisoformat(fail_row[4])
                                    elapsed = datetime.utcnow() - approved
                                    mins = int(elapsed.total_seconds() / 60)
                                    time_elapsed = f"{mins}m" if mins < 60 else f"{mins // 60}h {mins % 60}m"
                                except Exception:
                                    pass
                            await slack.notify_session_failed(
                                issue_title=fail_row[0],
                                issue_number=fail_row[1],
                                repo=fail_row[2],
                                session_url=session_url,
                                error_status=new_status,
                                time_elapsed=time_elapsed,
                            )
                            logger.info(f"Slack notification sent: devin_session_failed for issue #{issue_id}")
                    except Exception as fail_err:
                        logger.error(f"Failed to send session_failed notification: {fail_err}")

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


@router.get("/sessions/{session_id}/live")
async def get_session_live(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
):
    """Fetch live session details from Devin API + cached events."""
    if not devin.token:
        raise HTTPException(status_code=400, detail="Devin API token not configured")

    # Resolve DB integer id to actual Devin session UUID if needed
    actual_session_id = session_id
    try:
        row_id = int(session_id)
        cursor = await db.execute("SELECT session_id FROM devin_sessions WHERE id = ?", (row_id,))
        row = await cursor.fetchone()
        if row and row[0]:
            actual_session_id = row[0]
    except (ValueError, TypeError):
        pass  # Not an integer, use as-is (it's already a UUID)

    try:
        live_data = await devin.get_session(actual_session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from Devin API: {str(e)}")

    # Extract useful fields for the frontend
    structured = live_data.get("structured_output") or {}
    prs = live_data.get("pull_requests") or []
    pr_url = ""
    if prs and isinstance(prs, list) and len(prs) > 0:
        pr_data = prs[0] if isinstance(prs[0], dict) else {"url": prs[0]}
        pr_url = pr_data.get("url", pr_data.get("html_url", str(prs[0])))

    status = live_data.get("status", live_data.get("status_enum", "unknown"))
    status_detail = live_data.get("status_detail", "")
    title = live_data.get("title", "")

    # Load cached events from DB (todos, messages, file_changes, status updates)
    cached_todos = []
    cached_messages = []
    cached_file_changes = []
    try:
        cursor = await db.execute(
            "SELECT event_type, event_data, created_at FROM session_events WHERE session_id = ? ORDER BY created_at DESC",
            (actual_session_id,),
        )
        rows = await cursor.fetchall()
        for row in rows:
            evt_type = row[0]
            evt_data = json.loads(row[1]) if row[1] else {}
            if evt_type == "todo_update":
                # Only keep the latest todo snapshot
                if not cached_todos:
                    cached_todos = evt_data.get("todos", [])
            elif evt_type == "devin_message":
                cached_messages.append({
                    "message": evt_data.get("message", ""),
                    "timestamp": row[2],
                })
            elif evt_type == "file_changes":
                if not cached_file_changes:
                    cached_file_changes = evt_data.get("files", [])
    except Exception:
        pass

    # Build timeline from cached todos (real Devin task list)
    timeline = []
    if cached_todos:
        for todo in cached_todos:
            todo_status = todo.get("status", "pending")
            timeline_status = "done" if todo_status == "completed" else "running" if todo_status == "in_progress" else "waiting"
            timeline.append({
                "step": todo.get("content", "Task"),
                "status": timeline_status,
                "detail": "",
            })
    else:
        # Fallback: infer timeline from session data
        timeline.append({"step": "Session started", "status": "done", "detail": title or "Analyzing issue..."})

        if isinstance(structured, dict):
            plan = structured.get("plan", structured.get("summary", ""))
            if plan:
                timeline.append({"step": "Plan created", "status": "done", "detail": plan[:200]})
            steps = structured.get("steps", structured.get("tasks", []))
            if isinstance(steps, list):
                for s in steps[:8]:
                    if isinstance(s, dict):
                        timeline.append({
                            "step": s.get("title", s.get("name", s.get("description", "Step"))),
                            "status": s.get("status", "done"),
                            "detail": s.get("description", s.get("detail", "")),
                        })
                    elif isinstance(s, str):
                        timeline.append({"step": s, "status": "done", "detail": ""})

        if status in ("running",) and not structured and not cached_todos:
            if status_detail == "waiting_for_user":
                timeline.append({"step": "Analysis complete", "status": "done", "detail": "Waiting for your approval"})
            else:
                timeline.append({"step": "Working on fix", "status": "running", "detail": "Devin is writing code..."})

    if status_detail == "waiting_for_user":
        timeline.append({"step": "Awaiting approval", "status": "waiting", "detail": "Review the plan and approve to proceed"})

    if prs:
        timeline.append({"step": "Pull request created", "status": "done", "detail": pr_url})

    if status in ("completed", "succeeded", "finished", "stopped"):
        timeline.append({"step": "Completed", "status": "done", "detail": "Fix has been implemented"})

    return {
        "session_id": session_id,
        "status": status,
        "status_detail": status_detail,
        "title": title,
        "url": live_data.get("url", f"https://app.devin.ai/sessions/{session_id}"),
        "playback_url": live_data.get("playback_url", ""),
        "pr_url": pr_url,
        "structured_output": structured,
        "timeline": timeline,
        "todos": cached_todos,
        "messages": cached_messages[:5],
        "file_changes": cached_file_changes,
        "created_at": live_data.get("created_at", ""),
        "updated_at": live_data.get("updated_at", ""),
    }


@router.post("/sessions/{session_id}/events")
async def store_session_events(
    session_id: str,
    events: list[dict],
    db: aiosqlite.Connection = Depends(get_db),
):
    """Store cached events for a Devin session (called by sync process)."""
    for evt in events:
        evt_type = evt.get("type", "unknown")
        evt_data = json.dumps(evt.get("data", evt))
        evt_time = evt.get("created_at", None)
        await db.execute(
            "INSERT INTO session_events (session_id, event_type, event_data, created_at) VALUES (?, ?, ?, COALESCE(?, datetime('now')))",
            (session_id, evt_type, evt_data, evt_time),
        )
    await db.commit()
    return {"stored": len(events)}


@router.get("/sessions/{session_id}/events")
async def get_session_events(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get cached events for a Devin session."""
    cursor = await db.execute(
        "SELECT event_type, event_data, created_at FROM session_events WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    )
    rows = await cursor.fetchall()
    return [
        {"type": row[0], "data": json.loads(row[1]) if row[1] else {}, "created_at": row[2]}
        for row in rows
    ]


@router.post("/sessions/{session_id}/approve")
async def approve_session(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
    devin: DevinService = Depends(get_devin_service),
):
    """Send approval message to a Devin session that is waiting for user input."""
    if not devin.token:
        raise HTTPException(status_code=400, detail="Devin API token not configured")

    # session_id could be db row id (integer) or actual devin session uuid
    # Look up the actual devin session_id from the database
    actual_session_id = session_id
    try:
        row_id = int(session_id)
        cursor = await db.execute("SELECT session_id FROM devin_sessions WHERE id = ?", (row_id,))
        row = await cursor.fetchone()
        if row and row[0]:
            actual_session_id = row[0]
    except (ValueError, TypeError):
        pass  # Not an integer, use as-is (it's already a UUID)

    # Fetch GitHub PAT to include in approval message
    pat_cursor = await db.execute("SELECT github_pat FROM settings WHERE id = 1")
    pat_row = await pat_cursor.fetchone()
    github_pat = ""
    if pat_row:
        github_pat = (pat_row["github_pat"] if hasattr(pat_row, 'keys') else pat_row[0]) or ""

    # Also get the repo name for this session's issue
    repo_name = ""
    issue_cursor = await db.execute(
        "SELECT i.repo_full_name FROM devin_sessions ds JOIN issues i ON ds.issue_id = i.id WHERE ds.session_id = ? OR ds.id = ?",
        (actual_session_id, session_id),
    )
    issue_row = await issue_cursor.fetchone()
    if issue_row:
        repo_name = issue_row[0] or ""

    # Build approval message with PAT instructions
    pat_instructions = ""
    if github_pat and repo_name:
        owner = repo_name.split("/")[0] if "/" in repo_name else ""
        pat_instructions = (
            f"\n\nIMPORTANT - Git Authentication:\n"
            f"Run this command IMMEDIATELY before pushing or creating a PR:\n"
            f"  git remote set-url origin https://{owner}:{github_pat}@github.com/{repo_name}.git\n"
            f"Do NOT use git_create_pr - it will fail. Use curl instead:\n"
            f"  curl -X POST https://api.github.com/repos/{repo_name}/pulls "
            f'-H "Authorization: token {github_pat}" '
            f'-H "Accept: application/vnd.github.v3+json" '
            f"-d '{{\"title\": \"your title\", \"head\": \"your-branch\", \"base\": \"initial-setup\"}}'"
            f"\nDo NOT ask for repo access. You have it via this PAT."
        )

    approval_msg = f"Approved. Please proceed with implementing the fix, create a PR, and record a test.{pat_instructions}"

    try:
        result = await devin.send_message(actual_session_id, approval_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message to Devin: {str(e)}")

    # Update status_detail in DB (try both id and session_id)
    await db.execute(
        "UPDATE devin_sessions SET status_detail = 'approved', updated_at = datetime('now') WHERE id = ? OR session_id = ?",
        (session_id, actual_session_id),
    )
    await db.commit()

    return {"session_id": actual_session_id, "status": "approved", "result": result}
