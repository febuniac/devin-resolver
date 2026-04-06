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
from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/issues", tags=["issues"])

# ── Shared classification logic ──────────────────────────────────────
# Priority order:
#   1. GitHub labels are AUTHORITATIVE (your security team labels matter most)
#   2. Title + body keyword analysis (OWASP patterns, CVE refs, CWE IDs)
#   3. Default fallback = "bug"

# Security keywords: OWASP Top 10 + common vuln patterns
_SECURITY_TITLE_KEYWORDS = [
    "security", "vulnerability", "cve", "cwe", "xss", "csrf",
    "sql injection", "sqli", "injection", "auth bypass", "privilege escalation",
    "remote code execution", "rce", "ssrf", "idor", "broken access",
    "sensitive data", "cryptographic", "deserialization", "xxe",
    "cors", "tls", "https", "certificate", "token", "jwt",
    "password", "hashing", "encryption", "secret", "credential",
    "open redirect", "path traversal", "directory traversal",
    "rate limit", "brute force", "dos", "ddos",
    "command injection", "code injection", "header injection",
    "insecure", "hardcoded", "exposed", "leak",
]
_SECURITY_LABELS = ["security", "vulnerability", "cve", "security-fix"]
_FEATURE_LABELS = ["feature", "enhancement", "feature-request"]
_PERFORMANCE_LABELS = ["performance", "perf", "optimization"]


