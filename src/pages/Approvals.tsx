import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Zap, Shield, Bug, Clock, ToggleLeft, ToggleRight, Brain, AlertTriangle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { SeverityBadge } from '../components/ui/StatusBadge';
import ConfidenceMeter from '../components/ui/ConfidenceMeter';
import api from '../api/client';

interface Issue {
  id: number;
  number: number;
  title: string;
  repo_full_name: string;
  severity: string;
  status: string;
  ai_confidence: number;
  estimated_effort: string;
}

interface Finding {
  id: number;
  rule: string;
  cwe_id: string;
  file: string;
  line: number;
  severity: string;
  status: string;
  ai_confidence: number;
  estimated_effort: string;
}

export default function Approvals() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvedItems, setApprovedItems] = useState<Set<string>>(new Set());
  const [rejectedItems, setRejectedItems] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [issuesData, findingsData, settingsData] = await Promise.all([
        api.listIssues(),
        api.listFindings(),
        api.getSettings(),
      ]);
      setIssues(issuesData);
      setFindings(findingsData);
      setSettings(settingsData);
    } catch {
      setError('Failed to load data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const pendingIssues = issues.filter(i => i.status === 'triaged' || i.status === 'open');
  const pendingFindings = findings.filter(f => f.status === 'triaged' || f.status === 'open');

  const autoApproveEnabled = settings.auto_approve_enabled || false;
  const autoApproveThreshold = settings.auto_approve_confidence || 90;
  const autoApproveSeverity = settings.auto_approve_max_severity || 'medium';

  const toggleAutoApprove = async () => {
    try {
      await api.updateSettings({ auto_approve_enabled: !autoApproveEnabled });
      setSettings({ ...settings, auto_approve_enabled: !autoApproveEnabled });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update settings');
    }
  };

  const updateThreshold = async (val: number) => {
    await api.updateSettings({ auto_approve_confidence: val });
    setSettings({ ...settings, auto_approve_confidence: val });
  };

  const updateSeverity = async (val: string) => {
    await api.updateSettings({ auto_approve_max_severity: val });
    setSettings({ ...settings, auto_approve_max_severity: val });
  };

  const handleApprove = async (id: string, type: 'issue' | 'finding') => {
    try {
      if (type === 'issue') {
        await api.approveIssues([Number(id)]);
      } else {
        await api.approveFindings([Number(id)]);
      }
      const newApproved = new Set(approvedItems);
      newApproved.add(`${type}-${id}`);
      setApprovedItems(newApproved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    }
  };

  const handleReject = async (id: string, type: 'issue' | 'finding') => {
    try {
      if (type === 'issue') {
        await api.rejectIssues([Number(id)]);
      }
      const newRejected = new Set(rejectedItems);
      newRejected.add(`${type}-${id}`);
      setRejectedItems(newRejected);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reject');
    }
  };

  const approveAll = async () => {
    setSaving(true);
    try {
      const issueIds = pendingIssues.map(i => i.id);
      const findingIds = pendingFindings.map(f => f.id);
      if (issueIds.length > 0) await api.approveIssues(issueIds);
      if (findingIds.length > 0) await api.approveFindings(findingIds);
      const allKeys = [
        ...issueIds.map(id => `issue-${id}`),
        ...findingIds.map(id => `finding-${id}`),
      ];
      setApprovedItems(new Set(allKeys));
      setRejectedItems(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve all');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const totalPending = pendingIssues.length + pendingFindings.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="text-sm text-zinc-500 mt-1">Review and approve issues for Devin to work on.</p>
        </div>
        <div className="flex items-center gap-3">
          {totalPending > 0 && (
            <button onClick={approveAll} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve All ({totalPending})
            </button>
          )}
          <button onClick={loadData} className="glass glass-hover px-3 py-2 rounded-lg text-sm text-zinc-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto-Approve Settings */}
      <div className="glass rounded-xl p-5 border border-violet-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-violet-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Auto-Approve by Devin</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Automatically approve issues that meet your criteria. No human intervention needed.</p>
            </div>
          </div>
          <button onClick={toggleAutoApprove} className="flex items-center gap-2">
            {autoApproveEnabled ? (
              <ToggleRight className="w-10 h-6 text-violet-400" />
            ) : (
              <ToggleLeft className="w-10 h-6 text-zinc-600" />
            )}
          </button>
        </div>

        {autoApproveEnabled && (
          <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-violet-500/5 border border-violet-500/10">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Min AI Confidence</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={autoApproveThreshold}
                  onChange={(e) => updateThreshold(Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-sm font-medium text-violet-400 w-12 text-right">{autoApproveThreshold}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Max Severity to Auto-Approve</label>
              <select
                value={autoApproveSeverity}
                onChange={(e) => updateSeverity(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50"
              >
                <option value="low">Low only</option>
                <option value="medium">Medium and below</option>
                <option value="high">High and below</option>
                <option value="critical">All (including Critical)</option>
              </select>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-zinc-500">
                With current settings, <span className="text-violet-400 font-medium">
                  {issues.filter(i => i.ai_confidence >= autoApproveThreshold).length} issues
                </span> and <span className="text-violet-400 font-medium">
                  {findings.filter(f => f.ai_confidence >= autoApproveThreshold).length} security findings
                </span> would be auto-approved.
              </p>
            </div>
          </div>
        )}
      </div>

      {totalPending === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300 mb-2">All Caught Up</h3>
          <p className="text-sm text-zinc-500">No pending items in the approval queue. Sync a repository to discover new issues.</p>
        </div>
      ) : (
        <>
          {/* Pending Issues */}
          {pendingIssues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                GitHub Issues ({pendingIssues.length})
              </h3>
              <div className="space-y-2">
                {pendingIssues.map((issue, index) => {
                  const key = `issue-${issue.id}`;
                  return (
                    <div key={key} className="glass rounded-lg p-4 animate-slide-in flex items-center gap-4" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 font-mono">#{issue.number}</span>
                          <SeverityBadge severity={issue.severity} />
                        </div>
                        <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{issue.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{issue.repo_full_name}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                          <ConfidenceMeter value={issue.ai_confidence} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{issue.estimated_effort}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {approvedItems.has(key) ? (
                          <span className="text-xs font-medium text-emerald-400 px-3 py-2">Approved</span>
                        ) : rejectedItems.has(key) ? (
                          <span className="text-xs font-medium text-red-400 px-3 py-2">Skipped</span>
                        ) : (
                          <>
                            <button onClick={() => handleReject(String(issue.id), 'issue')} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleApprove(String(issue.id), 'issue')} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors">
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Security Findings */}
          {pendingFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Findings ({pendingFindings.length})
              </h3>
              <div className="space-y-2">
                {pendingFindings.map((finding, index) => {
                  const key = `finding-${finding.id}`;
                  return (
                    <div key={key} className="glass rounded-lg p-4 animate-slide-in flex items-center gap-4" style={{ animationDelay: `${index * 50}ms` }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-3.5 h-3.5 ${finding.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
                          <span className="text-xs text-zinc-500 font-mono">{finding.cwe_id}</span>
                          <SeverityBadge severity={finding.severity} />
                        </div>
                        <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{finding.rule}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{finding.file}:{finding.line}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Brain className="w-3.5 h-3.5 text-violet-400" />
                          <ConfidenceMeter value={finding.ai_confidence} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          <span>{finding.estimated_effort}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {approvedItems.has(key) ? (
                          <span className="text-xs font-medium text-emerald-400 px-3 py-2">Approved</span>
                        ) : rejectedItems.has(key) ? (
                          <span className="text-xs font-medium text-red-400 px-3 py-2">Skipped</span>
                        ) : (
                          <>
                            <button onClick={() => handleReject(String(finding.id), 'finding')} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleApprove(String(finding.id), 'finding')} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors">
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
