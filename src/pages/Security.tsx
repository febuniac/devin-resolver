import { useState } from 'react';
import { Shield, Search, Filter, AlertTriangle, CheckCircle2, Zap, ExternalLink, ChevronDown, ChevronUp, Brain, FileCode, Lock } from 'lucide-react';
import { StatusBadge, SeverityBadge } from '../components/ui/StatusBadge';
import ConfidenceMeter from '../components/ui/ConfidenceMeter';
import { securityFindings } from '../data/mockData';
import { SecurityFinding, SecuritySeverity, IssueStatus } from '../types';

export default function Security() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());

  const filteredFindings = securityFindings.filter((f) => {
    if (searchQuery && !f.rule.toLowerCase().includes(searchQuery.toLowerCase()) && !f.file.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  const toggleFinding = (id: string) => {
    const newSelected = new Set(selectedFindings);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedFindings(newSelected);
  };

  const selectAll = () => {
    if (selectedFindings.size === filteredFindings.length) setSelectedFindings(new Set());
    else setSelectedFindings(new Set(filteredFindings.map(f => f.id)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Findings</h1>
          <p className="text-sm text-zinc-500 mt-1">CodeQL scan results - {securityFindings.length} findings across all repositories</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedFindings.size > 0 && (
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approve {selectedFindings.size} for Devin
            </button>
          )}
          <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Run CodeQL Scan
          </button>
        </div>
      </div>

      {/* Compliance Banner */}
      <div className="glass rounded-xl p-4 border-l-4 border-amber-500/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">HIPAA Compliance Status</p>
              <p className="text-xs text-zinc-500 mt-0.5">Last audit flagged {securityFindings.filter(f => f.severity === 'critical' && f.status !== 'resolved').length} critical findings. Devin is actively remediating.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-zinc-500">Remediation Rate</p>
              <p className="text-lg font-bold text-emerald-400">78%</p>
            </div>
            <div className="w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400" style={{ width: '78%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total', count: securityFindings.length, color: 'text-zinc-300' },
          { label: 'Critical', count: securityFindings.filter(f => f.severity === 'critical').length, color: 'text-red-400' },
          { label: 'High', count: securityFindings.filter(f => f.severity === 'high').length, color: 'text-orange-400' },
          { label: 'In Progress', count: securityFindings.filter(f => f.status === 'in_progress').length, color: 'text-amber-400' },
          { label: 'PR Open', count: securityFindings.filter(f => f.status === 'pr_open').length, color: 'text-cyan-400' },
          { label: 'Resolved', count: securityFindings.filter(f => f.status === 'resolved').length, color: 'text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-lg p-3 text-center">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by rule, file, or CWE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SecuritySeverity | 'all')} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50">
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50">
            <option value="all">All Status</option>
            <option value="triaged">Triaged</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="pr_open">PR Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <div className="w-6">
            <input type="checkbox" checked={selectedFindings.size === filteredFindings.length && filteredFindings.length > 0} onChange={selectAll} className="rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500" />
          </div>
          <div className="flex-1">Finding</div>
          <div className="w-28">Severity</div>
          <div className="w-28">Status</div>
          <div className="w-24">Confidence</div>
          <div className="w-20">CWE</div>
          <div className="w-8"></div>
        </div>

        {filteredFindings.map((finding, index) => (
          <FindingRow
            key={finding.id}
            finding={finding}
            index={index}
            expanded={expandedFinding === finding.id}
            selected={selectedFindings.has(finding.id)}
            onToggleExpand={() => setExpandedFinding(expandedFinding === finding.id ? null : finding.id)}
            onToggleSelect={() => toggleFinding(finding.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FindingRow({ finding, index, expanded, selected, onToggleExpand, onToggleSelect }: {
  finding: SecurityFinding;
  index: number;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}) {
  return (
    <div className="glass rounded-lg overflow-hidden animate-slide-in" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-4 px-4 py-3 glass-hover cursor-pointer" onClick={onToggleExpand}>
        <div className="w-6" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <input type="checkbox" checked={selected} onChange={() => {}} className="rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-3.5 h-3.5 ${finding.severity === 'critical' ? 'text-red-400' : finding.severity === 'high' ? 'text-orange-400' : 'text-yellow-400'}`} />
            <span className="text-xs text-zinc-500 font-mono">{finding.ruleId}</span>
          </div>
          <p className="text-sm font-medium text-zinc-200 mt-0.5 truncate">{finding.rule}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <FileCode className="w-3 h-3 text-zinc-600" />
            <p className="text-xs text-zinc-500 truncate">{finding.file}:{finding.line}</p>
          </div>
        </div>
        <div className="w-28"><SeverityBadge severity={finding.severity} /></div>
        <div className="w-28"><StatusBadge status={finding.status} /></div>
        <div className="w-24"><ConfidenceMeter value={finding.aiConfidence} /></div>
        <div className="w-20 text-xs text-zinc-400 font-mono">{finding.cweId}</div>
        <div className="w-8">
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 animate-fade-in">
          <div className="glass rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">AI Remediation Plan</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{finding.aiSummary}</p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>Category: <span className="text-zinc-300">{finding.category}</span></span>
              <span>Detected: {finding.detectedAt}</span>
              <span>Est. effort: <span className="text-zinc-300">{finding.estimatedEffort}</span></span>
            </div>
          </div>

          <div className="glass rounded-lg p-3">
            <p className="text-xs text-zinc-500 mb-1">Description</p>
            <p className="text-sm text-zinc-400">{finding.description}</p>
          </div>

          <div className="flex items-center gap-3">
            {(finding.status === 'triaged' || finding.status === 'approved') && (
              <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Zap className="w-4 h-4" />
                {finding.status === 'triaged' ? 'Approve for Devin' : 'Start Devin Session'}
              </button>
            )}
            {finding.devinSessionUrl && (
              <button className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-violet-400 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                View Devin Session
              </button>
            )}
            {finding.prUrl && (
              <button className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-cyan-400 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                View PR #{finding.prNumber}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