def classify_issue(title: str, body: str, labels: list[str]) -> tuple[str, str, int, str]:
    """Return (category, severity, confidence, effort) for an issue.

    Classification rules:
    1. Labels are authoritative — if the security team labeled it `security`, it IS security.
    2. Title + body content analysis for security patterns (OWASP, CVE, CWE, etc.)
    3. Keyword matching for feature / performance / refactor / docs.
    4. Default = bug.
    """
    title_lower = title.lower()
    body_lower = (body or "").lower()
    labels_lower = [l.lower() for l in labels]
    text = title_lower + " " + body_lower

    # ── Step 1: Category (labels first, then content) ──
    category = "bug"  # default

    # Labels are AUTHORITATIVE — check them first
    if any(lbl in labels_lower for lbl in _SECURITY_LABELS):
        category = "security"
    elif any(lbl in labels_lower for lbl in _FEATURE_LABELS):
        category = "feature"
    elif any(lbl in labels_lower for lbl in _PERFORMANCE_LABELS):
        category = "performance"
    elif "bug" in labels_lower:
        category = "bug"
    elif "refactor" in labels_lower or "tech-debt" in labels_lower:
        category = "refactor"
    elif "documentation" in labels_lower or "docs" in labels_lower:
        category = "documentation"
    else:
        # No authoritative label → fall back to content analysis
        if any(kw in text for kw in _SECURITY_TITLE_KEYWORDS):
            category = "security"
        elif any(kw in title_lower for kw in ["feature", "add", "implement", "request"]):
            category = "feature"
        elif any(kw in title_lower for kw in ["slow", "performance", "memory", "leak", "optimize"]):
            category = "performance"
        elif any(kw in title_lower for kw in ["refactor", "cleanup", "tech debt"]):
            category = "refactor"
        elif any(kw in title_lower for kw in ["doc", "readme", "documentation"]):
            category = "documentation"

    # ── Step 2: Severity ──
    severity = "medium"
    if any(k in labels_lower for k in ["p0", "critical", "urgent"]):
        severity = "critical"
    elif any(k in labels_lower for k in ["p1", "high"]):
        severity = "high"
    elif any(k in labels_lower for k in ["p3", "low", "minor"]):
        severity = "low"
    elif "crash" in title_lower or "broken" in title_lower:
        severity = "high"
    # Security issues default to at least "high" if not already set higher
    if category == "security" and severity == "medium":
        severity = "high"

    # ── Step 3: Effort + Confidence ──
    body_len = len(body or "")
    if body_len < 200:
        effort = "1-2 hours"
        confidence = 85
    elif body_len < 500:
        effort = "2-4 hours"
        confidence = 80
    else:
        effort = "4-8 hours"
        confidence = 75

    return category, severity, confidence, effort


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
    exclude_category: Optional[str] = Query(None),
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
    if exclude_category:
        query += " AND category != ?"
        params.append(exclude_category)
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
        # Get Devin token + org_id + slack webhook + github_pat + notification prefs from settings
        cursor = await db.execute(
            "SELECT devin_api_token, devin_org_id, slack_webhook_url, github_pat, notifications FROM settings WHERE id = 1"
        )
        settings_row = await cursor.fetchone()
        token = settings_row[0] if settings_row and settings_row[0] else ""
        org_id = settings_row[1] if settings_row and settings_row[1] else ""
        slack_webhook = settings_row[2] if settings_row and settings_row[2] else ""
        github_pat = settings_row[3] if settings_row and settings_row[3] else ""
        notif_prefs = json.loads(settings_row[4]) if settings_row and settings_row[4] else {}

        if not token:
            logger.warning("No Devin API token configured — skipping session creation")
            return

        logger.info(f"Using Devin API with org_id={org_id}, token_prefix={token[:10]}...")
        devin = DevinService(token, org_id=org_id)
        slack = SlackService(webhook_url=slack_webhook)

        # Pre-check: how many sessions are already running?
        MAX_CONCURRENT_SESSIONS = 5
        active_cursor = await db.execute(
            "SELECT COUNT(*) FROM devin_sessions WHERE status IN ('running', 'pending', 'suspended')"
        )
        active_count = (await active_cursor.fetchone())[0]
        if active_count >= MAX_CONCURRENT_SESSIONS:
            logger.warning(f"At session limit ({active_count}/{MAX_CONCURRENT_SESSIONS}) — queuing all {len(issue_ids)} issues")
            for issue_id in issue_ids:
                await db.execute(
                    "UPDATE issues SET status = 'queued' WHERE id = ? AND status IN ('approved', 'triaged')",
                    (issue_id,),
                )
            await db.commit()
            return

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

                # Guard: skip if this issue already has an active session
                dup_cursor = await db.execute(
                    "SELECT session_id FROM devin_sessions WHERE issue_id = ? AND status IN ('running', 'pending', 'suspended') LIMIT 1",
                    (issue_id,),
                )
                existing = await dup_cursor.fetchone()
                if existing:
                    logger.warning(f"Issue {issue_id} already has active session {existing[0]} — skipping")
                    continue

                logger.info(f"Creating Devin session for issue #{issue_id} in {repo}")
                prompt = devin.build_issue_prompt(
                    {
                        "number": issue_number,
                        "title": issue_title,
                        "body": issue_row[4] or "",
                        "labels": json.loads(issue_row[6]) if issue_row[6] else [],
                    },
                    repo,
                    github_pat=github_pat,
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

                # Delay between session creations to avoid Devin API rate limiting
                if len(issue_ids) > 1:
                    await asyncio.sleep(5)

                # Send "Issue Sent to Devin" Slack notification
                if slack.webhook_url and notif_prefs.get("issue_sent_to_devin", True):
                    try:
                        await slack.notify_issue_sent_to_devin(
                            issue_title=issue_title,
                            issue_number=issue_number,
                            repo=repo,
                            session_id=session_id,
                            session_url=session_url,
                        )
                        logger.info(f"Slack notification sent for issue #{issue_id} — sent to Devin")
                    except Exception as slack_err:
                        logger.error(f"Failed to send Slack notification for issue {issue_id}: {slack_err}")

            except Exception as e:
                logger.error(f"Failed to create Devin session for issue {issue_id}: {e}", exc_info=True)
                if "429" in str(e):
                    # Rate limited — mark as queued so auto-retry picks it up later
                    await db.execute(
                        "UPDATE issues SET status = 'queued' WHERE id = ? AND status IN ('approved', 'queued')",
                        (issue_id,),
                    )
                    await db.commit()
                    logger.warning(f"Issue {issue_id} queued for retry due to rate limiting")
                    # Stop trying remaining issues — API is rate limited
                    for remaining_id in issue_ids[issue_ids.index(issue_id) + 1:]:
                        await db.execute(
                            "UPDATE issues SET status = 'queued' WHERE id = ? AND status = 'approved'",
                            (remaining_id,),
                        )
                    await db.commit()
                    break
                else:
                    # Non-rate-limit error — mark back to triaged for manual retry
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

    # Check capacity before kicking off background task
    active_cursor = await db.execute(
        "SELECT COUNT(*) FROM devin_sessions WHERE status IN ('running', 'pending', 'suspended')"
    )
    active_count = (await active_cursor.fetchone())[0]
    MAX_CONCURRENT_SESSIONS = 5
    will_queue = max(0, len(approved) - max(0, MAX_CONCURRENT_SESSIONS - active_count))

    # Kick off Devin sessions in the background
    if approved:
        background_tasks.add_task(_create_devin_sessions, approved)

    return {
        "approved": approved,
        "count": len(approved),
        "already_in_progress": already_in_progress,
        "queued_count": will_queue,
        "active_sessions": active_count,
        "max_concurrent": MAX_CONCURRENT_SESSIONS,
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

    # Use shared classification logic
    title = row[3] or ""
    body = row[4] or ""
    labels = json.loads(row[6] or "[]")

    category, severity, confidence, effort = classify_issue(title, body, labels)

    # Generate AI summary
    ai_summary = f"Issue in {row[5]}: {title}. Categorized as {category} with {severity} severity. Estimated effort: {effort}."

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
        cursor2 = await db.execute("SELECT * FROM issues WHERE id = ?", (row[0],))
        issue_row = await cursor2.fetchone()
        if issue_row:
            title = issue_row[3] or ""
            body = issue_row[4] or ""
            labels = json.loads(issue_row[6] or "[]")

            category, severity, confidence, effort = classify_issue(title, body, labels)

            ai_summary = f"Issue in {issue_row[5]}: {title}. Categorized as {category} ({severity}). Est: {effort}."

            await db.execute(
                """UPDATE issues SET severity = ?, category = ?, status = 'triaged',
                ai_confidence = ?, ai_summary = ?, estimated_effort = ?,
                triaged_at = datetime('now') WHERE id = ?""",
                (severity, category, confidence, ai_summary, effort, row[0]),
            )
            results.append({"issue_id": row[0], "severity": severity, "category": category})

    await db.commit()
    return {"triaged": len(results), "results": results}


@router.post("/sync-and-triage")
async def sync_and_triage(db: aiosqlite.Connection = Depends(get_db)):
    """Sync all connected repos from GitHub, then triage new issues."""
    # Get GitHub token
    cursor = await db.execute("SELECT github_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    gh_token = row[0] if row and row[0] else ""
    if not gh_token:
        return {"error": "No GitHub token configured", "synced": 0, "triaged": 0}

    github = GitHubService(gh_token)

    # Get all connected repos
    cursor = await db.execute("SELECT * FROM connected_repos")
    repos = await cursor.fetchall()
    if not repos:
        return {"error": "No repos connected", "synced": 0, "triaged": 0}

    total_synced = 0
    total_security = 0

    for repo_row in repos:
        owner, name, full_name = repo_row[1], repo_row[2], repo_row[3]
        repo_id = repo_row[0]

        # Fetch latest issues from GitHub
        try:
            issues = await github.list_issues(owner, name)
        except Exception as e:
            logger.error(f"Failed to sync {full_name}: {e}")
            continue

        synced_count = 0
        for issue in issues:
            github_id = issue["id"]
            cursor = await db.execute("SELECT id FROM issues WHERE github_id = ?", (github_id,))
            existing = await cursor.fetchone()

            labels = json.dumps([l["name"] for l in issue.get("labels", [])])

            if existing:
                await db.execute(
                    """UPDATE issues SET title = ?, body = ?, labels = ?, state = ?,
                    updated_at = ? WHERE github_id = ?""",
                    (issue["title"], issue.get("body", ""), labels, issue["state"],
                     issue.get("updated_at", ""), github_id),
                )
            else:
                await db.execute(
                    """INSERT INTO issues (github_id, number, title, body, repo_full_name,
                    labels, state, author, created_at, updated_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')""",
                    (github_id, issue["number"], issue["title"], issue.get("body", ""),
                     full_name, labels, issue["state"],
                     issue.get("user", {}).get("login", ""),
                     issue.get("created_at", ""), issue.get("updated_at", "")),
                )
                synced_count += 1

        # Sync security findings
        security_count = 0
        try:
            alerts = await github.list_code_scanning_alerts(owner, name)
            for alert in alerts:
                alert_number = alert["number"]
                cursor = await db.execute(
                    "SELECT id FROM security_findings WHERE alert_number = ? AND repo_full_name = ?",
                    (alert_number, full_name),
                )
                existing = await cursor.fetchone()
                rule = alert.get("rule", {})
                location = alert.get("most_recent_instance", {}).get("location", {})
                if not existing:
                    await db.execute(
                        """INSERT INTO security_findings
                        (alert_number, rule, rule_id, severity, file_path, line_number,
                        description, repo_full_name, category, cwe_id, status, detected_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)""",
                        (alert_number, rule.get("description", ""), rule.get("id", ""),
                         alert.get("rule", {}).get("security_severity_level", "medium"),
                         location.get("path", ""), location.get("start_line", 0),
                         rule.get("full_description", rule.get("description", "")),
                         full_name, rule.get("tags", [""])[0] if rule.get("tags") else "",
                         ",".join(f"CWE-{c.get('cwe_id', '')}" for c in rule.get("cwes", [])) if rule.get("cwes") else "",
                         alert.get("created_at", "")),
                    )
                    security_count += 1
        except Exception:
            pass

        # Update last_sync
        await db.execute(
            """UPDATE connected_repos SET last_sync = datetime('now'),
            open_issues_count = ? WHERE id = ?""",
            (len(issues), repo_id),
        )
        total_synced += synced_count
        total_security += security_count

    await db.commit()

    # Now triage all open issues
    cursor = await db.execute("SELECT id FROM issues WHERE status = 'open'")
    rows = await cursor.fetchall()
    triaged_count = 0
    for row in rows:
        cursor2 = await db.execute("SELECT * FROM issues WHERE id = ?", (row[0],))
        issue_row = await cursor2.fetchone()
        if issue_row:
            title = issue_row[3] or ""
            body = issue_row[4] or ""
            labels = json.loads(issue_row[6] or "[]")

            category, severity, confidence, effort = classify_issue(title, body, labels)

            ai_summary = f"Issue in {issue_row[5]}: {title}. Categorized as {category} ({severity}). Est: {effort}."

            await db.execute(
                """UPDATE issues SET severity = ?, category = ?, status = 'triaged',
                ai_confidence = ?, ai_summary = ?, estimated_effort = ?,
                triaged_at = datetime('now') WHERE id = ?""",
                (severity, category, confidence, ai_summary, effort, row[0]),
            )
            triaged_count += 1

            # Send "New Issue Triaged" Slack notification
            try:
                notif_cursor = await db.execute("SELECT slack_webhook_url, notifications FROM settings WHERE id = 1")
                notif_row = await notif_cursor.fetchone()
                slack_webhook = notif_row[0] if notif_row else ""
                notif_prefs = json.loads(notif_row[1]) if notif_row and notif_row[1] else {}
                if slack_webhook and notif_prefs.get("new_issue_triaged", True):
                    slack = SlackService(webhook_url=slack_webhook)
                    github_url = f"https://github.com/{issue_row[5]}/issues/{issue_row[2]}"
                    await slack.notify_issue_triaged(
                        issue_title=issue_row[3],
                        issue_number=issue_row[2],
                        repo=issue_row[5],
                        severity=severity,
                        category=category,
                        ai_summary=ai_summary,
                        effort=effort,
                        github_url=github_url,
                    )
                    logger.info(f"Slack notification sent: new_issue_triaged for issue #{row[0]}")
            except Exception as slack_err:
                logger.error(f"Failed to send triaged notification for issue {row[0]}: {slack_err}")

    await db.commit()
    return {
        "synced": total_synced,
        "security_synced": total_security,
        "triaged": triaged_count,
        "message": f"Synced {total_synced} new issues, {total_security} security findings, triaged {triaged_count} issues",
    }


@router.post("/reclassify-all")
async def reclassify_all_issues(db: aiosqlite.Connection = Depends(get_db)):
    """Re-run classification on ALL issues using the improved shared logic.
    Does not change status — only updates category, severity, confidence, effort, and summary."""
    cursor = await db.execute("SELECT * FROM issues")
    rows = await cursor.fetchall()
    updated = 0
    for row in rows:
        title = row[3] or ""
        body = row[4] or ""
        labels = json.loads(row[6] or "[]")

        category, severity, confidence, effort = classify_issue(title, body, labels)

        ai_summary = f"Issue in {row[5]}: {title}. Categorized as {category} ({severity}). Est: {effort}."

        await db.execute(
            """UPDATE issues SET severity = ?, category = ?,
            ai_confidence = ?, ai_summary = ?, estimated_effort = ? WHERE id = ?""",
            (severity, category, confidence, ai_summary, effort, row[0]),
        )
        updated += 1

    await db.commit()
    return {"reclassified": updated}


@router.post("/retry-stuck")
async def retry_stuck_issues(
    background_tasks: BackgroundTasks,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Retry issues stuck in 'approved' or 'queued' status without a Devin session."""
    cursor = await db.execute(
        "SELECT id FROM issues WHERE status IN ('approved', 'queued') AND (devin_session_id IS NULL OR devin_session_id = '')"
    )
    rows = await cursor.fetchall()
    stuck_ids = [row[0] for row in rows]

    if stuck_ids:
        background_tasks.add_task(_create_devin_sessions, stuck_ids)

    return {"retrying": len(stuck_ids), "issue_ids": stuck_ids}
