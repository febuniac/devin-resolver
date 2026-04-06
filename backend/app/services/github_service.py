import httpx
import json
from typing import Optional


GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def get_repo(self, owner: str, name: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_issues(
        self,
        owner: str,
        name: str,
        state: str = "open",
        per_page: int = 100,
        page: int = 1,
        labels: Optional[str] = None,
    ) -> list[dict]:
        params: dict = {
            "state": state,
            "per_page": per_page,
            "page": page,
            "sort": "updated",
            "direction": "desc",
        }
        if labels:
            params["labels"] = labels

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/issues",
                headers=self.headers,
                params=params,
            )
            resp.raise_for_status()
            # Filter out pull requests (GitHub API returns PRs as issues)
            issues = resp.json()
            return [i for i in issues if "pull_request" not in i]

    async def get_issue(self, owner: str, name: str, issue_number: int) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/issues/{issue_number}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_code_scanning_alerts(
        self,
        owner: str,
        name: str,
        state: str = "open",
        per_page: int = 100,
    ) -> list[dict]:
        params = {
            "state": state,
            "per_page": per_page,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/code-scanning/alerts",
                headers=self.headers,
                params=params,
            )
            if resp.status_code == 404:
                return []  # CodeQL not enabled
            resp.raise_for_status()
            return resp.json()

    async def get_code_scanning_alert(
        self, owner: str, name: str, alert_number: int
    ) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/code-scanning/alerts/{alert_number}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_repo_languages(self, owner: str, name: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/languages",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_readme(self, owner: str, name: str) -> str:
        """Fetch the decoded README content for a repo."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/readme",
                headers={**self.headers, "Accept": "application/vnd.github.v3.raw"},
            )
            if resp.status_code == 404:
                return ""
            resp.raise_for_status()
            return resp.text

    async def get_file_tree(self, owner: str, name: str, branch: str = "main") -> list[dict]:
        """Fetch the recursive file tree (paths only) for a repo."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/git/trees/{branch}",
                headers=self.headers,
                params={"recursive": "1"},
            )
            if resp.status_code != 200:
                return []
            tree = resp.json().get("tree", [])
            return [{"path": item["path"], "type": item["type"], "size": item.get("size", 0)} for item in tree]

    async def get_repo_topics(self, owner: str, name: str) -> list[str]:
        """Fetch repo topics/tags."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/topics",
                headers={**self.headers, "Accept": "application/vnd.github.mercy-preview+json"},
            )
            if resp.status_code != 200:
                return []
            return resp.json().get("names", [])

    async def get_contributors(self, owner: str, name: str, per_page: int = 10) -> list[dict]:
        """Fetch top contributors."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{name}/contributors",
                headers=self.headers,
                params={"per_page": per_page},
            )
            if resp.status_code != 200:
                return []
            return [{"login": c["login"], "contributions": c["contributions"], "avatar_url": c["avatar_url"]} for c in resp.json()]

    async def validate_token(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{GITHUB_API_BASE}/user",
                    headers=self.headers,
                )
                return resp.status_code == 200
        except Exception:
            return False
