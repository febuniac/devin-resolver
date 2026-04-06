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
        import asyncio
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
            # On 429, wait for Retry-After and try once more
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "30"))
                retry_after = min(retry_after, 60)  # cap at 60s
                await asyncio.sleep(retry_after)
                resp = await client.post(
                    f"{self.base_url}/sessions",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0,
                )
            resp.raise_for_status()
            return resp.json()

    async def get_session(self, session_id: str) -> dict:
        # v3 API requires "devin-" prefix on session IDs
        sid = session_id
        if self.is_v3 and not session_id.startswith("devin-"):
            sid = f"devin-{session_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sessions/{sid}",
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
        # v3 API requires "devin-" prefix and /messages (plural)
        if self.is_v3:
            devin_id = session_id if session_id.startswith("devin-") else f"devin-{session_id}"
            url = f"{self.base_url}/sessions/{devin_id}/messages"
        else:
            url = f"{self.base_url}/sessions/{session_id}/message"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers=self.headers,
                json={"message": message},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_session_attachments(self, session_id: str) -> list:
        """List all attachments for a session (v3 API)."""
        sid = session_id
        if self.is_v3 and not session_id.startswith("devin-"):
            sid = f"devin-{session_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/sessions/{sid}/attachments",
                headers=self.headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_attachment_url(self, uuid: str, filename: str) -> str:
        """Get a presigned download URL for an attachment. Tries v3 org endpoint first, then v1."""
        # Try v3 org-scoped download first if available
        if self.is_v3:
            try:
                async with httpx.AsyncClient(follow_redirects=False) as client:
                    resp = await client.get(
                        f"{self.base_url}/attachments/{uuid}/{filename}",
                        headers=self.headers,
                        timeout=15.0,
                    )
                    if resp.status_code == 307:
                        return resp.headers.get("location", "")
                    if resp.status_code == 200:
                        # Check if response has a URL in it
                        try:
                            data = resp.json()
                            return data.get("url", data.get("download_url", ""))
                        except Exception:
                            pass
            except Exception:
                pass

        # Fallback to v1 endpoint
        async with httpx.AsyncClient(follow_redirects=False) as client:
            resp = await client.get(
                f"{DEVIN_API_V1}/attachments/{uuid}/{filename}",
                headers=self.headers,
                timeout=15.0,
            )
            if resp.status_code == 307:
                return resp.headers.get("location", "")
            resp.raise_for_status()
            return ""

    async def terminate_session(self, session_id: str) -> dict:
        """Terminate a running session."""
        sid = session_id
        if self.is_v3 and not session_id.startswith("devin-"):
            sid = f"devin-{session_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/sessions/{sid}/terminate",
                headers=self.headers,
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()

    async def sync_org_secret(self, key: str, value: str, note: str = "") -> dict:
        """Create or update an org-level secret so all future sessions get it automatically."""
        if not self.is_v3:
            return {"error": "Org secrets require v3 API (cog_ token + org_id)"}
        payload: dict = {
            "type": "key-value",
            "key": key,
            "value": value,
            "is_sensitive": True,
        }
        if note:
            payload["note"] = note
        async with httpx.AsyncClient() as client:
            # First try to list existing secrets to find if one with this key exists
            try:
                resp = await client.get(
                    f"{self.base_url}/secrets",
                    headers=self.headers,
                    timeout=15.0,
                )
                if resp.status_code == 200:
                    secrets = resp.json()
                    existing = None
                    secret_list = secrets if isinstance(secrets, list) else secrets.get("secrets", secrets.get("items", []))
                    for s in secret_list:
                        if s.get("key") == key:
                            existing = s
                            break
                    if existing:
                        # Update existing secret
                        secret_id = existing.get("id", existing.get("secret_id", ""))
                        if secret_id:
                            resp2 = await client.patch(
                                f"{self.base_url}/secrets/{secret_id}",
                                headers=self.headers,
                                json={"value": value, "note": note} if note else {"value": value},
                                timeout=15.0,
                            )
                            if resp2.status_code in (200, 204):
                                return {"status": "updated", "key": key}
            except Exception:
                pass  # Fall through to create

            # Create new secret
            resp = await client.post(
                f"{self.base_url}/secrets",
                headers=self.headers,
                json=payload,
                timeout=15.0,
            )
            if resp.status_code in (200, 201):
                return {"status": "created", "key": key, "data": resp.json()}
            return {"status": "error", "code": resp.status_code, "detail": resp.text[:200]}

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

    def _build_git_auth_block(self, repo: str, github_pat: str) -> str:
        """Build mandatory git authentication instructions that go at the TOP of prompts.
        
        Uses $GITHUB_PAT env var (synced as Devin org secret) with inline PAT as fallback.
        """
        if not github_pat:
            return ""
        owner = repo.split("/")[0] if "/" in repo else ""
        return (
            f"== MANDATORY GIT AUTHENTICATION (DO THIS FIRST) ==\n"
            f"You do NOT have write access to {repo} via the Devin GitHub App.\n"
            f"You MUST run these commands IMMEDIATELY after cloning the repo, BEFORE doing anything else:\n\n"
            f"  # Use the GITHUB_PAT org secret (available as env var)\n"
            f"  git remote set-url origin https://{owner}:$GITHUB_PAT@github.com/{repo}.git\n\n"
            f"If $GITHUB_PAT is not set, use this fallback:\n"
            f"  git remote set-url origin https://{owner}:{github_pat}@github.com/{repo}.git\n\n"
            f"This gives you push access. Without this, every push and PR creation WILL fail.\n"
            f"Do NOT use git_create_pr — it will fail. Instead create PRs with curl:\n\n"
            f"  curl -X POST https://api.github.com/repos/{repo}/pulls "
            f'-H "Authorization: token $GITHUB_PAT" '
            f'-H "Accept: application/vnd.github.v3+json" '
            f"-d '{{\"title\": \"your title\", \"head\": \"your-branch\", \"base\": \"initial-setup\"}}'"
            f"\n\nDo NOT ask the user for repo access. You already have it via the PAT above.\n"
            f"== END MANDATORY GIT AUTHENTICATION ==\n\n"
        )

    def build_issue_prompt(self, issue: dict, repo: str, github_pat: str = "") -> str:
        labels = ", ".join(issue.get("labels", []))
        git_block = self._build_git_auth_block(repo, github_pat)
        return (
            f"{git_block}"
            f"Fix the following GitHub issue in the repository {repo}:\n\n"
            f"Issue #{issue['number']}: {issue['title']}\n\n"
            f"Description:\n{issue.get('body', 'No description provided.')}\n\n"
            f"Labels: {labels}\n\n"
            f"Instructions:\n"
            f"1. Analyze the issue and understand the root cause\n"
            f"2. Implement a fix with proper tests\n"
            f"3. Open a PR with a clear description (use curl with the PAT above, NOT git_create_pr)\n"
            f"4. Record a test demonstrating the fix works"
        )

    def build_conflict_resolve_prompt(self, repo: str, pr_number: int, head_branch: str, base_branch: str, github_pat: str = "") -> str:
        """Build a prompt instructing Devin to rebase and resolve merge conflicts for a PR."""
        git_block = self._build_git_auth_block(repo, github_pat)
        return (
            f"{git_block}"
            f"Resolve merge conflicts for PR #{pr_number} in the repository {repo}.\n\n"
            f"The PR branch is '{head_branch}' and the base branch is '{base_branch}'.\n\n"
            f"Instructions:\n"
            f"1. Clone the repo: git clone https://github.com/{repo}.git && cd {repo.split('/')[-1]}\n"
            f"2. Set up git auth using the MANDATORY GIT AUTHENTICATION above\n"
            f"3. Checkout the PR branch: git checkout {head_branch}\n"
            f"4. Rebase onto the base branch: git rebase origin/{base_branch}\n"
            f"5. Resolve any merge conflicts:\n"
            f"   - For package-lock.json or yarn.lock: accept the base branch version, then run npm install / yarn install to regenerate\n"
            f"   - For code conflicts: understand both changes and merge them correctly\n"
            f"   - After resolving each file: git add <file> && git rebase --continue\n"
            f"6. Force push the rebased branch: git push --force-with-lease origin {head_branch}\n"
            f"7. Verify the PR is now conflict-free on GitHub\n\n"
            f"IMPORTANT: Do NOT create a new PR. Just rebase and force-push the existing branch.\n"
            f"Do NOT modify the intent of any code changes - only resolve the conflicts.\n"
        )

    def build_security_prompt(self, finding: dict, repo: str, github_pat: str = "") -> str:
        git_block = self._build_git_auth_block(repo, github_pat)
        return (
            f"{git_block}"
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
            f"4. Open a PR with security fix details (use curl with the PAT above, NOT git_create_pr)\n"
            f"5. Record a test demonstrating the fix"
        )
