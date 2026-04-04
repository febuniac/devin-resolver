import logging
from fastapi import APIRouter, Depends, HTTPException
import httpx
import aiosqlite

from app.db.database import get_db

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
            await db.execute(
                """UPDATE devin_sessions SET status = 'merged', updated_at = datetime('now')
                WHERE pr_url LIKE ?""",
                (f"%/{owner}/{repo}/pull/{pr_number}%",),
            )
            # Also update the linked issue status
            await db.execute(
                """UPDATE issues SET status = 'resolved'
                WHERE id IN (
                    SELECT issue_id FROM devin_sessions WHERE pr_url LIKE ?
                )""",
                (f"%/{owner}/{repo}/pull/{pr_number}%",),
            )
            await db.commit()

            return {
                "status": "merged",
                "message": merge_data.get("message", "PR merged successfully"),
                "sha": merge_data.get("sha", ""),
            }
        else:
            error_detail = merge_resp.json().get("message", merge_resp.text[:300])
            raise HTTPException(
                status_code=merge_resp.status_code,
                detail=f"Failed to merge PR: {error_detail}",
            )
