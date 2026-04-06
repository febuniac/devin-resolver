import httpx
from typing import Optional


BACKLOG_ZERO_URL = "https://issue-triage-app-ytyhqiof.devinapps.com"

# ── Emoji Maps ──────────────────────────────────────────────────────────
SEVERITY_LABEL = {
    "critical": ":fire: CRITICAL",
    "high": ":warning: HIGH",
    "medium": ":large_yellow_circle: MEDIUM",
    "low": ":large_green_circle: LOW",
}

CATEGORY_EMOJI = {
    "bug": ":bug:", "feature": ":sparkles:", "performance": ":zap:",
    "security": ":shield:", "documentation": ":books:", "refactor": ":recycle:",
    "testing": ":test_tube:", "ui": ":art:", "infrastructure": ":gear:",
    "dependency": ":package:", "accessibility": ":wheelchair:",
    "api": ":electric_plug:", "database": ":floppy_disk:", "devops": ":rocket:",
    "other": ":label:",
}

EFFORT_EMOJI = {
    "small": ":clock1: ~30 min", "medium": ":clock3: ~2 hrs",
    "large": ":clock6: ~1 day", "xl": ":clock9: 2+ days",
}

PIPELINE_STAGES = {
    "triaged":  ":white_check_mark: Triaged  :arrow_right:  :white_circle: Assigned  :arrow_right:  :white_circle: PR  :arrow_right:  :white_circle: Merged",
    "assigned": ":white_check_mark: Triaged  :arrow_right:  :white_check_mark: Assigned  :arrow_right:  :white_circle: PR  :arrow_right:  :white_circle: Merged",
    "pr_ready": ":white_check_mark: Triaged  :arrow_right:  :white_check_mark: Assigned  :arrow_right:  :white_check_mark: PR  :arrow_right:  :white_circle: Merged",
    "merged":   ":white_check_mark: Triaged  :arrow_right:  :white_check_mark: Assigned  :arrow_right:  :white_check_mark: PR  :arrow_right:  :white_check_mark: Merged",
}


