import { useState, useEffect } from 'react';
import { Clock, Bug, Shield, Users, Calendar, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import MetricCard from '../components/ui/MetricCard';
import api from '../api/client';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3 text-xs space-y-1">
        <p className="text-zinc-300 font-medium">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analytics, setAnalytics] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then(data => {
      setAnalytics(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-devin-blue animate-spin" />
      </div>
    );
  }

  const issuesByCategory = analytics?.issues_by_category || [];
  const issuesBySeverity = analytics?.issues_by_severity || [];
  const categoryColors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899'];
  const categoryData = Object.entries(issuesByCategory).map(([name, value], i) => ({
    name, value: value as number, color: categoryColors[i % categoryColors.length],
  }));

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Analytics & Reports</h1>
          <p className="text-xs text-zinc-500">Track the impact of automated issue resolution across your organization</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            All time
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-2">
        <MetricCard title="Issues Resolved" value={analytics?.issues_resolved || 0} icon={Bug} iconColor="text-emerald-400" />
        <MetricCard title="Open Issues" value={analytics?.issues_open || 0} icon={Clock} iconColor="text-blue-400" />
        <MetricCard title="Security Fixed" value={analytics?.security_findings_fixed || 0} icon={Shield} iconColor="text-amber-400" />
        <MetricCard title="Engineer Hours Saved" value={analytics?.engineer_hours_saved || 0} icon={Users} iconColor="text-devin-blue" subtitle={`$${((analytics?.engineer_hours_saved || 0) * 200).toLocaleString()} saved`} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Issue Status Breakdown */}
        <div className="glass rounded-xl p-3">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Issue Status Breakdown</h3>
          {categoryData.length > 0 ? (
            <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {categoryData.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-zinc-500">{cat.name} ({cat.value})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
              No issue data yet. Sync a repository to see breakdowns.
            </div>
          )}
        </div>

        {/* Severity Breakdown */}
        <div className="glass rounded-xl p-3">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Issues by Severity</h3>
          {Object.keys(issuesBySeverity).length > 0 ? (
            <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={Object.entries(issuesBySeverity).map(([name, value]) => ({ name, count: value as number }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Issues" />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
              No severity data yet. Sync and triage issues to see breakdowns.
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="glass rounded-xl p-3">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Platform Overview</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-devin-blue">{analytics?.connected_repos || 0}</p>
            <p className="text-xs text-zinc-500">Connected Repos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{analytics?.total_issues || 0}</p>
            <p className="text-xs text-zinc-500">Total Issues</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{analytics?.total_findings || 0}</p>
            <p className="text-xs text-zinc-500">Security Findings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{analytics?.compliance_score || 100}%</p>
            <p className="text-xs text-zinc-500">Compliance Score</p>
          </div>
        </div>
      </div>

      {/* PR Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-cyan-400">{analytics?.prs_created || 0}</p>
          <p className="text-xs text-zinc-500 mt-1">PRs Created</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{analytics?.prs_merged || 0}</p>
          <p className="text-xs text-zinc-500 mt-1">PRs Merged</p>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-devin-blue">
            {analytics?.prs_created ? Math.round((analytics.prs_merged / analytics.prs_created) * 100) : 0}%
          </p>
          <p className="text-xs text-zinc-500 mt-1">Merge Rate</p>
        </div>
      </div>
    </div>
  );
}
