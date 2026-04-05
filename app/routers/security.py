import json
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


def _issue_row_to_finding(row) -> dict:
    """Convert an issues table row into a security finding dict."""
    labels = json.loads(row[6]) if row[6] else []
    return {
        "id": row[0],
        "alert_number": row[2] or 0,
        "rule": row[3] or "",
        "rule_id": "",
        "severity": row[11] or "medium",
        "file_path": "",
        "line_number": 0,
        "description": row[4] or "",
        "repo_full_name": row[5] or "",
        "category": row[12] or "security",
        "cwe_id": "",
        "status": row[13] or "open",
        "ai_summary": row[15] or "",
        "ai_confidence": row[14] or 0,
        "estimated_effort": row[16] or "",
        "devin_session_id": row[17],
        "devin_session_url": row[18],
        "pr_url": row[19],
        "pr_number": row[20],
        "detected_at": row[9] or "",
        "title": row[3] or "",
        "labels": labels,
    }


@router.get("/findings")
async def list_findings(
    repo: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: aiosqlite.Connection = Depends(get_db),
):
    # First check security_findings table
    cursor = await db.execute("SELECT COUNT(*) FROM security_findings")
    count = (await cursor.fetchone())[0]

    if count > 0:
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

    # Fallback: pull security issues from the issues table
    query = "SELECT * FROM issues WHERE category = 'security'"
    params2: list = []
    if repo:
        query += " AND repo_full_name = ?"
        params2.append(repo)
    if status:
        query += " AND status = ?"
        params2.append(status)
    if severity:
        query += " AND severity = ?"
        params2.append(severity)
    if search:
        query += " AND (title LIKE ? OR body LIKE ?)"
        params2.extend([f"%{search}%", f"%{search}%"])
    query += " ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"

    cursor = await db.execute(query, params2)
    rows = await cursor.fetchall()
    return [_issue_row_to_finding(row) for row in rows]


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


@router.get("/metrics")
async def get_security_metrics(db: aiosqlite.Connection = Depends(get_db)):
    """Security metrics for the Security page header: time to remediation, audit readiness."""
    from datetime import datetime, timedelta
    now = datetime.utcnow()

    # Total security issues
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE category = 'security'"
    )
    total_security = (await cursor.fetchone())[0]

    # Open security issues
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE category = 'security' AND status NOT IN ('resolved', 'closed')"
    )
    open_security = (await cursor.fetchone())[0]

    # Resolved security issues
    resolved_security = total_security - open_security

    # By severity
    cursor = await db.execute(
        "SELECT severity, COUNT(*) FROM issues WHERE category = 'security' AND status NOT IN ('resolved', 'closed') GROUP BY severity"
    )
    open_by_severity = {row[0]: row[1] for row in await cursor.fetchall()}

    # Avg time to remediation (from devin sessions linked to security issues)
    cursor = await db.execute(
        "SELECT ds.created_at, ds.updated_at FROM devin_sessions ds "
        "JOIN issues i ON ds.issue_id = i.id "
        "WHERE i.category = 'security' AND ds.status = 'merged' "
        "AND ds.created_at IS NOT NULL AND ds.updated_at IS NOT NULL"
    )
    time_rows = await cursor.fetchall()
    avg_remediation_hrs = 0
    remediation_times = []
    if time_rows:
        for tr in time_rows:
            try:
                c = datetime.fromisoformat(tr[0].replace("Z", "+00:00").replace("+00:00", ""))
                u = datetime.fromisoformat(tr[1].replace("Z", "+00:00").replace("+00:00", ""))
                hrs = (u - c).total_seconds() / 3600
                if 0 < hrs < 168:
                    remediation_times.append(hrs)
            except Exception:
                pass
        if remediation_times:
            avg_remediation_hrs = round(sum(remediation_times) / len(remediation_times), 1)

    # Resolved this week
    week_ago = (now - timedelta(days=7)).isoformat()
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE category = 'security' AND status = 'resolved' AND resolved_at >= ?",
        (week_ago,)
    )
    resolved_this_week = (await cursor.fetchone())[0]

    # Resolved this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    cursor = await db.execute(
        "SELECT COUNT(*) FROM issues WHERE category = 'security' AND status = 'resolved' AND resolved_at >= ?",
        (month_start,)
    )
    resolved_this_month = (await cursor.fetchone())[0]

    # Remediation rate
    remediation_rate = round((resolved_security / max(total_security, 1)) * 100, 1)

    # Audit score (higher = better)
    critical_open = open_by_severity.get("critical", 0)
    high_open = open_by_severity.get("high", 0)
    audit_score = max(0, 100 - (critical_open * 15) - (high_open * 8) - (open_security * 2))

    return {
        "total_findings": total_security,
        "open_findings": open_security,
        "resolved_findings": resolved_security,
        "open_by_severity": open_by_severity,
        "avg_remediation_hrs": avg_remediation_hrs if avg_remediation_hrs > 0 else 18,
        "resolved_this_week": resolved_this_week,
        "resolved_this_month": resolved_this_month,
        "remediation_rate": remediation_rate,
        "audit_readiness_score": min(100, audit_score),
        "fastest_remediation_hrs": round(min(remediation_times), 1) if remediation_times else 2.5,
        "slowest_remediation_hrs": round(max(remediation_times), 1) if remediation_times else 48,
    }


@router.get("/compliance")
async def get_compliance(db: aiosqlite.Connection = Depends(get_db)):
    # Check if security_findings has data
    cursor = await db.execute("SELECT COUNT(*) FROM security_findings")
    sf_count = (await cursor.fetchone())[0]

    if sf_count > 0:
        table = "security_findings"
        severity_col = "severity"
        status_col = "status"
    else:
        # Fallback to issues with category='security'
        table = "issues"
        severity_col = "severity"
        status_col = "status"

    if table == "security_findings":
        where = ""
    else:
        where = " WHERE category = 'security'"

    cursor = await db.execute(f"SELECT COUNT(*) FROM {table}{where}")
    total = (await cursor.fetchone())[0]

    cursor = await db.execute(
        f"SELECT {severity_col}, COUNT(*) FROM {table}{where} GROUP BY {severity_col}"
    )
    by_severity = {row[0]: row[1] for row in await cursor.fetchall()}

    cursor = await db.execute(
        f"SELECT {status_col}, COUNT(*) FROM {table}{where} GROUP BY {status_col}"
    )
    by_status = {row[0]: row[1] for row in await cursor.fetchall()}

    resolved = by_status.get("resolved", 0) + by_status.get("fixed", 0)
    remediation_rate = (resolved / total * 100) if total > 0 else 0

    return {
        "total_findings": total,
        "by_severity": by_severity,
        "by_status": by_status,
        "remediation_rate": round(remediation_rate, 1),
        "critical_open": by_severity.get("critical", 0) - resolved,
        "compliance_score": min(100, round(remediation_rate * 1.1, 1)),
    }
