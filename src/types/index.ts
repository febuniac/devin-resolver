export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'triaged' | 'approved' | 'in_progress' | 'pr_open' | 'resolved';
export type IssueCategory = 'bug' | 'feature' | 'security' | 'performance' | 'documentation' | 'refactor';
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  openIssues: number;
  securityIssues: number;
  language: string;
  lastSync: string;
  connected: boolean;
}

export interface GithubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  repo: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  severity: IssueSeverity;
  status: IssueStatus;
  category: IssueCategory;
  aiConfidence: number;
  aiSummary: string;
  estimatedEffort: string;
  devinSessionUrl?: string;
  prUrl?: string;
  prNumber?: number;
  slackNotified?: boolean;
  videoUrl?: string;
}

export interface SecurityFinding {
  id: string;
  rule: string;
  ruleId: string;
  severity: SecuritySeverity;
  file: string;
  line: number;
  description: string;
  repo: string;
  category: string;
  cweId: string;
  status: IssueStatus;
  aiSummary: string;
  aiConfidence: number;
  estimatedEffort: string;
  devinSessionUrl?: string;
  prUrl?: string;
  prNumber?: number;
  detectedAt: string;
}

export interface KPIData {
  issuesResolved: number;
  issuesResolvedTrend: number;
  avgResolutionTime: string;
  avgResolutionTimeTrend: number;
  securityFindingsFixed: number;
  securityFindingsFixedTrend: number;
  prsCreated: number;
  prsMerged: number;
  engineerHoursSaved: number;
  complianceScore: number;
  complianceScoreTrend: number;
}

export interface WeeklyData {
  week: string;
  resolved: number;
  opened: number;
  securityFixed: number;
}

export interface CategoryBreakdown {
  name: string;
  value: number;
  color: string;
}
