import httpx
from typing import Optional


DEVIN_API_V1 = "https://api.devin.ai/v1"
DEVIN_API_V3 = "https://api.devin.ai/v3"


class DevinService:
    def __init__(self, token: str, org_id: str = ""):
        self.token = token
        self.org_id = org_id
        self.is_v3 = token.startswith("cog_") and bool(org_id)
        if self.is_v3:
            self.base_url = f"{DEVIN_API_V3}/organizations/{org_id}"
        else:
            self.base_url = DEVIN_API_V1
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def create_session(
        self,
        prompt: str,
        playbook_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> dict:
        payload: dict = {"prompt": prompt}
        if playbook_id:
            payload["playbook_id"] = playbook_id
        if idempotency_key:
            payload["idempotent_key"] = idempotency_key

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/sessions",
                headers=self.headers,
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_session(self, session_id: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sessions/{session_id}",
                headers=self.headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def list_sessions(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        params = {"limit": limit, "offset": offset}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sessions",
                headers=self.headers,
                params=params,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_message(self, session_id: str, message: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/sessions/{session_id}/message",
                headers=self.headers,
                json={"message": message},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def validate_token(self) -> tuple[bool, str]:
        """Validate token. Returns (is_valid, detail_message)."""
        if self.token.startswith("cog_") and not self.org_id:
            return False, "Service User keys (cog_) require an Organization ID. Please enter your Org ID in the field below."
        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.base_url}/sessions"
                params = {"limit": 1} if not self.is_v3 else {"first": 1}
                resp = await client.get(
                    url,
                    headers=self.headers,
                    params=params,
                    timeout=10.0,
                )
                if resp.status_code == 200:
                    return True, "Token is valid"
                return False, f"API returned {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    def build_issue_prompt(self, issue: dict, repo: str) -> str:
        labels = ", ".join(issue.get("labels", []))
        return (
            f"Fix the following GitHub issue in the repository {repo}:\n\n"
            f"Issue #{issue['number']}: {issue['title']}\n\n"
            f"Description:\n{issue.get('body', 'No description provided.')}\n\n"
            f"Labels: {labels}\n\n"
            f"Instructions:\n"
            f"1. Analyze the issue and understand the root cause\n"
            f"2. Implement a fix with proper tests\n"
            f"3. Open a PR with a clear description\n"
            f"4. Record a test demonstrating the fix works"
        )

    def build_security_prompt(self, finding: dict, repo: str) -> str:
        return (
            f"Fix the following security finding in the repository {repo}:\n\n"
            f"Rule: {finding['rule']}\n"
            f"Severity: {finding['severity']}\n"
            f"File: {finding.get('file_path', 'unknown')}:{finding.get('line_number', 0)}\n\n"
            f"Description:\n{finding.get('description', 'No description.')}\n\n"
            f"CWE: {finding.get('cwe_id', 'N/A')}\n\n"
            f"Instructions:\n"
            f"1. Analyze the vulnerability and understand the security implications\n"
            f"2. Implement a fix following security best practices\n"
            f"3. Add appropriate tests\n"
            f"4. Open a PR with security fix details\n"
            f"5. Record a test demonstrating the fix"
        )
