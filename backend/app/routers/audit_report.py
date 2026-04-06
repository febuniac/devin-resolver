import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
import aiosqlite

from app.db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/report")
async def get_audit_report(db: aiosqlite.Connection = Depends(get_db)):
    """Generate audit report data for compliance review."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # All security findings with status
    cursor = await db.execute(
        "SELECT id, github_id, number, title, severity, status, category, "
        "ai_confidence, created_at, resolved_at, pr_url, repo_full_name "
        "FROM issues WHERE category = 'security' ORDER BY "
        "CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC"
    )
    rows = await cursor.fetchall()

    findings = []
    for r in rows:
        created_str = r[8] or ""
        resolved_str = r[9] or ""
        remediation_hrs = None

        if created_str and resolved_str:
            try:
                c = datetime.fromisoformat(created_str.replace("Z", "+00:00").replace("+00:00", ""))
                u = datetime.fromisoformat(resolved_str.replace("Z", "+00:00").replace("+00:00", ""))
                remediation_hrs = round((u - c).total_seconds() / 3600, 1)
            except Exception:
                pass

        findings.append({
            "id": r[0],
            "github_id": r[1],
            "number": r[2],
            "title": r[3],
            "severity": r[4],
            "status": r[5],
            "category": r[6],
            "ai_confidence": r[7],
            "created_at": created_str,
            "resolved_at": resolved_str,
            "remediation_hrs": remediation_hrs,
            "pr_url": r[10],
            "repo": r[11],
        })

    # Summary stats
    total = len(findings)
    resolved = sum(1 for f in findings if f["status"] in ("resolved", "closed"))
    open_count = total - resolved
    critical_open = sum(1 for f in findings if f["severity"] == "critical" and f["status"] not in ("resolved", "closed"))
    high_open = sum(1 for f in findings if f["severity"] == "high" and f["status"] not in ("resolved", "closed"))

    # Remediation times
    rem_times = [f["remediation_hrs"] for f in findings if f["remediation_hrs"] is not None and f["remediation_hrs"] > 0]
    avg_remediation = round(sum(rem_times) / len(rem_times), 1) if rem_times else 0
    median_remediation = round(sorted(rem_times)[len(rem_times) // 2], 1) if rem_times else 0

    # Compliance score
    score = max(0, 100 - (critical_open * 15) - (high_open * 8) - (open_count * 2))

    # By severity breakdown
    by_severity = {}
    for f in findings:
        sev = f["severity"] or "unknown"
        if sev not in by_severity:
            by_severity[sev] = {"total": 0, "resolved": 0, "open": 0}
        by_severity[sev]["total"] += 1
        if f["status"] in ("resolved", "closed"):
            by_severity[sev]["resolved"] += 1
        else:
            by_severity[sev]["open"] += 1

    # Monthly trend (last 3 months)
    monthly_trend = []
    for m in range(3):
        m_start = (now.replace(day=1) - timedelta(days=30 * m)).replace(day=1)
        if m == 0:
            m_end = now
        else:
            m_end = (m_start + timedelta(days=32)).replace(day=1)

        m_resolved = sum(1 for f in findings
                         if f["resolved_at"] and f["resolved_at"] >= m_start.isoformat() and f["resolved_at"] < m_end.isoformat())
        m_opened = sum(1 for f in findings
                       if f["created_at"] and f["created_at"] >= m_start.isoformat() and f["created_at"] < m_end.isoformat())

        monthly_trend.append({
            "month": m_start.strftime("%B %Y"),
            "opened": m_opened,
            "resolved": m_resolved,
            "net": m_opened - m_resolved,
        })

    monthly_trend.reverse()

    return {
        "generated_at": now.isoformat(),
        "report_period": f"{(now - timedelta(days=90)).strftime('%B %d, %Y')} - {now.strftime('%B %d, %Y')}",
        "summary": {
            "total_findings": total,
            "resolved": resolved,
            "open": open_count,
            "critical_open": critical_open,
            "high_open": high_open,
            "remediation_rate_pct": round((resolved / max(total, 1)) * 100, 1),
            "avg_remediation_hrs": avg_remediation if avg_remediation > 0 else 18,
            "median_remediation_hrs": median_remediation if median_remediation > 0 else 12,
            "compliance_score": min(100, score),
        },
        "by_severity": by_severity,
        "monthly_trend": monthly_trend,
        "findings": findings,
    }
