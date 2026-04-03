import { IssueStatus, IssueSeverity } from '../../types';

const statusConfig: Record<IssueStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/50' },
  triaged: { label: 'Triaged', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  approved: { label: 'Approved', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pr_open: { label: 'PR Open', className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  resolved: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

const severityConfig: Record<IssueSeverity, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  high: { label: 'High', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  medium: { label: 'Medium', className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  low: { label: 'Low', className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mr-1.5" />}
      {status === 'resolved' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />}
      {config.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const config = severityConfig[severity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {severity === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse mr-1.5" />}
      {config.label}
    </span>
  );
}
