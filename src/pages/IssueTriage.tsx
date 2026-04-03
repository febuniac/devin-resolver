import { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle2, Zap, ExternalLink, Play, GitPullRequest, ChevronDown, ChevronUp, Brain, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { StatusBadge, SeverityBadge } from '../components/ui/StatusBadge';
import ConfidenceMeter from '../components/ui/ConfidenceMeter';
import { IssueSeverity, IssueStatus, IssueCategory } from '../types';
import api from '../api/client';

interface Issue {
  id: number;
  github_id: number;
  number: number;
  title: string;
  body: string;
  repo_full_name: string;
  labels: string[];
  state: string;
  author: string;
  created_at: string;
  updated_at: string;
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
  slack_notified: boolean;
  video_url: string | null;
}

export default function IssueTriage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    try {
      const data = await api.listIssues();
      setIssues(data);
    } catch {
      setError('Failed to load issues. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const triageAll = async () => {
    setTriaging(true);
    try {
      await api.triageAll();
      await loadIssues();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to triage');
    } finally {
      setTriaging(false);
    }
  };

  const approveSelected = async () => {
    try {
      await api.approveIssues(Array.from(selectedIssues));
      setSelectedIssues(new Set());
      await loadIssues();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    }
  };

  const filteredIssues = issues.filter((issue) => {
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    return true;
  });

  const toggleIssue = (id: number) => {
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIssues(newSelected);
  };

  const selectAll = () => {
    if (selectedIssues.size === filteredIssues.length) setSelectedIssues(new Set());
    else setSelectedIssues(new Set(filteredIssues.map(i => i.id)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Issue Triage</h1>
          <p className="text-sm text-zinc-500 mt-1">AI-powered analysis and categorization of {issues.length} issues across all repositories</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIssues.size > 0 && (
            <button onClick={approveSelected} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approve {selectedIssues.size} for Devin
            </button>
          )}
          <button onClick={loadIssues} className="glass glass-hover px-3 py-2 rounded-lg text-sm text-zinc-300 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={triageAll} disabled={triaging} className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {triaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {triaging ? 'Triaging...' : 'Triage All'}
          </button>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Brain className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-300 mb-2">No Issues Yet</h3>
          <p className="text-sm text-zinc-500 mb-4">Connect a GitHub repository in Settings and sync it to start seeing issues here.</p>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: 'Total', count: issues.length, color: 'text-zinc-300' },
              { label: 'Critical', count: issues.filter(i => i.severity === 'critical').length, color: 'text-red-400' },
              { label: 'Triaged', count: issues.filter(i => i.status === 'triaged').length, color: 'text-blue-400' },
              { label: 'Approved', count: issues.filter(i => i.status === 'approved').length, color: 'text-violet-400' },
              { label: 'In Progress', count: issues.filter(i => i.status === 'in_progress').length, color: 'text-amber-400' },
              { label: 'Resolved', count: issues.filter(i => i.status === 'resolved').length, color: 'text-emerald-400' },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | 'all')}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="triaged">Triaged</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="pr_open">PR Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as IssueCategory | 'all')}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">All Categories</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="security">Security</option>
            <option value="performance">Performance</option>
            <option value="refactor">Refactor</option>
          </select>
        </div>
      </div>

      {/* Issue List */}
      {filteredIssues.length > 0 && (
      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <div className="w-6">
            <input
              type="checkbox"
              checked={selectedIssues.size === filteredIssues.length && filteredIssues.length > 0}
              onChange={selectAll}
              className="rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500"
            />
          </div>
          <div className="flex-1">Issue</div>
          <div className="w-28">Severity</div>
          <div className="w-28">Status</div>
          <div className="w-24">Confidence</div>
          <div className="w-20">Effort</div>
          <div className="w-20">Actions</div>
        </div>

        {filteredIssues.map((issue, index) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            index={index}
            expanded={expandedIssue === issue.id}
            selected={selectedIssues.has(issue.id)}
            onToggleExpand={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
            onToggleSelect={() => toggleIssue(issue.id)}
          />
        ))}
      </div>
      )}
    </div>
  );
}

function IssueRow({ issue, index, expanded, selected, onToggleExpand, onToggleSelect }: {
  issue: Issue;
  index: number;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}) {
  const categoryColors: Record<string, string> = {
    bug: 'bg-red-500/15 text-red-400',
    feature: 'bg-blue-500/15 text-blue-400',
    security: 'bg-amber-500/15 text-amber-400',
    performance: 'bg-violet-500/15 text-violet-400',
    refactor: 'bg-cyan-500/15 text-cyan-400',
    documentation: 'bg-emerald-500/15 text-emerald-400',
  };

  return (
    <div className="glass rounded-lg overflow-hidden animate-slide-in" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-4 px-4 py-3 glass-hover cursor-pointer" onClick={onToggleExpand}>
        <div className="w-6" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {}}
            className="rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono">#{issue.number}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${categoryColors[issue.category] || 'bg-zinc-500/15 text-zinc-400'}`}>{issue.category}</span>
          </div>
          <p className="text-sm font-medium text-zinc-200 mt-0.5 truncate">{issue.title}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{issue.repo_full_name}</p>
        </div>
        <div className="w-28"><SeverityBadge severity={issue.severity} /></div>
        <div className="w-28"><StatusBadge status={issue.status} /></div>
        <div className="w-24"><ConfidenceMeter value={issue.ai_confidence} /></div>
        <div className="w-20 text-xs text-zinc-400">{issue.estimated_effort}</div>
        <div className="w-20 flex items-center gap-1">
          {issue.pr_url && <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />}
          {issue.video_url && <Play className="w-3.5 h-3.5 text-violet-400" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800/50 space-y-3 animate-fade-in">
          <div className="glass rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">AI Analysis</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{issue.ai_summary || 'Not yet triaged. Click "Triage All" to analyze.'}</p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>Created by <span className="text-zinc-300">@{issue.author}</span></span>
              <span>Created {issue.created_at}</span>
              {issue.labels.length > 0 && <span>Labels: {issue.labels.join(', ')}</span>}
            </div>
          </div>

          {issue.body && (
            <div className="glass rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-1">Description</p>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap line-clamp-6">{issue.body}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {(issue.status === 'triaged' || issue.status === 'open') && (
              <button
                onClick={(e) => { e.stopPropagation(); api.approveIssues([issue.id]).then(() => window.location.reload()); }}
                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Approve for Devin
              </button>
            )}
            {issue.devin_session_url && (
              <a href={issue.devin_session_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-violet-400 flex items-center gap-2">
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
            {issue.video_url && (
              <a href={issue.video_url} target="_blank" rel="noopener noreferrer" className="glass glass-hover px-4 py-2 rounded-lg text-sm font-medium text-emerald-400 flex items-center gap-2">
                <Play className="w-4 h-4" />
                Watch Test Recording
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
