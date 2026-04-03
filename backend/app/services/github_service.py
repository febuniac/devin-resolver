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
