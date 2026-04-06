import httpx
from typing import Optional


BACKLOG_ZERO_URL = "https://issue-triage-app-ytyhqiof.devinapps.com"


class SlackService:
    def __init__(self, webhook_url: str = "", bot_token: str = ""):
        self.webhook_url = webhook_url
        self.bot_token = bot_token

    async def _send_blocks(self, blocks: list, fallback_text: str) -> bool:
        """Send a Slack Block Kit message via webhook."""
        if not self.webhook_url:
            return False
        payload = {"blocks": blocks, "text": fallback_text}
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.webhook_url, json=payload, timeout=10.0)
                return resp.status_code == 200
        except Exception:
            return False

    async def send_webhook(self, message: str, channel: Optional[str] = None) -> bool:
        if not self.webhook_url:
            return False
        payload: dict = {"text": message}
        if channel:
            payload["channel"] = channel
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.webhook_url, json=payload, timeout=10.0)
                return resp.status_code == 200
        except Exception:
            return False

    # ── 1. New Issue Triaged ──────────────────────────────────────────
    async def notify_issue_triaged(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        severity: str,
        category: str,
        ai_summary: str,
        effort: str,
        github_url: Optional[str] = None,
    ) -> bool:
        severity_emoji = {
            "critical": ":red_circle:",
            "high": ":large_orange_circle:",
            "medium": ":large_yellow_circle:",
            "low": ":white_circle:",
        }
        emoji = severity_emoji.get(severity, ":white_circle:")

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":mag: New Issue Triaged"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n<{github_url or '#'}|#{issue_number}> {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Severity:*\n{emoji} {severity.capitalize()}"},
                    {"type": "mrkdwn", "text": f"*Category:*\n{category.capitalize()}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*AI Summary:*\n{ai_summary[:300]}"},
                    {"type": "mrkdwn", "text": f"*Estimated Effort:*\n{effort}"},
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/triage",
                        "style": "primary",
                    },
                ],
            },
        ]

        if github_url:
            blocks[-1]["elements"].append({
                "type": "button",
                "text": {"type": "plain_text", "text": "View on GitHub"},
                "url": github_url,
            })

        return await self._send_blocks(
            blocks, f"New issue triaged: #{issue_number} {issue_title} in {repo} ({severity})"
        )

    # ── 2. Issue Sent to Devin ────────────────────────────────────────
    async def notify_issue_sent_to_devin(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        session_id: str,
        session_url: str,
    ) -> bool:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":robot_face: Issue Sent to Devin"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Devin Session:*\n`{session_id[:16]}...`"},
                    {"type": "mrkdwn", "text": "*Status:*\n:hourglass_flowing_sand: Running"},
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Session"},
                        "url": session_url,
                        "style": "primary",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/approvals",
                    },
                ],
            },
        ]

        return await self._send_blocks(
            blocks, f"Issue #{issue_number} sent to Devin: {issue_title} in {repo}"
        )

    # ── 3. Devin Needs Input ──────────────────────────────────────────
    async def notify_devin_needs_input(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        session_url: str,
        time_running: str = "",
    ) -> bool:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":warning: Devin Needs Your Input"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": "*Status:*\n:speech_balloon: Waiting for user feedback"},
                    {"type": "mrkdwn", "text": f"*Time Running:*\n{time_running or 'N/A'}"},
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Respond in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/approvals",
                        "style": "primary",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View on Devin"},
                        "url": session_url,
                    },
                ],
            },
        ]

        return await self._send_blocks(
            blocks, f"Devin needs your input on #{issue_number} {issue_title} in {repo}"
        )

    # ── 4. PR Ready for Review ────────────────────────────────────────
    async def notify_pr_ready(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        pr_url: str,
        pr_title: str = "",
        files_changed: int = 0,
        additions: int = 0,
        deletions: int = 0,
        time_to_pr: str = "",
    ) -> bool:
        diff_summary = ""
        if files_changed:
            diff_summary = f"{files_changed} files | +{additions} -{deletions}"

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":git: PR Ready for Review"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Pull Request:*\n<{pr_url}|{pr_title or 'View PR'}>"},
                    {"type": "mrkdwn", "text": f"*Changes:*\n{diff_summary or 'N/A'}"},
                ],
            },
        ]

        if time_to_pr:
            blocks.append({
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": f":stopwatch: Time to PR: *{time_to_pr}*"},
                ],
            })

        blocks.extend([
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Review PR"},
                        "url": pr_url,
                        "style": "primary",
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/approvals",
                    },
                ],
            },
        ])

        return await self._send_blocks(
            blocks, f"PR ready for review: #{issue_number} {issue_title} in {repo}"
        )

    # ── 5. PR Merged / Issue Resolved ─────────────────────────────────
    async def notify_pr_merged(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        pr_url: str,
        total_time: str = "",
    ) -> bool:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":white_check_mark: Issue Resolved"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Pull Request:*\n<{pr_url}|Merged> :tada:"},
                    {"type": "mrkdwn", "text": f"*Total Time:*\n{total_time or 'N/A'}"},
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View PR"},
                        "url": pr_url,
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/approvals",
                    },
                ],
            },
        ]

        return await self._send_blocks(
            blocks, f"Issue resolved: #{issue_number} {issue_title} in {repo} - PR merged!"
        )

    # ── 6. Devin Session Failed ───────────────────────────────────────
    async def notify_session_failed(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        session_url: str,
        error_status: str = "error",
        time_elapsed: str = "",
    ) -> bool:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":x: Devin Session Failed"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Status:*\n:rotating_light: {error_status.replace('_', ' ').title()}"},
                    {"type": "mrkdwn", "text": f"*Time Elapsed:*\n{time_elapsed or 'N/A'}"},
                ],
            },
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View Session"},
                        "url": session_url,
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Retry in Backlog Zero"},
                        "url": f"{BACKLOG_ZERO_URL}/approvals",
                        "style": "primary",
                    },
                ],
            },
        ]

        return await self._send_blocks(
            blocks, f"Devin session failed for #{issue_number} {issue_title} in {repo}"
        )

    # ── 7. Daily Summary Digest ───────────────────────────────────────
    async def notify_daily_summary(
        self,
        issues_triaged: int,
        total_open: int,
        sent_to_devin: int,
        prs_created: int,
        prs_merged: int,
        needs_attention: int,
        avg_time_to_fix: str = "",
        top_repos: Optional[list[str]] = None,
    ) -> bool:
        if needs_attention > 0:
            status_line = f":warning: *{needs_attention} session{'s' if needs_attention != 1 else ''} waiting for input*"
        else:
            status_line = ":white_check_mark: All clear - no sessions need attention"

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": ":newspaper: Backlog Zero Daily Summary"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Issues Triaged Today:*\n{issues_triaged}"},
                    {"type": "mrkdwn", "text": f"*Total Open:*\n{total_open}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Sent to Devin:*\n{sent_to_devin}"},
                    {"type": "mrkdwn", "text": f"*PRs Created:*\n{prs_created}"},
                ],
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*PRs Merged:*\n{prs_merged}"},
                    {"type": "mrkdwn", "text": f"*Avg Time to Fix:*\n{avg_time_to_fix or 'N/A'}"},
                ],
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": status_line},
            },
        ]

        if top_repos:
            repos_text = "\n".join(f"- `{r}`" for r in top_repos[:5])
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Active Repos:*\n{repos_text}"},
            })

        blocks.extend([
            {"type": "divider"},
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Open Backlog Zero"},
                        "url": BACKLOG_ZERO_URL,
                        "style": "primary",
                    },
                ],
            },
        ])

        return await self._send_blocks(
            blocks,
            f"Daily Summary: {issues_triaged} triaged, {sent_to_devin} sent to Devin, {prs_merged} merged, {needs_attention} need attention",
        )

    # ── Legacy methods (kept for backward compat) ─────────────────────
    async def send_issue_notification(
        self,
        issue_title: str,
        issue_number: int,
        repo: str,
        action: str,
        pr_url: Optional[str] = None,
        devin_session_url: Optional[str] = None,
    ) -> bool:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"Backlog Zero: Issue {action}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n{repo}"},
                    {"type": "mrkdwn", "text": f"*Issue:*\n#{issue_number} {issue_title}"},
                ],
            },
        ]

        if pr_url:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Pull Request:* <{pr_url}|View PR>"},
            })

        if devin_session_url:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Devin Session:* <{devin_session_url}|View Session>"},
            })

        return await self._send_blocks(
            blocks, f"Issue #{issue_number} {action} in {repo}"
        )

    async def send_security_notification(
        self,
        finding_rule: str,
        severity: str,
        repo: str,
        action: str,
        pr_url: Optional[str] = None,
    ) -> bool:
        severity_emoji = {
            "critical": ":red_circle:",
            "high": ":large_orange_circle:",
            "medium": ":large_yellow_circle:",
            "low": ":white_circle:",
        }
        emoji = severity_emoji.get(severity, ":white_circle:")

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"Backlog Zero: Security Finding {action}"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Repository:*\n{repo}"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n{emoji} {severity.upper()}"},
                    {"type": "mrkdwn", "text": f"*Finding:*\n{finding_rule}"},
                ],
            },
        ]

        if pr_url:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Pull Request:* <{pr_url}|View PR>"},
            })

        return await self._send_blocks(
            blocks, f"Security finding {action}: {finding_rule} in {repo}"
        )

    async def validate_webhook(self) -> bool:
        if not self.webhook_url:
            return False
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.webhook_url,
                    json={"text": ":white_check_mark: Backlog Zero webhook test - connection successful!"},
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False
