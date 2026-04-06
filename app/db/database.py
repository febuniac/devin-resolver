import aiosqlite
import json
from pathlib import Path

import os
DB_PATH = os.environ.get("DATABASE_PATH", "/data/app.db" if os.path.isdir("/data") else "devin_resolver.db")


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def get_db_connection():
    """Get a standalone DB connection (not a generator/dependency)."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS connected_repos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner TEXT NOT NULL,
                name TEXT NOT NULL,
                full_name TEXT NOT NULL UNIQUE,
                language TEXT DEFAULT '',
                default_branch TEXT DEFAULT 'main',
                open_issues_count INTEGER DEFAULT 0,
                connected_at TEXT DEFAULT (datetime('now')),
                last_sync TEXT,
                sync_enabled INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_id INTEGER UNIQUE,
                number INTEGER NOT NULL,
                title TEXT NOT NULL,
                body TEXT DEFAULT '',
                repo_full_name TEXT NOT NULL,
                labels TEXT DEFAULT '[]',
                state TEXT DEFAULT 'open',
                author TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT,
                severity TEXT DEFAULT 'medium',
                category TEXT DEFAULT 'bug',
                status TEXT DEFAULT 'open',
                ai_confidence INTEGER DEFAULT 0,
                ai_summary TEXT DEFAULT '',
                estimated_effort TEXT DEFAULT '',
                devin_session_id TEXT,
                devin_session_url TEXT,
                pr_url TEXT,
                pr_number INTEGER,
                slack_notified INTEGER DEFAULT 0,
                video_url TEXT,
                triaged_at TEXT,
                approved_at TEXT,
                resolved_at TEXT,
                FOREIGN KEY (repo_full_name) REFERENCES connected_repos(full_name)
            );

            CREATE TABLE IF NOT EXISTS security_findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_number INTEGER,
                rule TEXT NOT NULL,
                rule_id TEXT DEFAULT '',
                severity TEXT DEFAULT 'medium',
                file_path TEXT DEFAULT '',
                line_number INTEGER DEFAULT 0,
                description TEXT DEFAULT '',
                repo_full_name TEXT NOT NULL,
                category TEXT DEFAULT '',
                cwe_id TEXT DEFAULT '',
                status TEXT DEFAULT 'open',
                ai_summary TEXT DEFAULT '',
                ai_confidence INTEGER DEFAULT 0,
                estimated_effort TEXT DEFAULT '',
                devin_session_id TEXT,
                devin_session_url TEXT,
                pr_url TEXT,
                pr_number INTEGER,
                detected_at TEXT,
                resolved_at TEXT,
                FOREIGN KEY (repo_full_name) REFERENCES connected_repos(full_name)
            );

            CREATE TABLE IF NOT EXISTS devin_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE,
                session_url TEXT,
                issue_id INTEGER,
                finding_id INTEGER,
                status TEXT DEFAULT 'pending',
                status_detail TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT,
                pr_url TEXT,
                pr_number INTEGER,
                recording_url TEXT,
                FOREIGN KEY (issue_id) REFERENCES issues(id),
                FOREIGN KEY (finding_id) REFERENCES security_findings(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                github_token TEXT DEFAULT '',
                devin_api_token TEXT DEFAULT '',
                devin_org_id TEXT DEFAULT '',
                slack_webhook_url TEXT DEFAULT '',
                slack_channels TEXT DEFAULT '[]',
                auto_approve_enabled INTEGER DEFAULT 0,
                auto_approve_confidence INTEGER DEFAULT 90,
                auto_approve_max_severity TEXT DEFAULT 'medium',
                codeql_enabled INTEGER DEFAULT 1,
                scan_frequency TEXT DEFAULT 'daily',
                notifications TEXT DEFAULT '{"new_issue_triaged": true, "issue_sent_to_devin": true, "devin_needs_input": true, "pr_ready_for_review": true, "pr_merged": true, "devin_session_failed": true, "daily_summary": false}'
            );

            INSERT OR IGNORE INTO settings (id) VALUES (1);
        """)

        # Migration: add devin_org_id column if it doesn't exist
        cursor = await db.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "devin_org_id" not in columns:
            await db.execute("ALTER TABLE settings ADD COLUMN devin_org_id TEXT DEFAULT ''")

        # Migration: add github_pat column for repo write access
        cursor = await db.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "github_pat" not in columns:
            await db.execute("ALTER TABLE settings ADD COLUMN github_pat TEXT DEFAULT ''")


        # Migration: add auto_resolve_conflicts column to settings
        cursor = await db.execute("PRAGMA table_info(settings)")
        columns = [row[1] for row in await cursor.fetchall()]
        if "auto_resolve_conflicts" not in columns:
            await db.execute("ALTER TABLE settings ADD COLUMN auto_resolve_conflicts INTEGER DEFAULT 1")

        # Migration: add status_detail column to devin_sessions if it doesn't exist
        cursor = await db.execute("PRAGMA table_info(devin_sessions)")
        ds_columns = [row[1] for row in await cursor.fetchall()]
        if "status_detail" not in ds_columns:
            await db.execute("ALTER TABLE devin_sessions ADD COLUMN status_detail TEXT DEFAULT ''")

        # Session events cache table for storing Devin activity (todos, messages, status)
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS session_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data TEXT DEFAULT '{}',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (session_id) REFERENCES devin_sessions(session_id)
            );
            CREATE INDEX IF NOT EXISTS idx_session_events_sid ON session_events(session_id);
        """)

        # Wiki pages table — auto-generated documentation per repo
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS wiki_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repo_full_name TEXT NOT NULL,
                slug TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                sort_order INTEGER DEFAULT 0,
                generated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(repo_full_name, slug),
                FOREIGN KEY (repo_full_name) REFERENCES connected_repos(full_name)
            );
            CREATE INDEX IF NOT EXISTS idx_wiki_repo ON wiki_pages(repo_full_name);
        """)

        await db.commit()
