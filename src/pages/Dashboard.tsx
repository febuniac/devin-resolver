import { Bug, Shield, GitPullRequest, Clock, Users, TrendingUp, Zap, CheckCircle2, AlertTriangle, ArrowRight, Play, ExternalLink, MessageSquare } from 'lucide-react';
import MetricCard from '../components/ui/MetricCard';
import WorkflowPipeline from '../components/ui/WorkflowPipeline';
import { StatusBadge, SeverityBadge } from '../components/ui/StatusBadge';
import { kpiData, githubIssues, securityFindings, slackMessages } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const recentIssues = githubIssues.filter(i => i.status === 'in_progress' || i.status === 'pr_open').slice(0, 3);
  const recentSecurity = securityFindings.filter(f => f.status === 'in_progress' || f.status === 'pr_open').slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-sm text-zinc-500 mt-1">Real-time overview of Devin resolving your issues autonomously</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-zinc-300">3 Devin sessions active</span>
          </div>
          <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Run Triage Now
          </button>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <WorkflowPipeline />

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard title="Issues Resolved" value={kpiData.issuesResolved} trend={kpiData.issuesResolvedTrend} icon={Bug} iconColor="text-emerald-400" subtitle="This month" />
        <MetricCard title="Avg Resolution" value={kpiData.avgResolutionTime} trend={kpiData.avgResolutionTimeTrend} icon={Clock} iconColor="text-blue-400" subtitle="Down from 4.3 hrs" />
        <MetricCard title="Security Fixed" value={kpiData.securityFindingsFixed} trend={kpiData.securityFindingsFixedTrend} icon={Shield} iconColor="text-amber-400" subtitle="CodeQL findings" />
        <MetricCard title="PRs Created" value={kpiData.prsCreated} icon={GitPullRequest} iconColor="text-cyan-400" subtitle={`${kpiData.prsMerged} merged`} />
        <MetricCard title="Hours Saved" value={kpiData.engineerHoursSaved} icon={Users} iconColor="text-violet-400" subtitle="Engineer hours" />
      </div>

      {/* Active Work & Slack */}
      <div className="grid grid-cols-3 gap-4">
        {/* Active Issues Being Worked */}
        <div className="col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Active Devin Sessions</h3>
            <button onClick={() => navigate('/issues')} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{issue.title}</p>
                    <p className="text-xs text-zinc-500">{issue.repo} #{issue.number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <SeverityBadge severity={issue.severity} />
                  <StatusBadge status={issue.status} />
                  {issue.videoUrl && (
                    <button className="text-zinc-500 hover:text-violet-400 transition-colors">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {issue.prUrl && (
                    <button className="text-zinc-500 hover:text-cyan-400 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {recentSecurity.map((finding) => (
              <div key={finding.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{finding.rule}</p>
                    <p className="text-xs text-zinc-500">{finding.repo} - {finding.cweId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <SeverityBadge severity={finding.severity} />
                  <StatusBadge status={finding.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slack Feed */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Slack Feed</h3>
            <MessageSquare className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="space-y-3">
            {slackMessages.map((msg) => (
              <div key={msg.id} className="p-3 rounded-lg bg-zinc-800/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-violet-400">{msg.channel}</span>
                  <span className="text-xs text-zinc-600">{msg.timestamp}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{msg.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Compliance Score */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Compliance Score</h3>
              <p className="text-xs text-zinc-500 mt-1">Based on open critical/high security findings</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-400">{kpiData.complianceScore}%</p>
              <div className="flex items-center gap-1 justify-end">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">+{kpiData.complianceScoreTrend}% this month</span>
              </div>
            </div>
            <div className="w-48 h-3 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000" style={{ width: `${kpiData.complianceScore}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4">
          {[
            { label: 'Critical Findings', value: '2 open', icon: AlertTriangle, color: 'text-red-400' },
            { label: 'High Findings', value: '5 open', icon: AlertTriangle, color: 'text-orange-400' },
            { label: 'Being Fixed', value: '4 in progress', icon: Zap, color: 'text-violet-400' },
            { label: 'Fixed This Month', value: '31 resolved', icon: CheckCircle2, color: 'text-emerald-400' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <div>
                <p className="text-xs text-zinc-500">{item.label}</p>
                <p className="text-sm font-medium text-zinc-200">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
