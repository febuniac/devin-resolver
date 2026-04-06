import json
import logging
import re
from fastapi import APIRouter, Depends, HTTPException
import httpx
import aiosqlite

from app.db.database import get_db
from app.services.devin_service import DevinService
from app.services.slack_service import SlackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/github", tags=["github"])


async def get_github_pat(db: aiosqlite.Connection) -> str:
    cursor = await db.execute("SELECT github_pat FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    pat = ""
    if row:
        pat = (row["github_pat"] if hasattr(row, "keys") else row[0]) or ""
    if not pat:
        raise HTTPException(status_code=400, detail="GitHub PAT not configured. Go to Settings to add it.")
    return pat


@router.get("/pr-diff/{owner}/{repo}/{pr_number}")
async def get_pr_diff(
    owner: str,
    repo: str,
    pr_number: int,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Fetch PR details, files changed, and diff from GitHub API."""
    pat = await get_github_pat(db)
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch PR metadata
        pr_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if pr_resp.status_code != 200:
            raise HTTPException(status_code=pr_resp.status_code, detail=f"GitHub API error: {pr_resp.text[:300]}")
        pr_data = pr_resp.json()

        # Fetch files changed
        files_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files",
            headers=headers,
        )
        files_data = files_resp.json() if files_resp.status_code == 200 else []

        # Fetch the actual diff
        diff_headers = {**headers, "Accept": "application/vnd.github.v3.diff"}
        diff_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=diff_headers,
        )
        raw_diff = diff_resp.text if diff_resp.status_code == 200 else ""

    # If PR is merged, auto-update session and issue status in DB
    if pr_data.get("merged", False):
        pr_url_pattern = f"%/{owner}/{repo}/pull/{pr_number}%"
        await db.execute(
            "UPDATE devin_sessions SET status = 'merged', updated_at = datetime('now') WHERE pr_url LIKE ? AND status != 'merged'",
            (pr_url_pattern,),
        )
        await db.execute(
            "UPDATE issues SET status = 'resolved' WHERE id IN (SELECT issue_id FROM devin_sessions WHERE pr_url LIKE ?) AND status != 'resolved'",
            (pr_url_pattern,),
        )
        await db.commit()

        # Send "PR Merged / Issue Resolved" Slack notification
        try:
            settings_cursor = await db.execute("SELECT slack_webhook_url, notifications FROM settings WHERE id = 1")
            settings_row = await settings_cursor.fetchone()
            slack_webhook = (settings_row[0] if settings_row else "") or ""
            notif_prefs = json.loads(settings_row[1]) if settings_row and settings_row[1] else {}
            if slack_webhook and notif_prefs.get("pr_merged", True):
                # Find the linked issue
                issue_cursor = await db.execute(
                    """SELECT i.title, i.number, i.repo_full_name, i.triaged_at
                    FROM issues i JOIN devin_sessions ds ON ds.issue_id = i.id
                    WHERE ds.pr_url LIKE ?""",
                    (pr_url_pattern,),
                )
                issue_row = await issue_cursor.fetchone()
                if issue_row:
                    total_time = ""
                    if issue_row[3]:
                        try:
                            from datetime import datetime
                            triaged = datetime.fromisoformat(issue_row[3])
                            elapsed = datetime.utcnow() - triaged
                            mins = int(elapsed.total_seconds() / 60)
                            if mins < 60:
                                total_time = f"{mins}m"
                            elif mins < 1440:
                                total_time = f"{mins // 60}h {mins % 60}m"
                            else:
                                total_time = f"{mins // 1440}d {(mins % 1440) // 60}h"
                        except Exception:
                            pass
                    slack = SlackService(webhook_url=slack_webhook)
                    await slack.notify_pr_merged(
                        issue_title=issue_row[0],
                        issue_number=issue_row[1],
                        repo=issue_row[2],
                        pr_url=pr_data.get("html_url", f"https://github.com/{owner}/{repo}/pull/{pr_number}"),
                        total_time=total_time,
                    )
                    logger.info(f"Slack notification sent: pr_merged for {owner}/{repo}#{pr_number}")
        except Exception as slack_err:
            logger.error(f"Failed to send pr_merged notification: {slack_err}")

    # Build response
    files = []
    for f in files_data:
        files.append({
            "filename": f.get("filename", ""),
            "status": f.get("status", ""),  # added, removed, modified, renamed
            "additions": f.get("additions", 0),
            "deletions": f.get("deletions", 0),
            "changes": f.get("changes", 0),
            "patch": f.get("patch", ""),  # The actual diff for this file
        })

    return {
        "title": pr_data.get("title", ""),
        "body": pr_data.get("body", ""),
        "state": pr_data.get("state", ""),
        "mergeable": pr_data.get("mergeable"),
        "merged": pr_data.get("merged", False),
        "html_url": pr_data.get("html_url", ""),
        "head_branch": pr_data.get("head", {}).get("ref", ""),
        "base_branch": pr_data.get("base", {}).get("ref", ""),
        "user": pr_data.get("user", {}).get("login", ""),
        "additions": pr_data.get("additions", 0),
        "deletions": pr_data.get("deletions", 0),
        "changed_files": pr_data.get("changed_files", 0),
        "files": files,
        "raw_diff": raw_diff[:50000],  # Limit diff size
    }


@router.post("/sync-prs")
async def sync_prs_from_github(
    db: aiosqlite.Connection = Depends(get_db),
):
    """Scan all connected repos on GitHub for open PRs and match them to Devin sessions by issue number.
    This fixes the case where Devin created PRs but the PR URLs weren't stored in the sessions DB."""
    pat = await get_github_pat(db)
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }

    # Get all connected repos
    cursor = await db.execute("SELECT owner, name FROM connected_repos")
    repos = await cursor.fetchall()
    if not repos:
        return {"synced": 0, "message": "No connected repos"}

    # Get all sessions that don't have PR URLs yet
    cursor = await db.execute(
        """SELECT ds.id, ds.session_id, ds.issue_id, i.number as issue_number, i.repo_full_name
        FROM devin_sessions ds
        LEFT JOIN issues i ON ds.issue_id = i.id
        WHERE ds.pr_url IS NULL OR ds.pr_url = ''"""
    )
    sessions_without_pr = await cursor.fetchall()
    if not sessions_without_pr:
        return {"synced": 0, "message": "All sessions already have PR URLs"}

    # Build a lookup: (repo_full_name, issue_number) -> session db id
    session_lookup = {}
    for row in sessions_without_pr:
        if hasattr(row, 'keys'):
            d = dict(row)
            repo = d.get("repo_full_name", "")
            issue_num = d.get("issue_number")
            db_id = d.get("id")
        else:
            db_id = row[0]
            issue_num = row[3]
            repo = row[4]
        if repo and issue_num:
            session_lookup[(repo, int(issue_num))] = db_id

    updated = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        for repo_row in repos:
            owner = repo_row[0] if not hasattr(repo_row, 'keys') else repo_row["owner"]
            name = repo_row[1] if not hasattr(repo_row, 'keys') else repo_row["name"]
            repo_full = f"{owner}/{name}"

            # Fetch open PRs for this repo
            try:
                resp = await client.get(
                    f"https://api.github.com/repos/{owner}/{name}/pulls?state=open&per_page=50",
                    headers=headers,
                )
                if resp.status_code != 200:
                    logger.warning(f"Failed to fetch PRs for {repo_full}: {resp.status_code}")
                    continue
                prs = resp.json()
            except Exception as e:
                logger.error(f"Error fetching PRs for {repo_full}: {e}")
                continue

            for pr in prs:
                pr_title = pr.get("title", "")
                pr_body = pr.get("body", "") or ""
                pr_url = pr.get("html_url", "")
                pr_number = pr.get("number")

                # Try to extract issue number from PR title or body
                # Patterns: "Fixes #31", "(#31)", "Issue #31", "#31"
                issue_nums_found = set()
                for text in [pr_title, pr_body]:
                    matches = re.findall(r'#(\d+)', text)
                    for m in matches:
                        issue_nums_found.add(int(m))

                # Also check if the PR branch name has an issue number
                branch = pr.get("head", {}).get("ref", "")
                branch_matches = re.findall(r'(\d+)', branch)
                for m in branch_matches:
                    num = int(m)
                    if num < 1000:  # Likely an issue number, not a timestamp
                        issue_nums_found.add(num)

                # Match against sessions
                for issue_num in issue_nums_found:
                    key = (repo_full, issue_num)
                    if key in session_lookup:
                        db_id = session_lookup[key]
                        # Update the session with PR URL
                        await db.execute(
                            "UPDATE devin_sessions SET pr_url = ?, updated_at = datetime('now') WHERE id = ?",
                            (pr_url, db_id),
                        )
                        # Also update the linked issue
                        await db.execute(
                            "UPDATE issues SET pr_url = ?, status = 'pr_open' WHERE number = ? AND repo_full_name = ?",
                            (pr_url, issue_num, repo_full),
                        )
                        updated += 1
                        logger.info(f"Synced PR #{pr_number} -> session {db_id} (issue #{issue_num} in {repo_full})")
                        # Remove from lookup so we don't double-match
                        del session_lookup[key]

    await db.commit()
    return {"synced": updated, "message": f"Synced {updated} PRs from GitHub to sessions"}


@router.post("/pr-comment/{owner}/{repo}/{pr_number}")
async def post_pr_comment(
    owner: str,
    repo: str,
    pr_number: int,
    body: dict,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Post a comment on a PR via GitHub API."""
    pat = await get_github_pat(db)
    comment_text = body.get("comment", "").strip()
    if not comment_text:
        raise HTTPException(status_code=400, detail="Comment text is required")

    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments",
            headers=headers,
            json={"body": comment_text},
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(status_code=resp.status_code, detail=f"GitHub API error: {resp.text[:300]}")
        data = resp.json()

    return {
        "id": data.get("id"),
        "html_url": data.get("html_url", ""),
        "body": data.get("body", ""),
        "created_at": data.get("created_at", ""),
        "user": data.get("user", {}).get("login", ""),
    }


@router.post("/pr-merge/{owner}/{repo}/{pr_number}")
async def merge_pr(
    owner: str,
    repo: str,
    pr_number: int,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Merge a PR via GitHub API using the configured PAT."""
    pat = await get_github_pat(db)
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # First check PR state
        pr_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if pr_resp.status_code != 200:
            raise HTTPException(status_code=pr_resp.status_code, detail=f"GitHub API error: {pr_resp.text[:300]}")

        pr_data = pr_resp.json()
        if pr_data.get("merged"):
            return {"status": "already_merged", "message": "PR is already merged"}
        if pr_data.get("state") != "open":
            raise HTTPException(status_code=400, detail=f"PR is not open (state: {pr_data.get('state')})")

        # Merge the PR
        merge_resp = await client.put(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge",
            headers=headers,
            json={
                "merge_method": "squash",
                "commit_title": f"Merge PR #{pr_number}: {pr_data.get('title', '')}",
            },
        )

        if merge_resp.status_code == 200:
            merge_data = merge_resp.json()

            # Update local DB: mark session as merged
            pr_url_pattern = f"%/{owner}/{repo}/pull/{pr_number}%"
            await db.execute(
                """UPDATE devin_sessions SET status = 'merged', updated_at = datetime('now')
                WHERE pr_url LIKE ?""",
                (pr_url_pattern,),
            )
            # Also update the linked issue status
            await db.execute(
                """UPDATE issues SET status = 'resolved'
                WHERE id IN (
                    SELECT issue_id FROM devin_sessions WHERE pr_url LIKE ?
                )""",
                (pr_url_pattern,),
            )
            await db.commit()

            # Send "PR Merged / Issue Resolved" Slack notification
            try:
                settings_cursor = await db.execute("SELECT slack_webhook_url, notifications FROM settings WHERE id = 1")
                settings_row = await settings_cursor.fetchone()
                slack_webhook = (settings_row[0] if settings_row else "") or ""
                notif_prefs = json.loads(settings_row[1]) if settings_row and settings_row[1] else {}
                if slack_webhook and notif_prefs.get("pr_merged", True):
                    issue_cursor = await db.execute(
                        """SELECT i.title, i.number, i.repo_full_name, i.triaged_at
                        FROM issues i JOIN devin_sessions ds ON ds.issue_id = i.id
                        WHERE ds.pr_url LIKE ?""",
                        (pr_url_pattern,),
                    )
                    issue_row = await issue_cursor.fetchone()
                    if issue_row:
                        total_time = ""
                        if issue_row[3]:
                            try:
                                from datetime import datetime
                                triaged = datetime.fromisoformat(issue_row[3])
                                elapsed = datetime.utcnow() - triaged
                                mins = int(elapsed.total_seconds() / 60)
                                if mins < 60:
                                    total_time = f"{mins}m"
                                elif mins < 1440:
                                    total_time = f"{mins // 60}h {mins % 60}m"
                                else:
                                    total_time = f"{mins // 1440}d {(mins % 1440) // 60}h"
                            except Exception:
                                pass
                        slack_svc = SlackService(webhook_url=slack_webhook)
                        await slack_svc.notify_pr_merged(
                            issue_title=issue_row[0],
                            issue_number=issue_row[1],
                            repo=issue_row[2],
                            pr_url=f"https://github.com/{owner}/{repo}/pull/{pr_number}",
                            total_time=total_time,
                        )
                        logger.info(f"Slack notification sent: pr_merged via merge_pr for {owner}/{repo}#{pr_number}")
            except Exception as slack_err:
                logger.error(f"Failed to send pr_merged notification from merge_pr: {slack_err}")

            return {
                "status": "merged",
                "message": merge_data.get("message", "PR merged successfully"),
                "sha": merge_data.get("sha", ""),
            }
        else:
            error_detail = merge_resp.json().get("message", merge_resp.text[:300])
            # Check if failure is due to merge conflicts — auto-resolve if enabled
            if merge_resp.status_code == 405 or "not mergeable" in error_detail.lower():
                # Check if auto-resolve is enabled in settings
                arc_cursor = await db.execute("SELECT auto_resolve_conflicts FROM settings WHERE id = 1")
                arc_row = await arc_cursor.fetchone()
                auto_resolve_enabled = bool(arc_row[0]) if arc_row and arc_row[0] is not None else True
                if auto_resolve_enabled:
                    try:
                        resolve_result = await _auto_resolve_conflicts(
                            db, pat, owner, repo, pr_number, pr_data, headers
                        )
                        if resolve_result:
                            return resolve_result
                    except Exception as resolve_err:
                        logger.error(f"Auto-resolve conflicts failed: {resolve_err}")
            raise HTTPException(
                status_code=merge_resp.status_code,
                detail=f"Failed to merge PR: {error_detail}",
            )


@router.post("/pr-resolve-conflicts/{owner}/{repo}/{pr_number}")
async def resolve_conflicts(
    owner: str,
    repo: str,
    pr_number: int,
    db: aiosqlite.Connection = Depends(get_db),
):
    """Manually trigger a Devin session to resolve merge conflicts for a PR."""
    pat = await get_github_pat(db)
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        pr_resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=headers,
        )
        if pr_resp.status_code != 200:
            raise HTTPException(status_code=pr_resp.status_code, detail=f"GitHub API error: {pr_resp.text[:300]}")
        pr_data = pr_resp.json()

    result = await _auto_resolve_conflicts(db, pat, owner, repo, pr_number, pr_data, headers)
    if result:
        return result
    raise HTTPException(status_code=500, detail="Failed to create conflict resolution session")


async def _auto_resolve_conflicts(
    db: aiosqlite.Connection,
    pat: str,
    owner: str,
    repo: str,
    pr_number: int,
    pr_data: dict,
    headers: dict,
) -> dict | None:
    """Spawn a Devin session to rebase and resolve merge conflicts for a PR.
    
    Returns a dict response if a resolve session was created, or None if not applicable.
    """
    head_branch = pr_data.get("head", {}).get("ref", "")
    base_branch = pr_data.get("base", {}).get("ref", "main")
    full_repo = f"{owner}/{repo}"

    if not head_branch:
        logger.warning(f"Cannot auto-resolve: no head branch found for PR #{pr_number}")
        return None

    # Get Devin API credentials
    cursor = await db.execute("SELECT devin_api_token, devin_org_id FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    devin_token = (row[0] if row else "") or ""
    devin_org_id = (row[1] if row else "") or ""
    if not devin_token:
        logger.warning("Cannot auto-resolve: no Devin API token configured")
        return None

    devin = DevinService(devin_token, org_id=devin_org_id)
    prompt = devin.build_conflict_resolve_prompt(
        repo=full_repo,
        pr_number=pr_number,
        head_branch=head_branch,
        base_branch=base_branch,
        github_pat=pat,
    )

    # Create Devin session to resolve conflicts
    try:
        session_data = await devin.create_session(
            prompt=prompt,
            idempotency_key=f"resolve-conflicts-{full_repo}-{pr_number}",
        )
    except Exception as e:
        logger.error(f"Failed to create conflict resolve session: {e}")
        return None

    session_id = session_data.get("session_id", "")
    session_url = session_data.get("url", f"https://app.devin.ai/sessions/{session_id}")

    # Find the local session record for this PR and update it
    pr_url_pattern = f"%/{owner}/{repo}/pull/{pr_number}%"
    await db.execute(
        """UPDATE devin_sessions
        SET status = 'running', status_detail = 'resolving_conflicts', updated_at = datetime('now')
        WHERE pr_url LIKE ?""",
        (pr_url_pattern,),
    )
    await db.commit()

    logger.info(
        f"Auto-resolve session created for {full_repo}#{pr_number}: {session_id}"
    )
    return {
        "status": "resolving_conflicts",
        "message": f"Merge conflicts detected. Devin is automatically resolving them (session: {session_id})",
        "session_id": session_id,
        "session_url": session_url,
    }
