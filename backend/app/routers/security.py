from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import aiosqlite

from app.db.database import get_db
from app.models.schemas import SecurityFindingResponse, FindingApproval

router = APIRouter(prefix="/api/security", tags=["security"])


def parse_finding_row(row) -> SecurityFindingResponse:
    return SecurityFindingResponse(
        id=row[0],
        alert_number=row[1],
        rule=row[2] or "",
        rule_id=row[3] or "",
        severity=row[4] or "medium",
        file_path=row[5] or "",
        line_number=row[6] or 0,
        description=row[7] or "",
        repo_full_name=row[8],
        category=row[9] or "",
        cwe_id=row[10] or "",
        status=row[11] or "open",
        ai_summary=row[12] or "",
        ai_confidence=row[13] or 0,
        estimated_effort=row[14] or "",
        devin_session_id=row[15],
        devin_session_url=row[16],
        pr_url=row[17],
        pr_number=row[18],
        detected_at=row[19],
    )


@router.get("/findings", response_model=list[SecurityFindingResponse])
async def list_findings(
    repo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    query = "SELECT * FROM security_findings WHERE 1=1"
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
    if search:
        query += " AND (rule LIKE ? OR description LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [parse_finding_row(row) for row in rows]


@router.get("/findings/{finding_id}", response_model=SecurityFindingResponse)
async def get_finding(finding_id: int, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM security_findings WHERE id = ?", (finding_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Finding not found")
    return parse_finding_row(row)


@router.post("/findings/approve")
async def approve_findings(
    approval: FindingApproval,
    db: aiosqlite.Connection = Depends(get_db),
):
    approved = []
    for finding_id in approval.finding_ids:
        cursor = await db.execute(
            "SELECT id, status FROM security_findings WHERE id = ?", (finding_id,)
        )
        row = await cursor.fetchone()
        if not row:
            continue
        if row[1] in ("open", "triaged"):
            await db.execute(
                "UPDATE security_findings SET status = 'approved' WHERE id = ?",
                (finding_id,),
            )
            approved.append(finding_id)

    await db.commit()
    return {"approved": approved, "count": len(approved)}


@router.get("/compliance")
async def get_compliance(db: aiosqlite.Connection = Depends(get_db)):
    # Total findings
    cursor = await db.execute("SELECT COUNT(*) FROM security_findings")
    total = (await cursor.fetchone())[0]

    # By severity
    cursor = await db.execute(
        "SELECT severity, COUNT(*) FROM security_findings GROUP BY severity"
    )
    by_severity = {row[0]: row[1] for row in await cursor.fetchall()}

    # By status
    cursor = await db.execute(
        "SELECT status, COUNT(*) FROM security_findings GROUP BY status"
    )
    by_status = {row[0]: row[1] for row in await cursor.fetchall()}

    resolved = by_status.get("resolved", 0)
    remediation_rate = (resolved / total * 100) if total > 0 else 0

    return {
        "total_findings": total,
        "by_severity": by_severity,
        "by_status": by_status,
        "remediation_rate": round(remediation_rate, 1),
        "critical_open": by_severity.get("critical", 0) - by_status.get("resolved", 0),
        "compliance_score": min(100, round(remediation_rate * 1.1, 1)),
    }
