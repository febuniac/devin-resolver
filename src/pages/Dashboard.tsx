import { useState, useEffect } from 'react';
import { Bug, Shield, GitPullRequest, Clock, Users, Zap, ArrowRight, ExternalLink, Loader2, Settings } from 'lucide-react';
import MetricCard from '../components/ui/MetricCard';
import WorkflowPipeline from '../components/ui/WorkflowPipeline';
import { StatusBadge, SeverityBadge } from '../components/ui/StatusBadge';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Dashboard() {
  const navigate = useNavigate();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [sessions, setSessions] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [issues, setIssues] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [findings, setFindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsData, sessionsData, issuesData, findingsData] = await Promise.all([
        api.getAnalytics(),
        api.listSessions(),
        api.listIssues(),
        api.listFindings(),
      ]);
      setAnalytics(analyticsData);
      setSessions(sessionsData);
      setIssues(issuesData);
      setFindings(findingsData);
    } catch {
      // Silently fail - show empty state
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  const recentIssues = issues.filter(i => i.status === 'in_progress' || i.status === 'pr_open' || i.status === 'approved').slice(0, 4);
  const recentFindings = findings.filter(f => f.status === 'in_progress' || f.status === 'pr_open' || f.status === 'approved').slice(0, 3);
  const activeSessions = sessions.filter(s => s.status === 'running').length;
  const hasData = issues.length > 0 || findings.length > 0;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Command Center</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time overview of Devin resolving your issues autonomously</p>
        </div>
        <div className="flex items-center gap-3">
          {activeSessions > 0 && (
            <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-zinc-300">{activeSessions} Devin session{activeSessions !== 1 ? 's' : ''} active</span>
            </div>
          )}
          <button onClick={() => navigate('/settings')} className="glass glass-hover px-3 py-2 rounded-lg text-sm text-zinc-300 flex items-center gap-2">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="glass rounded-xl p-8 text-center">
          <Zap className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">Welcome to DevinResolver</h2>
          <p className="text-sm text-zinc-500 mb-4 max-w-md mx-auto">
            Connect your GitHub repositories and configure your API tokens to start resolving issues automatically with Devin.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => navigate('/settings')} className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configure Settings
            </button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 max-w-xl mx-auto">
            {[
              { step: '1', title: 'Add API Tokens', desc: 'GitHub PAT + Devin API token' },
              { step: '2', title: 'Connect Repos', desc: 'Add GitHub repositories to monitor' },
              { step: '3', title: 'Sync & Triage', desc: 'Devin analyzes and fixes issues' },
            ].map((s) => (
              <div key={s.step} className="glass rounded-lg p-3 text-center">
                <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 font-bold text-xs flex items-center justify-center mx-auto mb-1.5">{s.step}</div>
                <p className="text-sm font-medium text-zinc-300">{s.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Workflow Pipeline */}
          <WorkflowPipeline />

          {/* KPI Grid */}
          <div className="grid grid-cols-5 gap-2">
            <MetricCard title="Issues Resolved" value={analytics?.issues_resolved || 0} icon={Bug} iconColor="text-emerald-400" subtitle="Total" />
            <MetricCard title="Open Issues" value={analytics?.issues_open || 0} icon={Clock} iconColor="text-blue-400" subtitle="Pending resolution" />
            <MetricCard title="Security Fixed" value={analytics?.security_findings_fixed || 0} icon={Shield} iconColor="text-amber-400" subtitle="CodeQL findings" />
            <MetricCard title="PRs Created" value={analytics?.prs_created || 0} icon={GitPullRequest} iconColor="text-cyan-400" subtitle={`${analytics?.prs_merged || 0} merged`} />
            <MetricCard title="Hours Saved" value={analytics?.engineer_hours_saved || 0} icon={Users} iconColor="text-violet-400" subtitle="Engineer hours" />
          </div>

          {/* Active Work */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Recent Activity</h3>
                <button onClick={() => navigate('/issues')} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                {recentIssues.length === 0 && recentFindings.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-3">No active work yet. Sync a repository to get started.</p>
                ) : (
                  <>
                    {recentIssues.map((issue) => (
                      <div key={`issue-${issue.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-4 h-4 text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">{issue.title}</p>
                            <p className="text-xs text-zinc-500">{issue.repo_full_name} #{issue.number}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <SeverityBadge severity={issue.severity} />
                          <StatusBadge status={issue.status} />
                          {issue.pr_url && (
                            <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {recentFindings.map((finding) => (
                      <div key={`finding-${finding.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">{finding.rule}</p>
                            <p className="text-xs text-zinc-500">{finding.repo_full_name} - {finding.cwe_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <SeverityBadge severity={finding.severity} />
                          <StatusBadge status={finding.status} />
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Quick Stats</h3>
              </div>
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-lg bg-zinc-800/40">
                  <p className="text-[10px] text-zinc-500">Connected Repos</p>
                  <p className="text-base font-bold text-zinc-200">{analytics?.connected_repos || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-800/40">
                  <p className="text-[10px] text-zinc-500">Total Issues</p>
                  <p className="text-base font-bold text-zinc-200">{analytics?.total_issues || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-800/40">
                  <p className="text-[10px] text-zinc-500">Security Findings</p>
                  <p className="text-base font-bold text-zinc-200">{analytics?.total_findings || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-800/40">
                  <p className="text-[10px] text-zinc-500">Devin Sessions</p>
                  <p className="text-base font-bold text-zinc-200">{analytics?.total_sessions || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-800/40">
                  <p className="text-[10px] text-zinc-500">Compliance Score</p>
                  <p className="text-base font-bold text-emerald-400">{analytics?.compliance_score || 100}%</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
