import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Zap, Shield, Bug, Clock, ToggleLeft, ToggleRight, Brain, AlertTriangle, Loader2, AlertCircle, RefreshCw, GitPullRequest, ExternalLink, Play, Eye, GitMerge, Send } from 'lucide-react';
import { SeverityBadge } from '../components/ui/StatusBadge';
import ConfidenceMeter from '../components/ui/ConfidenceMeter';
import api from '../api/client';

interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  repo_full_name: string;
  severity: string;
  category: string;
  status: string;
  ai_confidence: number;
  ai_summary: string;
  estimated_effort: string;
  devin_session_id: string | null;
  devin_session_url: string | null;
  pr_url: string | null;
  pr_number: number | null;
  video_url: string | null;
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
  ai_remediation: string;
  pr_url: string | null;
  pr_number: number | null;
  devin_session_url: string | null;
  video_url: string | null;
}

export default function Approvals() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [mergedItems, setMergedItems] = useState<Set<string>>(new Set());
  const [rejectedItems, setRejectedItems] = useState<Set<string>>(new Set());
  const [polling, setPolling] = useState(false);
  const [lastPolled, setLastPolled] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Auto-poll every 30 seconds
    const interval = setInterval(() => {
      pollSessions();
    }, 30000);
    return () => clearInterval(interval);
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

  const pollSessions = async () => {
    setPolling(true);
    try {
      await api.pollSessions();
      await loadData();
      setLastPolled(new Date().toLocaleTimeString());
    } catch {
      // Silent fail for polling
    } finally {
      setPolling(false);
    }
  };

  // Items where Devin has completed work (has PR or is in progress)
  const workingIssues = issues.filter(i => ['approved', 'in_progress', 'pr_open', 'resolved'].includes(i.status));
  const workingFindings = findings.filter(f => ['approved', 'in_progress', 'pr_open', 'resolved'].includes(f.status));

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

  const handleMerge = async (id: string, type: 'issue' | 'finding') => {
    try {
      if (type === 'issue') {
        await api.approveIssues([Number(id)]);
      } else {
        await api.approveFindings([Number(id)]);
      }
      const newMerged = new Set(mergedItems);
      newMerged.add(`${type}-${id}`);
      setMergedItems(newMerged);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve merge');
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
      const issueIds = workingIssues.filter(i => i.pr_url).map(i => i.id);
      const findingIds = workingFindings.filter(f => f.pr_url).map(f => f.id);
      if (issueIds.length > 0) await api.approveIssues(issueIds);
      if (findingIds.length > 0) await api.approveFindings(findingIds);
      const allKeys = [
        ...issueIds.map(id => `issue-${id}`),
        ...findingIds.map(id => `finding-${id}`),
      ];
      setMergedItems(new Set(allKeys));
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
        <Loader2 className="w-8 h-8 text-devin-blue animate-spin" />
      </div>
    );
  }

  const totalWithPRs = workingIssues.filter(i => i.pr_url).length + workingFindings.filter(f => f.pr_url).length;
  const totalWorking = workingIssues.length + workingFindings.length;

  return (
    <div className="space-y-3 animate-fade-in">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Review Devin's Work</h1>
          <p className="text-xs text-zinc-500">Review PRs, test recordings, and approve merges for Devin's completed work</p>
        </div>
        <div className="flex items-center gap-3">
          {totalWithPRs > 0 && (
            <button onClick={approveAll} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
              Merge All PRs ({totalWithPRs})
            </button>
          )}
          <button onClick={pollSessions} disabled={polling} className="glass glass-hover px-3 py-2 rounded-lg text-sm text-zinc-300 flex items-center gap-2" title="Poll Devin sessions for updates">
            <RefreshCw className={`w-4 h-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling...' : 'Refresh'}
          </button>
          {lastPolled && (
            <span className="text-xs text-zinc-500">Last: {lastPolled}</span>
          )}
        </div>
      </div>

      {/* Auto-Approve Settings */}
      <div className="glass rounded-lg p-3 border border-devin-purple/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-devin-blue" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Auto-Approve by Devin</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Automatically merge PRs that meet your criteria. No human review needed.</p>
            </div>
          </div>
          <button onClick={toggleAutoApprove} className="flex items-center gap-2">
            {autoApproveEnabled ? (
              <ToggleRight className="w-10 h-6 text-devin-blue" />
            ) : (
              <ToggleLeft className="w-10 h-6 text-zinc-600" />
            )}
          </button>
        </div>

        {autoApproveEnabled && (
          <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-lg bg-devin-purple/5 border border-devin-purple/10">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Min AI Confidence</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={autoApproveThreshold}
                  onChange={(e) => updateThreshold(Number(e.target.value))}
                  className="flex-1 accent-devin-purple"
                />
                <span className="text-sm font-medium text-devin-blue w-12 text-right">{autoApproveThreshold}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Max Severity to Auto-Approve</label>
              <select
                value={autoApproveSeverity}
                onChange={(e) => updateSeverity(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-devin-purple/50"
              >
                <option value="low">Low only</option>
                <option value="medium">Medium and below</option>
                <option value="high">High and below</option>
                <option value="critical">All (including Critical)</option>
              </select>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-zinc-500">
                With current settings, <span className="text-devin-blue font-medium">
                  {issues.filter(i => i.ai_confidence >= autoApproveThreshold).length} issues
                </span> and <span className="text-devin-blue font-medium">
                  {findings.filter(f => f.ai_confidence >= autoApproveThreshold).length} security findings
                </span> would be auto-approved.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'In Progress', count: workingIssues.filter(i => i.status === 'in_progress').length + workingFindings.filter(f => f.status === 'in_progress').length, color: 'text-amber-400', Icon: Loader2 },
          { label: 'PRs Ready', count: totalWithPRs, color: 'text-cyan-400', Icon: GitPullRequest },
          { label: 'With Recordings', count: workingIssues.filter(i => i.video_url).length + workingFindings.filter(f => f.video_url).length, color: 'text-devin-blue', Icon: Play },
          { label: 'Merged', count: workingIssues.filter(i => i.status === 'resolved').length + workingFindings.filter(f => f.status === 'resolved').length, color: 'text-emerald-400', Icon: GitMerge },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-2 flex items-center gap-2">
            <stat.Icon className={`w-4 h-4 ${stat.color}`} />
            <div>
              <p className={`text-base font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {totalWorking === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <Send className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-zinc-300 mb-2">No Work in Progress</h3>
          <p className="text-sm text-zinc-500">Send issues to Devin from the Issue Triage page. Devin's completed work will appear here for review.</p>
        </div>
      ) : (
        <>
          {/* Issues Devin is working on or completed */}
          {workingIssues.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Issue Fixes ({workingIssues.length})
              </h3>
              <div className="space-y-2">
                {workingIssues.map((issue, index) => {
                  const key = `issue-${issue.id}`;
                  const isExpanded = expandedItem === key;
                  return (
                    <div key={key} className="glass rounded-lg overflow-hidden animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                        <div
                          className="p-3 flex items-center gap-3 cursor-pointer glass-hover"
                          onClick={() => setExpandedItem(isExpanded ? null : key)}
                        >
                          <div className="flex-shrink-0">
                            {issue.status === 'resolved' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : issue.status === 'pr_open' ? (
                            <GitPullRequest className="w-4 h-4 text-cyan-400" />
                          ) : issue.status === 'in_progress' ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 font-mono">#{issue.number}</span>
                            <SeverityBadge severity={issue.severity} />
                            {issue.pr_url && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">PR #{issue.pr_number}</span>
                            )}
                            {issue.video_url && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-devin-purple/15 text-devin-blue flex items-center gap-1">
                                <Play className="w-3 h-3" /> Recording
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{issue.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{issue.repo_full_name}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Brain className="w-3.5 h-3.5 text-devin-blue" />
                            <ConfidenceMeter value={issue.ai_confidence} />
                          </div>
                          <span className="text-xs text-zinc-500">
                            {issue.status === 'in_progress' ? 'Devin working...' :
                             issue.status === 'pr_open' ? 'Ready for review' :
                             issue.status === 'resolved' ? 'Merged' : 'Queued'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {mergedItems.has(key) ? (
                            <span className="text-xs font-medium text-emerald-400 px-3 py-2">Merged</span>
                          ) : rejectedItems.has(key) ? (
                            <span className="text-xs font-medium text-red-400 px-3 py-2">Rejected</span>
                          ) : issue.pr_url ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleReject(String(issue.id), 'issue'); }} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Reject PR">
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleMerge(String(issue.id), 'issue'); }} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors" title="Approve & Merge">
                                <GitMerge className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <Eye className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                      </div>

                      {/* Expanded details with recording preview */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 animate-fade-in">
                          {issue.ai_summary && (
                            <div className="glass rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-3.5 h-3.5 text-devin-blue" />
                                <span className="text-xs font-semibold text-devin-blue uppercase tracking-wider">AI Analysis</span>
                              </div>
                              <p className="text-sm text-zinc-300 leading-relaxed">{issue.ai_summary}</p>
                            </div>
                          )}

                          {/* Test Recording Preview */}
                          {issue.video_url ? (
                            <div className="glass rounded-lg p-4 border border-devin-purple/20">
                              <div className="flex items-center gap-2 mb-3">
                                <Play className="w-4 h-4 text-devin-blue" />
                                <span className="text-xs font-semibold text-devin-blue uppercase tracking-wider">Devin's Test Recording</span>
                              </div>
                              <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video">
                                <video
                                  src={issue.video_url}
                                  className="w-full h-full object-cover"
                                  controls
                                  preload="metadata"
                                />
                              </div>
                              <p className="text-xs text-zinc-500 mt-2">Watch how Devin tested the fix before opening the PR</p>
                            </div>
                          ) : issue.status === 'in_progress' ? (
                            <div className="glass rounded-lg p-4 border border-amber-500/20">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Devin is Working</span>
                              </div>
                              <p className="text-sm text-zinc-400 mt-2">Devin is currently working on this issue. A test recording will be available once completed.</p>
                            </div>
                          ) : (
                            <div className="glass rounded-lg p-4 border border-zinc-700/30">
                              <div className="flex items-center gap-2">
                                <Play className="w-4 h-4 text-zinc-600" />
                                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">No Recording Yet</span>
                              </div>
                              <p className="text-sm text-zinc-500 mt-2">A test recording will appear here once Devin completes the fix.</p>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            {issue.devin_session_url && (
                              <a href={issue.devin_session_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-devin-blue flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                View Devin Session
                              </a>
                            )}
                            {issue.pr_url && (
                              <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 flex items-center gap-2">
                                <GitPullRequest className="w-4 h-4" />
                                View PR #{issue.pr_number}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Security Findings Devin is working on or completed */}
          {workingFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Fixes ({workingFindings.length})
              </h3>
              <div className="space-y-2">
                {workingFindings.map((finding, index) => {
                  const key = `finding-${finding.id}`;
                  const isExpanded = expandedItem === key;
                  return (
                    <div key={key} className="glass rounded-lg overflow-hidden animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}>
                      <div
                        className="p-3 flex items-center gap-3 cursor-pointer glass-hover"
                        onClick={() => setExpandedItem(isExpanded ? null : key)}
                      >
                        <div className="flex-shrink-0">
                          {finding.status === 'resolved' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : finding.status === 'pr_open' ? (
                            <GitPullRequest className="w-4 h-4 text-cyan-400" />
                          ) : finding.status === 'in_progress' ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                          ) : (
                            <Clock className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`w-3.5 h-3.5 ${finding.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
                            <span className="text-xs text-zinc-500 font-mono">{finding.cwe_id}</span>
                            <SeverityBadge severity={finding.severity} />
                            {finding.pr_url && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">PR #{finding.pr_number}</span>
                            )}
                            {finding.video_url && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-devin-purple/15 text-devin-blue flex items-center gap-1">
                                <Play className="w-3 h-3" /> Recording
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{finding.rule}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{finding.file}:{finding.line}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <Brain className="w-3.5 h-3.5 text-devin-blue" />
                            <ConfidenceMeter value={finding.ai_confidence} />
                          </div>
                          <span className="text-xs text-zinc-500">
                            {finding.status === 'in_progress' ? 'Devin working...' :
                             finding.status === 'pr_open' ? 'Ready for review' :
                             finding.status === 'resolved' ? 'Merged' : 'Queued'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {mergedItems.has(key) ? (
                            <span className="text-xs font-medium text-emerald-400 px-3 py-2">Merged</span>
                          ) : rejectedItems.has(key) ? (
                            <span className="text-xs font-medium text-red-400 px-3 py-2">Rejected</span>
                          ) : finding.pr_url ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleReject(String(finding.id), 'finding'); }} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors" title="Reject PR">
                                <XCircle className="w-5 h-5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleMerge(String(finding.id), 'finding'); }} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors" title="Approve & Merge">
                                <GitMerge className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <Eye className="w-4 h-4 text-zinc-600" />
                          )}
                        </div>
                      </div>

                      {/* Expanded details with recording preview */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 animate-fade-in">
                          {finding.ai_remediation && (
                            <div className="glass rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="w-3.5 h-3.5 text-devin-blue" />
                                <span className="text-xs font-semibold text-devin-blue uppercase tracking-wider">AI Remediation Plan</span>
                              </div>
                              <p className="text-sm text-zinc-300 leading-relaxed">{finding.ai_remediation}</p>
                            </div>
                          )}

                          {/* Test Recording Preview */}
                          {finding.video_url ? (
                            <div className="glass rounded-lg p-4 border border-devin-purple/20">
                              <div className="flex items-center gap-2 mb-3">
                                <Play className="w-4 h-4 text-devin-blue" />
                                <span className="text-xs font-semibold text-devin-blue uppercase tracking-wider">Devin's Test Recording</span>
                              </div>
                              <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video">
                                <video
                                  src={finding.video_url}
                                  className="w-full h-full object-cover"
                                  controls
                                  preload="metadata"
                                />
                              </div>
                              <p className="text-xs text-zinc-500 mt-2">Watch how Devin tested the security fix before opening the PR</p>
                            </div>
                          ) : finding.status === 'in_progress' ? (
                            <div className="glass rounded-lg p-4 border border-amber-500/20">
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Devin is Working</span>
                              </div>
                              <p className="text-sm text-zinc-400 mt-2">Devin is currently fixing this vulnerability. A test recording will be available once completed.</p>
                            </div>
                          ) : (
                            <div className="glass rounded-lg p-4 border border-zinc-700/30">
                              <div className="flex items-center gap-2">
                                <Play className="w-4 h-4 text-zinc-600" />
                                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">No Recording Yet</span>
                              </div>
                              <p className="text-sm text-zinc-500 mt-2">A test recording will appear here once Devin completes the fix.</p>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            {finding.devin_session_url && (
                              <a href={finding.devin_session_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-devin-blue flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                View Devin Session
                              </a>
                            )}
                            {finding.pr_url && (
                              <a href={finding.pr_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 flex items-center gap-2">
                                <GitPullRequest className="w-4 h-4" />
                                View PR #{finding.pr_number}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
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
