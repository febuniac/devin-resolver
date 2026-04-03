import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from app.db.database import get_db
from app.models.schemas import DevinSessionCreate, DevinSessionResponse
from app.services.devin_service import DevinService

router = APIRouter(prefix="/api/devin", tags=["devin"])


async def get_devin_service(db: aiosqlite.Connection = Depends(get_db)) -> DevinService:
    cursor = await db.execute("SELECT devin_api_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    return DevinService(token)


def parse_session_row(row) -> DevinSessionResponse:
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
        recording_url=row[10],
    )


@router.get("/sessions", response_model=list[DevinSessionResponse])
async def list_sessions(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM devin_sessions ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [parse_session_row(row) for row in rows]


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
        result["live_status"] = live_status.get("status_enum", "unknown")
        result["session_url"] = live_status.get("url", result.get("session_url"))

        # Update local DB with live status
        if row:
            new_status = live_status.get("status_enum", row[5])
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
        prompt = devin.build_issue_prompt(issue_dict, issue_row[5])

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
        prompt = devin.build_security_prompt(finding_dict, finding_row[8])

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

    status = live_data.get("status_enum", "unknown")

    # Update local DB
    await db.execute(
        "UPDATE devin_sessions SET status = ?, updated_at = datetime('now') WHERE session_id = ?",
        (status, session_id),
    )

    # If session is finished, check for PR
    if status in ("finished", "stopped"):
        # Check if there's a structured output with PR info
        structured = live_data.get("structured_output", {})
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
