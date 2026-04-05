from fastapi import APIRouter, Depends
import aiosqlite

from app.db.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
async def get_analytics(db: aiosqlite.Connection = Depends(get_db)):
    # Issues stats
    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status = 'resolved'")
    issues_resolved = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM issues WHERE status != 'resolved'")
    issues_open = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM issues")
    total_issues = (await cursor.fetchone())[0]

    # Security stats
    cursor = await db.execute("SELECT COUNT(*) FROM security_findings WHERE status = 'resolved'")
    security_fixed = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM security_findings WHERE status != 'resolved'")
    security_open = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM security_findings")
    total_findings = (await cursor.fetchone())[0]

    # Devin session stats
    cursor = await db.execute("SELECT COUNT(*) FROM devin_sessions")
    total_sessions = (await cursor.fetchone())[0]

    cursor = await db.execute("SELECT COUNT(*) FROM devin_sessions WHERE pr_url IS NOT NULL")
    prs_created = (await cursor.fetchone())[0]

    # Status breakdown for issues
    cursor = await db.execute("SELECT status, COUNT(*) FROM issues GROUP BY status")
    issue_status_breakdown = {row[0]: row[1] for row in await cursor.fetchall()}

    # Status breakdown for security findings
    cursor = await db.execute("SELECT status, COUNT(*) FROM security_findings GROUP BY status")
    finding_status_breakdown = {row[0]: row[1] for row in await cursor.fetchall()}

    # Category breakdown for issues
    cursor = await db.execute("SELECT category, COUNT(*) FROM issues GROUP BY category")
    category_breakdown = [
        {"name": row[0] or "unknown", "value": row[1]}
        for row in await cursor.fetchall()
    ]

    # Severity breakdown for security findings
    cursor = await db.execute("SELECT severity, COUNT(*) FROM security_findings GROUP BY severity")
    severity_breakdown = [
        {"name": row[0] or "unknown", "value": row[1]}
        for row in await cursor.fetchall()
    ]

    # Repos stats
    cursor = await db.execute("SELECT COUNT(*) FROM connected_repos")
    connected_repos = (await cursor.fetchone())[0]

    # Estimate hours saved (avg 3 hours per resolved issue)
    hours_saved = (issues_resolved + security_fixed) * 3.0

    # Compliance score
    remediation_rate = (security_fixed / total_findings * 100) if total_findings > 0 else 100
    compliance_score = min(100, round(remediation_rate * 1.05, 1))

    return {
        "issues_resolved": issues_resolved,
        "issues_open": issues_open,
        "total_issues": total_issues,
        "security_findings_fixed": security_fixed,
        "security_findings_open": security_open,
        "total_findings": total_findings,
        "total_sessions": total_sessions,
        "prs_created": prs_created,
        "prs_merged": issues_resolved,  # Approximate
        "engineer_hours_saved": hours_saved,
        "compliance_score": compliance_score,
        "connected_repos": connected_repos,
        "issue_status_breakdown": issue_status_breakdown,
        "finding_status_breakdown": finding_status_breakdown,
        "category_breakdown": category_breakdown,
        "severity_breakdown": severity_breakdown,
    }
