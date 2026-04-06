from pydantic import BaseModel
from typing import Optional
from enum import Enum


class SeverityEnum(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IssueStatusEnum(str, Enum):
    open = "open"
    triaged = "triaged"
    approved = "approved"
    in_progress = "in_progress"
    pr_open = "pr_open"
    resolved = "resolved"


class IssueCategoryEnum(str, Enum):
    bug = "bug"
    feature = "feature"
    security = "security"
    performance = "performance"
    documentation = "documentation"
    refactor = "refactor"


# Repository schemas
class RepoConnect(BaseModel):
    owner: str
    name: str


class RepoResponse(BaseModel):
    id: int
    owner: str
    name: str
    full_name: str
    language: str
    default_branch: str
    open_issues_count: int
    connected_at: str
    last_sync: Optional[str] = None
    sync_enabled: bool


# Issue schemas
class IssueResponse(BaseModel):
    id: int
    github_id: Optional[int] = None
    number: int
    title: str
    body: str
    repo_full_name: str
    labels: list[str]
    state: str
    author: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    severity: str
    category: str
    status: str
    ai_confidence: int
    ai_summary: str
    estimated_effort: str
    devin_session_id: Optional[str] = None
    devin_session_url: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    slack_notified: bool
    video_url: Optional[str] = None


class IssueApproval(BaseModel):
    issue_ids: list[int]


class IssueRejection(BaseModel):
    issue_ids: list[int]
    reason: Optional[str] = None


# Security Finding schemas
class SecurityFindingResponse(BaseModel):
    id: int
    alert_number: Optional[int] = None
    rule: str
    rule_id: str
    severity: str
    file_path: str
    line_number: int
    description: str
    repo_full_name: str
    category: str
    cwe_id: str
    status: str
    ai_summary: str
    ai_confidence: int
    estimated_effort: str
    devin_session_id: Optional[str] = None
    devin_session_url: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    detected_at: Optional[str] = None


class FindingApproval(BaseModel):
    finding_ids: list[int]


# Devin Session schemas
class DevinSessionCreate(BaseModel):
    issue_id: Optional[int] = None
    finding_id: Optional[int] = None
    prompt: Optional[str] = None


class DevinSessionResponse(BaseModel):
    id: int
    session_id: Optional[str] = None
    session_url: Optional[str] = None
    issue_id: Optional[int] = None
    finding_id: Optional[int] = None
    status: str
    status_detail: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    recording_url: Optional[str] = None
    issue_title: Optional[str] = None
    issue_number: Optional[int] = None
    repo_full_name: Optional[str] = None
    issue_body: Optional[str] = None
    ai_summary: Optional[str] = None
    issue_severity: Optional[str] = None
    issue_category: Optional[str] = None


# Settings schemas
class SettingsResponse(BaseModel):
    github_token_set: bool
    github_pat_set: bool = False
    devin_api_token_set: bool
    devin_org_id: str
    slack_webhook_url: str
    slack_channels: list[str]
    auto_approve_enabled: bool
    auto_approve_confidence: int
    auto_approve_max_severity: str
    auto_resolve_conflicts: bool = True
    codeql_enabled: bool
    scan_frequency: str
    notifications: dict


class SettingsUpdate(BaseModel):
    github_token: Optional[str] = None
    github_pat: Optional[str] = None
    devin_api_token: Optional[str] = None
    devin_org_id: Optional[str] = None
    slack_webhook_url: Optional[str] = None
    slack_channels: Optional[list[str]] = None
    auto_approve_enabled: Optional[bool] = None
    auto_approve_confidence: Optional[int] = None
    auto_approve_max_severity: Optional[str] = None
    auto_resolve_conflicts: Optional[bool] = None
    codeql_enabled: Optional[bool] = None
    scan_frequency: Optional[str] = None
    notifications: Optional[dict] = None


# Analytics schemas
class AnalyticsResponse(BaseModel):
    issues_resolved: int
    issues_open: int
    avg_resolution_hours: float
    security_findings_fixed: int
    security_findings_open: int
    prs_created: int
    prs_merged: int
    engineer_hours_saved: float
    compliance_score: float
    weekly_data: list[dict]
    category_breakdown: list[dict]


# Slack notification
class SlackNotification(BaseModel):
    channel: Optional[str] = None
    message: str
    issue_id: Optional[int] = None
    finding_id: Optional[int] = None
