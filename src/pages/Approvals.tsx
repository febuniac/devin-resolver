import { useState } from 'react';
import { CheckCircle2, XCircle, Zap, Shield, Bug, Clock, ToggleLeft, ToggleRight, Brain, AlertTriangle } from 'lucide-react';
import { SeverityBadge } from '../components/ui/StatusBadge';
import ConfidenceMeter from '../components/ui/ConfidenceMeter';
import { githubIssues, securityFindings } from '../data/mockData';

export default function Approvals() {
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(90);
  const [autoApproveSeverity, setAutoApproveSeverity] = useState<string>('medium');

  const pendingIssues = githubIssues.filter(i => i.status === 'triaged');
  const pendingSecurityFindings = securityFindings.filter(f => f.status === 'triaged' || f.status === 'approved');

  const [approvedItems, setApprovedItems] = useState<Set<string>>(new Set());
  const [rejectedItems, setRejectedItems] = useState<Set<string>>(new Set());

  const handleApprove = (id: string) => {
    const newApproved = new Set(approvedItems);
    newApproved.add(id);
    setApprovedItems(newApproved);
    rejectedItems.delete(id);
    setRejectedItems(new Set(rejectedItems));
  };

  const handleReject = (id: string) => {
    const newRejected = new Set(rejectedItems);
    newRejected.add(id);
    setRejectedItems(newRejected);
    approvedItems.delete(id);
    setApprovedItems(new Set(approvedItems));
  };

  const approveAll = () => {
    const allIds = [...pendingIssues.map(i => i.id), ...pendingSecurityFindings.map(f => f.id)];
    setApprovedItems(new Set(allIds));
    setRejectedItems(new Set());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Approval Queue</h1>
          <p className="text-sm text-zinc-500 mt-1">Review and approve issues for Devin to work on. Average approval time: 30 seconds.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={approveAll} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Approve All ({pendingIssues.length + pendingSecurityFindings.length})
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
          <button
            onClick={() => setAutoApproveEnabled(!autoApproveEnabled)}
            className="flex items-center gap-2"
          >
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
                  onChange={(e) => setAutoApproveThreshold(Number(e.target.value))}
                  className="flex-1 accent-violet-500"
                />
                <span className="text-sm font-medium text-violet-400 w-12 text-right">{autoApproveThreshold}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Max Severity to Auto-Approve</label>
              <select
                value={autoApproveSeverity}
                onChange={(e) => setAutoApproveSeverity(e.target.value)}
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
                  {githubIssues.filter(i => i.aiConfidence >= autoApproveThreshold).length} issues
                </span> and <span className="text-violet-400 font-medium">
                  {securityFindings.filter(f => f.aiConfidence >= autoApproveThreshold).length} security findings
                </span> would be auto-approved.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pending Issues */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bug className="w-4 h-4" />
          GitHub Issues ({pendingIssues.length})
        </h3>
        <div className="space-y-2">
          {pendingIssues.map((issue, index) => (
            <div key={issue.id} className="glass rounded-lg p-4 animate-slide-in flex items-center gap-4" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-mono">#{issue.number}</span>
                  <SeverityBadge severity={issue.severity} />
                </div>
                <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{issue.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{issue.repo}</p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <ConfidenceMeter value={issue.aiConfidence} />
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>{issue.estimatedEffort}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {approvedItems.has(issue.id) ? (
                  <span className="text-xs font-medium text-emerald-400 px-3 py-2">Approved</span>
                ) : rejectedItems.has(issue.id) ? (
                  <span className="text-xs font-medium text-red-400 px-3 py-2">Skipped</span>
                ) : (
                  <>
                    <button onClick={() => handleReject(issue.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleApprove(issue.id)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {pendingIssues.length === 0 && (
            <div className="glass rounded-lg p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">All issues have been reviewed</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Security Findings */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security Findings ({pendingSecurityFindings.length})
        </h3>
        <div className="space-y-2">
          {pendingSecurityFindings.map((finding, index) => (
            <div key={finding.id} className="glass rounded-lg p-4 animate-slide-in flex items-center gap-4" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-3.5 h-3.5 ${finding.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
                  <span className="text-xs text-zinc-500 font-mono">{finding.cweId}</span>
                  <SeverityBadge severity={finding.severity} />
                </div>
                <p className="text-sm font-medium text-zinc-200 mt-1 truncate">{finding.rule}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{finding.file}:{finding.line}</p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <ConfidenceMeter value={finding.aiConfidence} />
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="w-3 h-3" />
                  <span>{finding.estimatedEffort}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {approvedItems.has(finding.id) ? (
                  <span className="text-xs font-medium text-emerald-400 px-3 py-2">Approved</span>
                ) : rejectedItems.has(finding.id) ? (
                  <span className="text-xs font-medium text-red-400 px-3 py-2">Skipped</span>
                ) : (
                  <>
                    <button onClick={() => handleReject(finding.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleApprove(finding.id)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