def _severity_bar(severity: str) -> str:
    level = {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(severity, 0)
    colors = {4: ":red_circle:", 3: ":large_orange_circle:", 2: ":large_yellow_circle:", 1: ":large_green_circle:"}
    filled = colors.get(level, ":white_circle:")
    return filled * level + ":white_circle:" * (4 - level)


def _category_icon(category: str) -> str:
    return CATEGORY_EMOJI.get(category.lower(), ":label:")


def _effort_display(effort: str) -> str:
    return EFFORT_EMOJI.get(effort.lower(), f":clock2: {effort}")


def _repo_display(repo: str) -> str:
    if "/" in repo:
        org, name = repo.split("/", 1)
        return f":file_folder: `{org}` / *{name}*"
    return f":file_folder: `{repo}`"


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
        sev_label = SEVERITY_LABEL.get(severity, severity.upper())
        cat_icon = _category_icon(category)
        effort_display = _effort_display(effort)
        sev_bar = _severity_bar(severity)
        pipeline = PIPELINE_STAGES["triaged"]

        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":mag: New Issue Triaged"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*<{github_url or '#'}|#{issue_number} {issue_title}>*"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Severity*\n{sev_label}\n{sev_bar}"},
            ]},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Category*\n{cat_icon} {category.capitalize()}"},
                {"type": "mrkdwn", "text": f"*Effort*\n{effort_display}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f">  :brain: *AI Analysis*\n> {ai_summary[:300]}"}},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f":arrows_counterclockwise: {pipeline}"}]},
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":zap: Send to Devin"}, "url": f"{BACKLOG_ZERO_URL}/triage", "style": "primary"},
            ]},
        ]

        if github_url:
            blocks[-1]["elements"].append(
                {"type": "button", "text": {"type": "plain_text", "text": ":octocat: View on GitHub"}, "url": github_url}
            )

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
        pipeline = PIPELINE_STAGES["assigned"]
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":robot_face: Issue Sent to Devin"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*#{issue_number} {issue_title}*\nDevin is now working on this issue"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": "*Status*\n:hourglass_flowing_sand: *Running*\nDevin is analyzing the code..."},
            ]},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Session*\n:link: `{session_id[:16]}...`"},
                {"type": "mrkdwn", "text": "*Expected*\n:clock2: PR in ~15 min"},
            ]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f":arrows_counterclockwise: {pipeline}"}]},
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":eyes: Watch Session"}, "url": session_url, "style": "primary"},
                {"type": "button", "text": {"type": "plain_text", "text": ":bar_chart: View in Backlog Zero"}, "url": f"{BACKLOG_ZERO_URL}/approvals"},
            ]},
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
        time_display = f":stopwatch: Running for *{time_running}*" if time_running else ""
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":rotating_light: Action Required - Devin Needs Input"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f":speech_balloon: Devin is blocked and waiting for your feedback\n\n*#{issue_number} {issue_title}*"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": "*Status*\n:hand: *Blocked* - Waiting for input"},
            ]},
        ]
        if time_display:
            blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": time_display}]})
        blocks.extend([
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":speech_balloon: Respond Now"}, "url": f"{BACKLOG_ZERO_URL}/approvals", "style": "danger"},
                {"type": "button", "text": {"type": "plain_text", "text": ":eyes: View on Devin"}, "url": session_url},
            ]},
        ])
        return await self._send_blocks(
            blocks, f"ACTION REQUIRED: Devin needs your input on #{issue_number} {issue_title} in {repo}"
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
        pipeline = PIPELINE_STAGES["pr_ready"]
        diff_parts = []
        if files_changed:
            diff_parts.append(f":page_facing_up: *{files_changed}* files changed")
        if additions:
            diff_parts.append(f":heavy_plus_sign: *{additions}* additions")
        if deletions:
            diff_parts.append(f":heavy_minus_sign: *{deletions}* deletions")
        diff_summary = "\n".join(diff_parts) if diff_parts else ":page_facing_up: Changes pending"

        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":rocket: PR Ready for Review"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f":tada: Devin has created a pull request!\n\n*<{pr_url}|{pr_title or f'PR for #{issue_number}'}>*\nResolves: #{issue_number} {issue_title}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Changes*\n{diff_summary}"},
            ]},
        ]
        context_parts = [{"type": "mrkdwn", "text": f":arrows_counterclockwise: {pipeline}"}]
        if time_to_pr:
            context_parts.append({"type": "mrkdwn", "text": f":stopwatch: Time to PR: *{time_to_pr}*"})
        blocks.append({"type": "context", "elements": context_parts})
        blocks.extend([
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":mag: Review PR"}, "url": pr_url, "style": "primary"},
                {"type": "button", "text": {"type": "plain_text", "text": ":bar_chart: View in Backlog Zero"}, "url": f"{BACKLOG_ZERO_URL}/approvals"},
            ]},
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
        pipeline = PIPELINE_STAGES["merged"]
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":white_check_mark: Issue Resolved!"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f":tada: *Issue #{issue_number} has been fixed and merged!*\n\n*{issue_title}*\n<{pr_url}|View merged PR>"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Resolution Time*\n:stopwatch: {total_time or 'N/A'}"},
            ]},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": f":arrows_counterclockwise: {pipeline}"}]},
            {"type": "divider"},
            {"type": "context", "elements": [{"type": "mrkdwn", "text": ":robot_face: Resolved autonomously by Devin via *Backlog Zero*"}]},
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
        error_display = error_status.replace("_", " ").title()
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":x: Session Failed"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": f":warning: Devin was unable to resolve this issue\n\n*#{issue_number} {issue_title}*"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Error*\n:rotating_light: {error_display}"},
            ]},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Time Elapsed*\n:stopwatch: {time_elapsed or 'N/A'}"},
                {"type": "mrkdwn", "text": "*Next Steps*\n:point_right: Review logs or retry"},
            ]},
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":repeat: Retry in Backlog Zero"}, "url": f"{BACKLOG_ZERO_URL}/approvals", "style": "primary"},
                {"type": "button", "text": {"type": "plain_text", "text": ":mag: View Session Logs"}, "url": session_url},
            ]},
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
            status_line = f":rotating_light: *{needs_attention} session{'s' if needs_attention != 1 else ''} waiting for input*"
        else:
            status_line = ":white_check_mark: All clear - no sessions need attention"

        resolution_rate = ""
        if sent_to_devin > 0:
            rate = round((prs_merged / sent_to_devin) * 100)
            bar_filled = round(rate / 10)
            bar = ":large_green_square:" * bar_filled + ":white_large_square:" * (10 - bar_filled)
            resolution_rate = f"{bar} *{rate}%*"

        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": ":bar_chart: Backlog Zero Daily Report"}},
            {"type": "section", "text": {"type": "mrkdwn", "text": status_line}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f":inbox_tray: *Issues Triaged*\n`{issues_triaged}`"},
                {"type": "mrkdwn", "text": f":open_file_folder: *Total Open*\n`{total_open}`"},
            ]},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f":robot_face: *Sent to Devin*\n`{sent_to_devin}`"},
                {"type": "mrkdwn", "text": f":rocket: *PRs Created*\n`{prs_created}`"},
            ]},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f":white_check_mark: *PRs Merged*\n`{prs_merged}`"},
                {"type": "mrkdwn", "text": f":stopwatch: *Avg Time to Fix*\n`{avg_time_to_fix or 'N/A'}`"},
            ]},
        ]
        if resolution_rate:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f"*Resolution Rate*\n{resolution_rate}"}})
        if top_repos:
            repos_text = "  ".join(f"`{r}`" for r in top_repos[:5])
            blocks.append({"type": "context", "elements": [{"type": "mrkdwn", "text": f":file_folder: *Active Repos:*  {repos_text}"}]})
        blocks.extend([
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":chart_with_upwards_trend: Open Dashboard"}, "url": BACKLOG_ZERO_URL, "style": "primary"},
                {"type": "button", "text": {"type": "plain_text", "text": ":clipboard: Review Work"}, "url": f"{BACKLOG_ZERO_URL}/approvals"},
            ]},
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
        action_emoji = {"triaged": ":mag:", "sent to devin": ":robot_face:", "pr created": ":rocket:", "merged": ":white_check_mark:", "failed": ":x:"}
        emoji = action_emoji.get(action.lower(), ":bell:")
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": f"{emoji} Issue {action}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Issue*\n*#{issue_number}* {issue_title}"},
            ]},
        ]
        if pr_url:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f":rocket: *Pull Request:* <{pr_url}|View PR>"}})
        if devin_session_url:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f":robot_face: *Devin Session:* <{devin_session_url}|View Session>"}})
        blocks.extend([
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":bar_chart: View in Backlog Zero"}, "url": f"{BACKLOG_ZERO_URL}/approvals", "style": "primary"},
            ]},
        ])
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
        sev_label = SEVERITY_LABEL.get(severity, severity.upper())
        sev_bar = _severity_bar(severity)
        blocks = [
            {"type": "header", "text": {"type": "plain_text", "text": f":shield: Security Finding {action}"}},
            {"type": "section", "fields": [
                {"type": "mrkdwn", "text": f"*Repository*\n{_repo_display(repo)}"},
                {"type": "mrkdwn", "text": f"*Severity*\n{sev_label}\n{sev_bar}"},
            ]},
            {"type": "section", "text": {"type": "mrkdwn", "text": f":mag: *Finding:* `{finding_rule}`"}},
        ]
        if pr_url:
            blocks.append({"type": "section", "text": {"type": "mrkdwn", "text": f":rocket: *Fix PR:* <{pr_url}|View Pull Request>"}})
        blocks.extend([
            {"type": "divider"},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": ":shield: View Security"}, "url": f"{BACKLOG_ZERO_URL}/security", "style": "primary"},
            ]},
        ])
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
                    json={
                        "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": ":white_check_mark: *Backlog Zero* connected successfully!\n:robot_face: You will receive notifications here for issue triage, Devin sessions, and PRs."}}],
                        "text": "Backlog Zero webhook test - connection successful!",
                    },
                    timeout=10.0,
                )
                return resp.status_code == 200
        except Exception:
            return False
