/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// Repos
export const api = {
  // Repositories
  listRepos: () => request<any[]>('/api/repos'),
  connectRepo: (owner: string, name: string) =>
    request<any>('/api/repos', {
      method: 'POST',
      body: JSON.stringify({ owner, name }),
    }),
  disconnectRepo: (id: number) =>
    request<any>(`/api/repos/${id}`, { method: 'DELETE' }),
  syncRepo: (id: number) =>
    request<any>(`/api/repos/${id}/sync`, { method: 'POST' }),

  // Issues
  listIssues: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/issues${query}`);
  },
  getIssue: (id: number) => request<any>(`/api/issues/${id}`),
  approveIssues: (issueIds: number[]) =>
    request<any>('/api/issues/approve', {
      method: 'POST',
      body: JSON.stringify({ issue_ids: issueIds }),
    }),
  rejectIssues: (issueIds: number[], reason?: string) =>
    request<any>('/api/issues/reject', {
      method: 'POST',
      body: JSON.stringify({ issue_ids: issueIds, reason }),
    }),
  triageIssue: (id: number) =>
    request<any>(`/api/issues/${id}/triage`, { method: 'POST' }),
  triageAll: () =>
    request<any>('/api/issues/triage-all', { method: 'POST' }),
  syncAndTriage: () =>
    request<any>('/api/issues/sync-and-triage', { method: 'POST' }),
  retryStuck: () =>
    request<any>('/api/issues/retry-stuck', { method: 'POST' }),

  // Security Findings
  listFindings: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any[]>(`/api/security/findings${query}`);
  },
  getFinding: (id: number) => request<any>(`/api/security/findings/${id}`),
  approveFindings: (findingIds: number[]) =>
    request<any>('/api/security/findings/approve', {
      method: 'POST',
      body: JSON.stringify({ finding_ids: findingIds }),
    }),
  getCompliance: () => request<any>('/api/security/compliance'),

  // Devin Sessions
  listSessions: () => request<any[]>('/api/devin/sessions'),
  getSession: (sessionId: string) => request<any>(`/api/devin/sessions/${sessionId}`),
  createSession: (data: { issue_id?: number; finding_id?: number; prompt?: string }) =>
    request<any>('/api/devin/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  refreshSession: (sessionId: string) =>
    request<any>(`/api/devin/sessions/${sessionId}/refresh`, { method: 'POST' }),
  pollSessions: () =>
    request<any>('/api/devin/sessions/poll', { method: 'POST' }),
  approveSession: (sessionId: string) =>
    request<any>(`/api/devin/sessions/${sessionId}/approve`, { method: 'POST' }),
  getSessionLive: (sessionId: string) =>
    request<any>(`/api/devin/sessions/${sessionId}/live`),
  getPrDiff: (owner: string, repo: string, prNumber: number) =>
    request<any>(`/api/github/pr-diff/${owner}/${repo}/${prNumber}`),
  mergePr: (owner: string, repo: string, prNumber: number) =>
    request<any>(`/api/github/pr-merge/${owner}/${repo}/${prNumber}`, { method: 'POST' }),
  syncPrs: () =>
    request<any>('/api/github/sync-prs', { method: 'POST' }),
  postPrComment: (owner: string, repo: string, prNumber: number, comment: string) =>
    request<any>(`/api/github/pr-comment/${owner}/${repo}/${prNumber}`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }),

  // Settings
  getSettings: () => request<any>('/api/settings'),
  updateSettings: (data: Record<string, any>) =>
    request<any>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  validateGithub: () => request<any>('/api/settings/validate/github', { method: 'POST' }),
  validateDevin: () => request<any>('/api/settings/validate/devin', { method: 'POST' }),
  validateSlack: () => request<any>('/api/settings/validate/slack', { method: 'POST' }),
  sendDailySummary: () => request<any>('/api/settings/notifications/daily-summary', { method: 'POST' }),

  // Status
  getStatus: () => request<any>('/api/status'),

  // Analytics
  getAnalytics: () => request<any>('/api/analytics'),

  // Slack
  sendNotification: (data: { message: string; issue_id?: number; finding_id?: number }) =>
    request<any>('/api/slack/notify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  testSlack: () => request<any>('/api/slack/test', { method: 'POST' }),
};

export default api;
