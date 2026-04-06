# BacklogZero

**Autonomous issue remediation powered by Devin AI.** BacklogZero triages your GitHub backlog, routes issues to the Devin AI software engineer, and manages the full lifecycle from triage to merged PR — with optional auto-approve, Slack notifications, and auto-generated wiki documentation.

![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.135-green) ![Vite](https://img.shields.io/badge/Vite-6-purple) ![SQLite](https://img.shields.io/badge/SQLite-aiosqlite-orange)

## Features

### Core Pipeline

- **AI-Driven Triage** — Syncs GitHub issues and CodeQL security alerts, then categorizes by severity, category, confidence score, and estimated effort.
- **Human-in-the-Loop Approval** — Bulk-approve triaged issues to dispatch them to Devin for autonomous resolution.
- **Devin Session Management** — Monitors running sessions in real time with live timelines, to-do lists, messages, and file-change tracking.
- **PR Review & Merge** — Inline diff viewer, PR commenting, and one-click squash merge — all from inside BacklogZero.

### Auto-Approve via Devin Review

- **Devin Review as quality gate** — Every PR is reviewed by Devin Review for code quality, security vulnerabilities, and potential bugs before auto-approve can trigger.
- **Configurable policy** — Set a minimum confidence threshold (50-100%) and maximum severity level (`low` / `medium` / `high` / `critical`).
- **Settings** — `auto_approve_enabled`, `auto_approve_confidence`, `auto_approve_max_severity` columns in the `settings` table (`backend/app/db/database.py`).
- **Frontend** — Toggle and configure in **Settings > Auto-Approve Mode** (`src/pages/Settings.tsx`).
- **Auto-merge logic** — When enabled, the Approvals page automatically merges PR-ready sessions that pass the policy (`src/pages/Approvals.tsx`).

### Slack Notifications

Seven notification types delivered via Slack Block Kit through the `SlackService` class (`backend/app/services/slack_service.py`):

| # | Notification | Method | Trigger Point |
|---|---|---|---|
| 1 | New Issue Triaged | `notify_issue_triaged` | `issues.py` — after sync-and-triage |
| 2 | Issue Sent to Devin | `notify_issue_sent_to_devin` | `issues.py` — after session creation |
| 3 | Devin Needs Input | `notify_devin_needs_input` | `devin_sessions.py` — poll detects `waiting_for_user` |
| 4 | PR Ready for Review | `notify_pr_ready` | `devin_sessions.py` — poll detects finished session with PR |
| 5 | PR Merged / Resolved | `notify_pr_merged` | `github_pr.py` — after merge or merged-PR detection |
| 6 | Devin Session Failed | `notify_session_failed` | `devin_sessions.py` — poll detects `error`/`suspended` |
| 7 | Daily Summary Digest | `notify_daily_summary` | On-demand via **Integrations** page or API |

- **Per-notification toggles** — Stored in `settings.notifications` JSON column; configurable in **Integrations > Slack Notification Preferences** (`src/pages/Integrations.tsx`).
- **Webhook setup** — Provide a Slack Incoming Webhook URL in **Integrations**.

### Wiki Generator

- **Auto-generated documentation** — Analyzes repository structure, README, tech stack, and contributors to produce multi-page markdown wikis.
- **Frontend** — Repo selector, generate/regenerate button, sidebar page navigation, and inline markdown renderer (`src/pages/Wiki.tsx`).
- **API endpoints**:
  - `GET /api/wiki/repos` — List repos with generated wikis
  - `GET /api/wiki/{owner}/{name}` — Fetch wiki pages for a repo
  - `POST /api/wiki/{owner}/{name}/generate` — Generate/regenerate wiki for a repo
  - `POST /api/wiki/generate-all` — Regenerate wikis for all connected repos

### Security & Compliance

- **CodeQL Integration** — Auto-imports security findings from GitHub CodeQL; routes critical/high findings to Devin.
- **Audit Report** — Executive-level compliance report with severity breakdown and PDF export.
- **Security Dashboard** — Vulnerability remediation tracking and audit readiness metrics.

### Analytics & Observability

- **Dashboard** — ROI metrics, backlog burn rate, parallel fleet utilization, and cost tracking (ACU-based).
- **Analytics** — Historical trends, category breakdowns, and resolution time charts.

## Architecture

```
Frontend (React + Vite + TypeScript + Tailwind CSS)
├── src/api/client.ts          # Centralized API singleton
├── src/pages/                 # Dashboard, IssueTriage, Approvals, Security,
│                              # Settings, Integrations, Wiki, Analytics, AuditReport
├── src/components/layout/     # Sidebar, Layout, ThemeContext
└── src/components/ui/         # MetricCard, StatusBadge, ConfidenceMeter, WorkflowPipeline

Backend (FastAPI + aiosqlite + Python 3.12)
├── backend/app/main.py        # App entry point, router registration
├── backend/app/db/database.py # SQLite schema, migrations, connection helpers
├── backend/app/routers/       # issues, devin_sessions, github_pr, repos,
│                              # security, settings, analytics, slack
├── backend/app/services/      # DevinService, GitHubService, SlackService
└── backend/app/models/        # Pydantic schemas
```

### Data Model

| Table | Purpose |
|---|---|
| `connected_repos` | GitHub repositories being tracked |
| `issues` | Synced GitHub issues with AI triage metadata |
| `security_findings` | CodeQL alerts with remediation status |
| `devin_sessions` | Devin AI session tracking (status, PR URLs, recordings) |
| `session_events` | Cached Devin activity (todos, messages, status) |
| `settings` | Singleton config row (tokens, auto-approve policy, notification prefs) |

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.12+ and [**Poetry**](https://python-poetry.org/)

### Backend Setup

```bash
cd backend
poetry install
poetry shell
fastapi dev app/main.py
```

The API server starts at `http://localhost:8000`.

### Frontend Setup

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies API requests to the backend.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Backend API base URL (frontend) | `http://localhost:8000` |
| `DATABASE_PATH` | SQLite database file path (backend) | `devin_resolver.db` (or `/data/app.db` if `/data` exists) |

All other configuration (GitHub tokens, Devin API keys, Slack webhooks) is managed through the **Integrations** page in the UI and stored in the `settings` database table.

### First-Time Configuration

1. Start both the backend and frontend.
2. Navigate to **Integrations** and configure:
   - **GitHub Token** — Classic PAT with `repo` + `security_events` scopes (for reading issues/alerts).
   - **GitHub PAT** — Classic PAT with `repo` scope (injected into Devin sessions for push access).
   - **Devin API Token** — Service user key (`cog_...`) from [app.devin.ai/settings](https://app.devin.ai/settings).
   - **Organization ID** — Devin org ID (`org-...`).
   - **Slack Webhook URL** *(optional)* — For notifications.
3. Go to **Settings** and add repositories in `owner/repo` format.
4. Click **Sync GitHub** on the **Issue Triage** page to import and triage issues.

## Development

```bash
# Lint frontend
npm run lint

# Type-check frontend
npx tsc -b

# Build frontend for production
npm run build
```

## License

This project is proprietary. All rights reserved.
