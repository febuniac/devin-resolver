import { TrendingUp, Clock, Bug, Shield, Users, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Area, AreaChart } from 'recharts';
import MetricCard from '../components/ui/MetricCard';
import { kpiData, weeklyData, categoryBreakdown } from '../data/mockData';

const resolutionTimeData = [
  { week: 'Week 1', manual: 8.2, devin: 4.1 },
  { week: 'Week 2', manual: 7.5, devin: 3.8 },
  { week: 'Week 3', manual: 7.8, devin: 3.2 },
  { week: 'Week 4', manual: 8.0, devin: 2.9 },
  { week: 'Week 5', manual: 7.3, devin: 2.5 },
  { week: 'Week 6', manual: 7.9, devin: 2.4 },
  { week: 'Week 7', manual: 7.6, devin: 2.2 },
  { week: 'Week 8', manual: 8.1, devin: 2.0 },
];

const prSuccessData = [
  { week: 'Week 1', created: 5, merged: 3, rejected: 1 },
  { week: 'Week 2', created: 8, merged: 6, rejected: 1 },
  { week: 'Week 3', created: 10, merged: 8, rejected: 1 },
  { week: 'Week 4', created: 12, merged: 10, rejected: 1 },
  { week: 'Week 5', created: 14, merged: 12, rejected: 0 },
  { week: 'Week 6', created: 11, merged: 10, rejected: 0 },
  { week: 'Week 7', created: 15, merged: 14, rejected: 0 },
  { week: 'Week 8', created: 13, merged: 12, rejected: 0 },
];

const costSavingsData = [
  { month: 'Jan', hoursSaved: 45, costSaved: 9000 },
  { month: 'Feb', hoursSaved: 78, costSaved: 15600 },
  { month: 'Mar', hoursSaved: 120, costSaved: 24000 },
  { month: 'Apr', hoursSaved: 156, costSaved: 31200 },
];

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
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics & Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">Track the impact of automated issue resolution across your organization</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Last 8 weeks
          </button>
          <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Issues Resolved" value={kpiData.issuesResolved} trend={kpiData.issuesResolvedTrend} icon={Bug} iconColor="text-emerald-400" />
        <MetricCard title="Avg Resolution" value={kpiData.avgResolutionTime} trend={kpiData.avgResolutionTimeTrend} icon={Clock} iconColor="text-blue-400" />
        <MetricCard title="Security Fixed" value={kpiData.securityFindingsFixed} trend={kpiData.securityFindingsFixedTrend} icon={Shield} iconColor="text-amber-400" />
        <MetricCard title="Engineer Hours Saved" value={kpiData.engineerHoursSaved} icon={Users} iconColor="text-violet-400" subtitle="$62,400 saved" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Issues Over Time */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Issues Resolved vs Opened</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} name="Resolved" />
              <Area type="monotone" dataKey="opened" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} name="Opened" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-0.5 bg-emerald-500 rounded" /><span className="text-zinc-500">Resolved</span></div>
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-0.5 bg-red-500 rounded" /><span className="text-zinc-500">Opened</span></div>
          </div>
        </div>

        {/* Resolution Time Comparison */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Resolution Time: Manual vs Devin (hours)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={resolutionTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="manual" fill="#ef4444" radius={[4, 4, 0, 0]} name="Manual" opacity={0.6} />
              <Bar dataKey="devin" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Devin" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded bg-red-500/60" /><span className="text-zinc-500">Manual</span></div>
            <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded bg-violet-500" /><span className="text-zinc-500">Devin</span></div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-4">
        {/* Category Breakdown */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Issues by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                {categoryBreakdown.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-zinc-500">{cat.name} ({cat.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* PR Success Rate */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">PR Success Rate</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={prSuccessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="merged" fill="#10b981" radius={[4, 4, 0, 0]} name="Merged" stackId="a" />
              <Bar dataKey="rejected" fill="#ef4444" radius={[4, 4, 0, 0]} name="Rejected" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <p className="text-2xl font-bold text-emerald-400">92%</p>
            <p className="text-xs text-zinc-500">Merge rate</p>
          </div>
        </div>

        {/* Cost Savings */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">Engineer Hours Saved</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={costSavingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="hoursSaved" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} name="Hours Saved" />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <p className="text-2xl font-bold text-violet-400">$62.4K</p>
            <p className="text-xs text-zinc-500">Total savings (@ $200/hr)</p>
          </div>
        </div>
      </div>

      {/* Security Compliance Trend */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Security Findings Trend</h3>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">67% reduction in open critical findings</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="securityFixed" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} name="Security Findings Fixed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
