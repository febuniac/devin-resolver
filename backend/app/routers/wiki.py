import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import aiosqlite

from app.db.database import get_db
from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wiki", tags=["wiki"])


async def _get_github(db: aiosqlite.Connection) -> GitHubService:
    cursor = await db.execute("SELECT github_token FROM settings WHERE id = 1")
    row = await cursor.fetchone()
    token = row[0] if row and row[0] else ""
    return GitHubService(token)


def _build_tree_summary(tree: list[dict]) -> str:
    """Build a concise directory-structure summary from a flat file list."""
    dirs: dict[str, list[str]] = {}
    for item in tree:
        parts = item["path"].split("/")
        if len(parts) == 1:
            dirs.setdefault(".", []).append(parts[0])
        else:
            top = parts[0]
            dirs.setdefault(top, []).append("/".join(parts[1:]))

    lines = []
    for d in sorted(dirs.keys()):
        files = dirs[d]
        if d == ".":
            for f in sorted(files):
                lines.append(f)
        else:
            lines.append(f"{d}/")
            # Show first-level children only
            children = set()
            for f in files:
                child = f.split("/")[0]
                children.add(child)
            for c in sorted(children):
                is_dir = any("/" in f for f in files if f.startswith(c + "/"))
                lines.append(f"  {c}{'/' if is_dir else ''}")
    return "\n".join(lines)


def _detect_tech_stack(tree: list[dict], languages: dict, readme: str) -> list[dict]:
    """Detect tech stack from file tree and languages."""
    stack = []
    file_names = {item["path"].split("/")[-1] for item in tree}
    paths = {item["path"] for item in tree}

    # Languages from GitHub
    total = sum(languages.values()) or 1
    for lang, bytes_count in sorted(languages.items(), key=lambda x: -x[1]):
        pct = round(bytes_count / total * 100, 1)
        if pct >= 1:
            stack.append({"name": lang, "type": "language", "detail": f"{pct}%"})

    # Frameworks / tools
    if "package.json" in file_names:
        stack.append({"name": "Node.js", "type": "runtime", "detail": "package.json"})
    if "next.config.js" in file_names or "next.config.ts" in file_names or "next.config.mjs" in file_names:
        stack.append({"name": "Next.js", "type": "framework", "detail": "next.config"})
    if "vite.config.ts" in file_names or "vite.config.js" in file_names:
        stack.append({"name": "Vite", "type": "build", "detail": "vite.config"})
    if "requirements.txt" in file_names or "pyproject.toml" in file_names:
        stack.append({"name": "Python", "type": "runtime", "detail": "deps file"})
    if "Cargo.toml" in file_names:
        stack.append({"name": "Rust", "type": "runtime", "detail": "Cargo.toml"})
    if "go.mod" in file_names:
        stack.append({"name": "Go", "type": "runtime", "detail": "go.mod"})
    if "Dockerfile" in file_names or "docker-compose.yml" in file_names or "docker-compose.yaml" in file_names:
        stack.append({"name": "Docker", "type": "infra", "detail": "Dockerfile"})
    if any(p.endswith(".tf") for p in paths):
        stack.append({"name": "Terraform", "type": "infra", "detail": ".tf files"})
    if ".github/workflows" in paths or any(p.startswith(".github/workflows/") for p in paths):
        stack.append({"name": "GitHub Actions", "type": "ci", "detail": ".github/workflows"})
    if "tsconfig.json" in file_names:
        stack.append({"name": "TypeScript", "type": "language", "detail": "tsconfig.json"})
    if "tailwind.config.js" in file_names or "tailwind.config.ts" in file_names:
        stack.append({"name": "Tailwind CSS", "type": "styling", "detail": "tailwind.config"})
    if ".eslintrc" in file_names or ".eslintrc.js" in file_names or ".eslintrc.json" in file_names or "eslint.config.js" in file_names:
        stack.append({"name": "ESLint", "type": "linting", "detail": "eslint config"})
    if "jest.config.js" in file_names or "jest.config.ts" in file_names:
        stack.append({"name": "Jest", "type": "testing", "detail": "jest.config"})

    return stack


def _detect_modules(tree: list[dict]) -> list[dict]:
    """Detect key directories/modules from file tree."""
    top_dirs: dict[str, int] = {}
    for item in tree:
        parts = item["path"].split("/")
        if len(parts) > 1 and not parts[0].startswith("."):
            top_dirs[parts[0]] = top_dirs.get(parts[0], 0) + 1

    modules = []
    descriptions = {
        "src": "Source code",
        "lib": "Library code",
        "app": "Application code",
        "api": "API endpoints",
        "components": "UI components",
        "pages": "Page components / routes",
        "services": "Service layer / business logic",
        "utils": "Utility functions",
        "helpers": "Helper functions",
        "models": "Data models",
        "schemas": "Schema definitions",
        "types": "Type definitions",
        "hooks": "React hooks",
        "context": "React context providers",
        "middleware": "Middleware layer",
        "config": "Configuration files",
        "scripts": "Build / utility scripts",
        "tests": "Test files",
        "test": "Test files",
        "__tests__": "Test files",
        "docs": "Documentation",
        "public": "Static assets",
        "assets": "Static assets",
        "styles": "Stylesheets",
        "db": "Database layer",
        "database": "Database layer",
        "migrations": "Database migrations",
        "routes": "Route handlers",
        "routers": "API routers",
        "controllers": "Controller layer",
        "views": "View layer",
        "templates": "HTML templates",
        "static": "Static files",
        "dist": "Build output",
        "build": "Build output",
    }

    for d, count in sorted(top_dirs.items(), key=lambda x: -x[1]):
        desc = descriptions.get(d.lower(), f"{count} files")
        modules.append({"name": d, "files": count, "description": desc})

    return modules[:15]  # Top 15


