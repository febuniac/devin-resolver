import httpx
from typing import Optional


class SlackService:
    def __init__(self, webhook_url: str = "", bot_token: str = ""):
        self.webhook_url = webhook_url
        self.bot_token = bot_token

    async def send_webhook(self, message: str, channel: Optional[str] = None) -> bool:
        if not self.webhook_url:
            return False

        payload: dict = {"text": message}
        if channel:
            payload["channel"] = channel

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.webhook_url,
                    json=payload,
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False

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
                "text": {
                    "type": "plain_text",
                    "text": f"DevinResolver: Issue {action}",
                },
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

        payload = {"blocks": blocks, "text": f"Issue #{issue_number} {action} in {repo}"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.webhook_url,
                    json=payload,
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False

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
                "text": {
                    "type": "plain_text",
                    "text": f"DevinResolver: Security Finding {action}",
                },
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

        payload = {"blocks": blocks, "text": f"Security finding {action}: {finding_rule} in {repo}"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.webhook_url,
                    json=payload,
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False

    async def validate_webhook(self) -> bool:
        if not self.webhook_url:
            return False
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    self.webhook_url,
                    json={"text": "DevinResolver webhook test - connection successful!"},
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False
