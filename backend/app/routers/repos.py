import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from app.db.database import get_db
from app.models.schemas import RepoConnect, RepoResponse
from app.services.github_service import GitHubService

router = APIRouter(prefix="/api/repos", tags=["repositories"])


async def get_github_service(db: aiosqlite.Connection = Depends(get_db)) -> GitHubService:
    cursor = await db.execute("SELECT github_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    return GitHubService(token)


@router.get("", response_model=list[RepoResponse])
async def list_repos(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM connected_repos ORDER BY connected_at DESC")
    rows = await cursor.fetchall()
    repos = []
    for row in rows:
        repos.append(RepoResponse(
            id=row[0],
            owner=row[1],
            name=row[2],
            full_name=row[3],
            language=row[4] or "",
            default_branch=row[5] or "main",
            open_issues_count=row[6] or 0,
            connected_at=row[7] or "",
            last_sync=row[8],
            sync_enabled=bool(row[9]),
        ))
    return repos


@router.post("", response_model=RepoResponse)
async def connect_repo(
    repo: RepoConnect,
    db: aiosqlite.Connection = Depends(get_db),
    github: GitHubService = Depends(get_github_service),
):
    # Check if already connected
    cursor = await db.execute(
        "SELECT id FROM connected_repos WHERE full_name = ?",
        (f"{repo.owner}/{repo.name}",),
    )
    if await cursor.fetchone():
        raise HTTPException(status_code=400, detail="Repository already connected")

    # Fetch repo info from GitHub
    try:
        gh_repo = await github.get_repo(repo.owner, repo.name)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not access repository: {str(e)}. Check your GitHub token and repo name.",
        )

    # Insert into database
    cursor = await db.execute(
        """INSERT INTO connected_repos (owner, name, full_name, language, default_branch, open_issues_count)
        VALUES (?, ?, ?, ?, ?, ?)""",
        (
            repo.owner,
            repo.name,
            gh_repo.get("full_name", f"{repo.owner}/{repo.name}"),
            gh_repo.get("language", ""),
            gh_repo.get("default_branch", "main"),
            gh_repo.get("open_issues_count", 0),
        ),
    )
    await db.commit()

    new_id = cursor.lastrowid
    cursor = await db.execute("SELECT * FROM connected_repos WHERE id = ?", (new_id,))
    row = await cursor.fetchone()

    return RepoResponse(
        id=row[0],
        owner=row[1],
        name=row[2],
        full_name=row[3],
        language=row[4] or "",
        default_branch=row[5] or "main",
        open_issues_count=row[6] or 0,
        connected_at=row[7] or "",
        last_sync=row[8],
        sync_enabled=bool(row[9]),
    )


@router.delete("/{repo_id}")
async def disconnect_repo(repo_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM connected_repos WHERE id = ?", (repo_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.execute("DELETE FROM connected_repos WHERE id = ?", (repo_id,))
    await db.commit()
    return {"message": "Repository disconnected"}


@router.post("/{repo_id}/sync")
async def sync_repo(
    repo_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    github: GitHubService = Depends(get_github_service),
):
    cursor = await db.execute("SELECT * FROM connected_repos WHERE id = ?", (repo_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Repository not found")

    owner, name, full_name = row[1], row[2], row[3]

    # Fetch latest issues from GitHub
    try:
        issues = await github.list_issues(owner, name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to sync: {str(e)}")

    synced_count = 0
    for issue in issues:
        github_id = issue["id"]
        # Check if issue already exists
        cursor = await db.execute("SELECT id FROM issues WHERE github_id = ?", (github_id,))
        existing = await cursor.fetchone()

        labels = json.dumps([l["name"] for l in issue.get("labels", [])])

        if existing:
            await db.execute(
                """UPDATE issues SET title = ?, body = ?, labels = ?, state = ?,
                updated_at = ? WHERE github_id = ?""",
                (
                    issue["title"],
                    issue.get("body", ""),
                    labels,
                    issue["state"],
                    issue.get("updated_at", ""),
                    github_id,
                ),
            )
        else:
            await db.execute(
                """INSERT INTO issues (github_id, number, title, body, repo_full_name,
                labels, state, author, created_at, updated_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')""",
                (
                    github_id,
                    issue["number"],
                    issue["title"],
                    issue.get("body", ""),
                    full_name,
                    labels,
                    issue["state"],
                    issue.get("user", {}).get("login", ""),
                    issue.get("created_at", ""),
                    issue.get("updated_at", ""),
                ),
            )
            synced_count += 1

    # Sync security findings (CodeQL)
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
                    (
                        alert_number,
                        rule.get("description", ""),
                        rule.get("id", ""),
                        alert.get("rule", {}).get("security_severity_level", "medium"),
                        location.get("path", ""),
                        location.get("start_line", 0),
                        rule.get("full_description", rule.get("description", "")),
                        full_name,
                        rule.get("tags", [""])[0] if rule.get("tags") else "",
                        ",".join(
                            f"CWE-{c.get('cwe_id', '')}"
                            for c in rule.get("cwes", [])
                        ) if rule.get("cwes") else "",
                        alert.get("created_at", ""),
                    ),
                )
                security_count += 1
    except Exception:
        pass  # CodeQL might not be enabled

    # Update last_sync and open_issues_count
    await db.execute(
        """UPDATE connected_repos SET last_sync = datetime('now'),
        open_issues_count = ? WHERE id = ?""",
        (len(issues), repo_id),
    )
    await db.commit()

    return {
        "message": f"Synced {synced_count} new issues and {security_count} new security findings",
        "issues_synced": synced_count,
        "security_synced": security_count,
    }
