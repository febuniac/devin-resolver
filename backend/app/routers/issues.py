import json
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import aiosqlite

from app.db.database import get_db
from app.models.schemas import IssueResponse, IssueApproval, IssueRejection

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


@router.post("/approve")
async def approve_issues(
    approval: IssueApproval,
    db: aiosqlite.Connection = Depends(get_db),
):
    approved = []
    for issue_id in approval.issue_ids:
        cursor = await db.execute("SELECT id, status FROM issues WHERE id = ?", (issue_id,))
        row = await cursor.fetchone()
        if not row:
            continue
        if row[1] in ("open", "triaged"):
            await db.execute(
                "UPDATE issues SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
                (issue_id,),
            )
            approved.append(issue_id)

    await db.commit()
    return {"approved": approved, "count": len(approved)}


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