async def _generate_wiki_for_repo(
    db: aiosqlite.Connection,
    github: GitHubService,
    owner: str,
    name: str,
    full_name: str,
    default_branch: str,
) -> list[dict]:
    """Generate wiki pages for a single repo by fetching GitHub data."""
    pages = []

    # Fetch data from GitHub in parallel-ish fashion
    readme = ""
    tree: list[dict] = []
    languages: dict = {}
    topics: list[str] = []
    contributors: list[dict] = []
    repo_info: dict = {}

    try:
        repo_info = await github.get_repo(owner, name)
    except Exception as e:
        logger.error(f"Failed to fetch repo info for {full_name}: {e}")

    try:
        readme = await github.get_readme(owner, name)
    except Exception as e:
        logger.warning(f"Failed to fetch README for {full_name}: {e}")

    try:
        tree = await github.get_file_tree(owner, name, default_branch)
    except Exception as e:
        logger.warning(f"Failed to fetch file tree for {full_name}: {e}")

    try:
        languages = await github.list_repo_languages(owner, name)
    except Exception as e:
        logger.warning(f"Failed to fetch languages for {full_name}: {e}")

    try:
        topics = await github.get_repo_topics(owner, name)
    except Exception as e:
        logger.warning(f"Failed to fetch topics for {full_name}: {e}")

    try:
        contributors = await github.get_contributors(owner, name)
    except Exception as e:
        logger.warning(f"Failed to fetch contributors for {full_name}: {e}")

    # ── Page 1: Overview ──
    description = repo_info.get("description", "") or ""
    stars = repo_info.get("stargazers_count", 0)
    forks = repo_info.get("forks_count", 0)
    open_issues = repo_info.get("open_issues_count", 0)
    created = repo_info.get("created_at", "")[:10]
    updated = repo_info.get("updated_at", "")[:10]
    license_name = (repo_info.get("license") or {}).get("spdx_id", "None")

    overview_md = f"# {name}\n\n"
    if description:
        overview_md += f"{description}\n\n"
    overview_md += f"| Metric | Value |\n|--------|-------|\n"
    overview_md += f"| Stars | {stars} |\n"
    overview_md += f"| Forks | {forks} |\n"
    overview_md += f"| Open Issues | {open_issues} |\n"
    overview_md += f"| License | {license_name} |\n"
    overview_md += f"| Created | {created} |\n"
    overview_md += f"| Last Updated | {updated} |\n"
    overview_md += f"| Default Branch | {default_branch} |\n"
    if topics:
        overview_md += f"\n**Topics:** {', '.join(topics)}\n"

    pages.append({
        "slug": "overview",
        "title": "Overview",
        "content": overview_md,
        "icon": "BookOpen",
        "sort_order": 0,
    })

    # ── Page 2: Tech Stack ──
    tech_stack = _detect_tech_stack(tree, languages, readme)
    stack_md = "# Tech Stack\n\n"
    if tech_stack:
        stack_md += "| Technology | Type | Detail |\n|------------|------|--------|\n"
        for t in tech_stack:
            stack_md += f"| {t['name']} | {t['type']} | {t['detail']} |\n"
    else:
        stack_md += "No tech stack detected.\n"

    pages.append({
        "slug": "tech-stack",
        "title": "Tech Stack",
        "content": stack_md,
        "icon": "Layers",
        "sort_order": 1,
    })

    # ── Page 3: Architecture / Modules ──
    modules = _detect_modules(tree)
    arch_md = "# Architecture\n\n"
    arch_md += "## Key Directories\n\n"
    if modules:
        arch_md += "| Directory | Files | Description |\n|-----------|-------|-------------|\n"
        for m in modules:
            arch_md += f"| `{m['name']}/` | {m['files']} | {m['description']} |\n"
    arch_md += "\n## File Tree\n\n```\n"
    arch_md += _build_tree_summary(tree)
    arch_md += "\n```\n"

    pages.append({
        "slug": "architecture",
        "title": "Architecture",
        "content": arch_md,
        "icon": "FolderTree",
        "sort_order": 2,
    })

    # ── Page 4: README ──
    if readme:
        pages.append({
            "slug": "readme",
            "title": "README",
            "content": readme,
            "icon": "FileText",
            "sort_order": 3,
        })

    # ── Page 5: Contributors ──
    contrib_md = "# Contributors\n\n"
    if contributors:
        contrib_md += "| # | Contributor | Commits |\n|---|------------|--------|\n"
        for i, c in enumerate(contributors, 1):
            contrib_md += f"| {i} | [{c['login']}](https://github.com/{c['login']}) | {c['contributions']} |\n"
    else:
        contrib_md += "No contributor data available.\n"

    pages.append({
        "slug": "contributors",
        "title": "Contributors",
        "content": contrib_md,
        "icon": "Users",
        "sort_order": 4,
    })

    # ── Page 6: Issue Summary ──
    cursor = await db.execute(
        "SELECT category, COUNT(*) FROM issues WHERE repo_full_name = ? GROUP BY category",
        (full_name,),
    )
    issue_rows = await cursor.fetchall()
    cursor2 = await db.execute(
        "SELECT status, COUNT(*) FROM issues WHERE repo_full_name = ? GROUP BY status",
        (full_name,),
    )
    status_rows = await cursor2.fetchall()

    issue_md = "# Issue Summary\n\n"
    if issue_rows:
        issue_md += "## By Category\n\n| Category | Count |\n|----------|-------|\n"
        for r in issue_rows:
            issue_md += f"| {r[0]} | {r[1]} |\n"
    if status_rows:
        issue_md += "\n## By Status\n\n| Status | Count |\n|--------|-------|\n"
        for r in status_rows:
            issue_md += f"| {r[0]} | {r[1]} |\n"

    if issue_rows or status_rows:
        pages.append({
            "slug": "issues",
            "title": "Issue Summary",
            "content": issue_md,
            "icon": "CircleDot",
            "sort_order": 5,
        })

    # Save to DB
    for page in pages:
        await db.execute(
            """INSERT OR REPLACE INTO wiki_pages (repo_full_name, slug, title, content, icon, sort_order, generated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))""",
            (full_name, page["slug"], page["title"], page["content"], page["icon"], page["sort_order"]),
        )
    await db.commit()

    return pages


@router.get("/repos")
async def list_wiki_repos(db: aiosqlite.Connection = Depends(get_db)):
    """List repos that have wiki pages generated."""
    cursor = await db.execute(
        """SELECT DISTINCT w.repo_full_name, r.language, r.default_branch,
        COUNT(w.id) as page_count, MAX(w.generated_at) as last_generated
        FROM wiki_pages w
        JOIN connected_repos r ON r.full_name = w.repo_full_name
        GROUP BY w.repo_full_name
        ORDER BY w.repo_full_name"""
    )
    rows = await cursor.fetchall()
    return [
        {
            "repo_full_name": row[0],
            "language": row[1] or "",
            "default_branch": row[2] or "main",
            "page_count": row[3],
            "last_generated": row[4],
        }
        for row in rows
    ]


@router.get("/{owner}/{name}")
async def get_wiki_pages(owner: str, name: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get all wiki pages for a repo."""
    full_name = f"{owner}/{name}"
    cursor = await db.execute(
        "SELECT id, slug, title, content, icon, sort_order, generated_at FROM wiki_pages WHERE repo_full_name = ? ORDER BY sort_order",
        (full_name,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "id": row[0],
            "slug": row[1],
            "title": row[2],
            "content": row[3],
            "icon": row[4],
            "sort_order": row[5],
            "generated_at": row[6],
        }
        for row in rows
    ]


@router.post("/{owner}/{name}/generate")
async def generate_wiki(owner: str, name: str, db: aiosqlite.Connection = Depends(get_db)):
    """Generate (or regenerate) wiki pages for a connected repo."""
    full_name = f"{owner}/{name}"

    # Verify repo is connected
    cursor = await db.execute("SELECT default_branch FROM connected_repos WHERE full_name = ?", (full_name,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Repository not connected")

    default_branch = row[0] or "main"

    github = await _get_github(db)
    pages = await _generate_wiki_for_repo(db, github, owner, name, full_name, default_branch)

    return {"repo": full_name, "pages_generated": len(pages), "pages": [{"slug": p["slug"], "title": p["title"]} for p in pages]}


@router.post("/generate-all")
async def generate_all_wikis(db: aiosqlite.Connection = Depends(get_db)):
    """Generate wiki pages for ALL connected repos."""
    cursor = await db.execute("SELECT owner, name, full_name, default_branch FROM connected_repos")
    repos = await cursor.fetchall()
    if not repos:
        return {"message": "No connected repos", "generated": 0}

    github = await _get_github(db)
    results = []
    for repo_row in repos:
        owner, name, full_name, default_branch = repo_row[0], repo_row[1], repo_row[2], repo_row[3] or "main"
        try:
            pages = await _generate_wiki_for_repo(db, github, owner, name, full_name, default_branch)
            results.append({"repo": full_name, "pages": len(pages)})
        except Exception as e:
            logger.error(f"Failed to generate wiki for {full_name}: {e}")
            results.append({"repo": full_name, "error": str(e)})

    return {"generated": len(results), "results": results}
