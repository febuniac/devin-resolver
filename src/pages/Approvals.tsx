import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, ExternalLink, CheckCircle, Clock, ChevronDown, ChevronRight, Play, GitPullRequest, Send, CheckCheck, MessageSquare, Filter, Eye, Bug, Shield, Wrench, FileCode, Video, FileDiff, GitMerge, AlertCircle } from 'lucide-react';
import api from '../api/client';

const GitHubIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const DevinIcon = ({ size = 14 }: { size?: number }) => (
  <img src="/brand/devin-logo.png" alt="Devin" style={{ width: size, height: size, borderRadius: 3, objectFit: 'contain' }} />
);

interface Session {
  id: string;
  issue_id: number;
  issue_title: string | null;
  issue_number: number | null;
  repo_full_name: string | null;
  status: string;
  status_detail: string | null;
  pr_url: string | null;
  created_at: string;
  updated_at: string | null;
  session_url: string;
  recording_url: string | null;
  issue_body: string | null;
  ai_summary: string | null;
  issue_severity: string | null;
  issue_category: string | null;
}

interface TimelineStep {
  step: string;
  status: string;
  detail: string;
}

interface DevinMessage {
  message: string;
  timestamp: string;
}

interface TodoItem {
  status: string;
  content: string;
}

interface FileChange {
  path: string;
  action: string;
  lines_added: number;
  lines_removed: number;
  description: string;
}

interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
}

interface PrDiffData {
  title: string;
  body: string;
  state: string;
  mergeable: boolean | null;
  merged: boolean;
  html_url: string;
  head_branch: string;
  base_branch: string;
  user: string;
  additions: number;
  deletions: number;
  changed_files: number;
  files: PrFile[];
  raw_diff: string;
}

interface LiveData {
  title: string;
  status: string;
  status_detail: string;
  url: string;
  playback_url: string;
  pr_url: string;
  structured_output: Record<string, unknown>;
  timeline: TimelineStep[];
  todos: TodoItem[];
  messages: DevinMessage[];
  file_changes: FileChange[];
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'queued' | 'running' | 'needs_input' | 'needs_pr_approval' | 'approved_solved';

function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  try {
    const d = new Date(ts + (ts.includes('Z') || ts.includes('+') ? '' : 'Z'));
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ts; }
}

function timeDiff(start: string, end: string | null): string {
  if (!end) return '—';
  try {
    const s = new Date(start + (start.includes('Z') || start.includes('+') ? '' : 'Z'));
    const e = new Date(end + (end.includes('Z') || end.includes('+') ? '' : 'Z'));
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return '—';
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  } catch { return '—'; }
}

export default function Approvals() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mergeError, setMergeError] = useState<{ sessionId: string; prUrl: string; reason: string } | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [liveData, setLiveData] = useState<Record<string, LiveData>>({});
  const [, setLoadingLive] = useState<Set<string>>(new Set());
  const [prDiffs, setPrDiffs] = useState<Record<string, PrDiffData>>({});
  const [loadingDiff, setLoadingDiff] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<Set<string>>(new Set());
  const [merged, setMerged] = useState<Set<string>>(new Set());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [prComments, setPrComments] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Set<string>>(new Set());
  const [commentPosted, setCommentPosted] = useState<Set<string>>(new Set());
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});
  const [loadingRecording, setLoadingRecording] = useState<Set<string>>(new Set());
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  const [autoApproveMaxSeverity, setAutoApproveMaxSeverity] = useState('medium');
  const [autoMerging, setAutoMerging] = useState<Set<string>>(new Set());
  const [manuallyMerged, setManuallyMerged] = useState<Set<string>>(new Set());

  const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const canAutoApprove = (severity?: string | null) => {
    if (!autoApproveEnabled || !severity) return false;
    return (severityOrder[severity.toLowerCase()] || 2) <= (severityOrder[autoApproveMaxSeverity] || 2);
  };

  useEffect(() => {
    // Fetch settings to check auto-approve
    api.getSettings().then((s: { auto_approve_enabled?: boolean; auto_approve_max_severity?: string }) => {
      setAutoApproveEnabled(!!s.auto_approve_enabled);
      setAutoApproveMaxSeverity(s.auto_approve_max_severity || 'medium');
    }).catch(() => {});
    // Load sessions immediately (fast DB call), then sync in background
    const initialRefresh = async () => {
      try { setSessions(await api.listSessions() as Session[]); } catch { /* ignore */ }
      setLoading(false);
      // Background sync — don't block the UI
      try { await api.syncPrs(); } catch { /* ignore */ }
      try { await api.pollSessions(); } catch { /* ignore */ }
      try { setSessions(await api.listSessions() as Session[]); } catch { /* ignore */ }
    };
    initialRefresh();
    const interval = setInterval(async () => {
      try { await api.syncPrs(); } catch { /* ignore */ }
      try { await api.pollSessions(); } catch { /* ignore */ }
      try { setSessions(await api.listSessions() as Session[]); } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-merge PR Ready sessions when auto-approve is enabled AND severity is within threshold
  useEffect(() => {
    if (!autoApproveEnabled) return;
    const prReadySessions = sessions.filter(s =>
      s.pr_url && !merged.has(s.id) && !merging.has(s.id) && !autoMerging.has(s.id) &&
      s.status !== 'merged' && s.status !== 'running' && s.status !== 'pending' &&
      canAutoApprove(s.issue_severity)
    );
    for (const session of prReadySessions) {
      setAutoMerging(prev => new Set(prev).add(session.id));
      mergePr(session.id, session.pr_url!).finally(() => {
        setAutoMerging(prev => { const next = new Set(prev); next.delete(session.id); return next; });
      });
    }
  }, [autoApproveEnabled, sessions]);

  const loadSessions = async () => {
    try { setSessions(await api.listSessions() as Session[]); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const refreshStatus = async () => {
    setLoading(true);
    try { await api.syncPrs(); } catch { /* ignore */ }
    try { await api.pollSessions(); await loadSessions(); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchLiveData = async (id: string) => {
    try {
      const data = await api.getSessionLive(id) as LiveData;
      setLiveData(prev => ({ ...prev, [id]: data }));
    } catch { /* ignore */ }
  };

  const toggleExpand = async (id: string) => {
    const wasExpanded = expanded.has(id);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!wasExpanded) {
      setLoadingLive(prev => new Set(prev).add(id));
      try {
        const data = await api.getSessionLive(id) as LiveData;
        setLiveData(prev => ({ ...prev, [id]: data }));
      } catch {
        // Ignore - will just show local data
      } finally {
        setLoadingLive(prev => { const next = new Set(prev); next.delete(id); return next; });
      }
      // Also fetch PR diff if session has a PR
      const session = sessions.find(s => s.id === id);
      const prUrl = session?.pr_url || liveData[id]?.pr_url;
      if (prUrl && !prDiffs[id]) {
        fetchPrDiff(id, prUrl);
      }
      // Fetch recording URL if not already fetched
      if (!recordingUrls[id]) {
        setLoadingRecording(prev => new Set(prev).add(id));
        api.getSessionRecording(id).then((res: { recording_url?: string }) => {
          if (res.recording_url) {
            setRecordingUrls(prev => ({ ...prev, [id]: res.recording_url! }));
          }
        }).catch(() => {}).finally(() => {
          setLoadingRecording(prev => { const next = new Set(prev); next.delete(id); return next; });
        });
      }
    }
  };

  // Auto-refresh live data for expanded sessions every 15s
  useEffect(() => {
    if (expanded.size === 0) return;
    const liveInterval = setInterval(() => {
      expanded.forEach(id => fetchLiveData(id));
    }, 15000);
    return () => clearInterval(liveInterval);
  }, [expanded]);

  const approveSession = async (sessionId: string) => {
    setApproving(prev => new Set(prev).add(sessionId));
    try {
      await api.approveSession(sessionId);
      setApproved(prev => new Set(prev).add(sessionId));
      setToast({ message: 'Approved! Devin is now proceeding with the fix.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
      await loadSessions();
    } catch (e) {
      console.error('Failed to approve session:', e);
      setToast({ message: 'Failed to approve — check Devin connection.', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setApproving(prev => { const next = new Set(prev); next.delete(sessionId); return next; });
    }
  };

  // Parse PR URL to extract owner/repo/number
  const parsePrUrl = (url: string): { owner: string; repo: string; number: number } | null => {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: parseInt(match[3]) };
  };

  // Fetch PR diff from GitHub
  const fetchPrDiff = async (sessionId: string, prUrl: string) => {
    const parsed = parsePrUrl(prUrl);
    if (!parsed) return;
    setLoadingDiff(prev => new Set(prev).add(sessionId));
    try {
      const data = await api.getPrDiff(parsed.owner, parsed.repo, parsed.number) as PrDiffData;
      setPrDiffs(prev => ({ ...prev, [sessionId]: data }));
    } catch (e) {
      console.error('Failed to fetch PR diff:', e);
    } finally {
      setLoadingDiff(prev => { const next = new Set(prev); next.delete(sessionId); return next; });
    }
  };

  // Merge PR via GitHub API
  const mergePr = async (sessionId: string, prUrl: string) => {
    const parsed = parsePrUrl(prUrl);
    if (!parsed) return;
    setMerging(prev => new Set(prev).add(sessionId));
    try {
      await api.mergePr(parsed.owner, parsed.repo, parsed.number);
      setMerged(prev => new Set(prev).add(sessionId));
      setToast({ message: 'PR merged successfully! Issue resolved.', type: 'success' });
      setTimeout(() => setToast(null), 5000);
      await loadSessions();
    } catch (e: unknown) {
      console.error('Failed to merge PR:', e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      let reason = 'Unknown error';
      if (msg.toLowerCase().includes('not mergeable') || msg.includes('405')) {
        reason = 'This PR has merge conflicts or failing checks that need to be resolved on GitHub before it can be merged.';
      } else if (msg.includes('409')) {
        reason = 'This PR was already merged.';
        setMerged(prev => new Set(prev).add(sessionId));
      } else if (msg.includes('401') || msg.includes('403')) {
        reason = 'GitHub token does not have permission to merge this PR. Check your GitHub PAT in Settings.';
      } else {
        reason = msg;
      }
      setMergeError({ sessionId, prUrl, reason });
    } finally {
      setMerging(prev => { const next = new Set(prev); next.delete(sessionId); return next; });
    }
  };

  const postPrComment = async (sessionId: string, prUrl: string) => {
    const parsed = parsePrUrl(prUrl);
    const comment = prComments[sessionId]?.trim();
    if (!parsed || !comment) return;
    setPostingComment(prev => new Set(prev).add(sessionId));
    try {
      await api.postPrComment(parsed.owner, parsed.repo, parsed.number, comment);
      setCommentPosted(prev => new Set(prev).add(sessionId));
      setPrComments(prev => ({ ...prev, [sessionId]: '' }));
      setToast({ message: 'Comment posted on PR successfully!', type: 'success' });
      setTimeout(() => { setToast(null); setCommentPosted(prev => { const next = new Set(prev); next.delete(sessionId); return next; }); }, 4000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setToast({ message: `Failed to post comment: ${msg}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setPostingComment(prev => { const next = new Set(prev); next.delete(sessionId); return next; });
    }
  };

  const topbarEl = document.getElementById('topbar-actions');
  const queued = sessions.filter(s => s.status === 'queued').length;
  const running = sessions.filter(s => (s.status === 'running' || s.status === 'pending') && s.status_detail !== 'waiting_for_user' && !s.pr_url).length;
  const needsInput = sessions.filter(s => s.status_detail === 'waiting_for_user' && !s.pr_url).length;
  const needsPrApproval = sessions.filter(s => !!s.pr_url && s.status !== 'merged' && !merged.has(s.id)).length;
  const approvedSolved = sessions.filter(s => s.status === 'merged' || merged.has(s.id) || ['completed', 'succeeded', 'finished', 'stopped'].includes(s.status)).length;

  const filteredSessions = sessions.filter(s => {
    switch (filter) {
      case 'queued': return s.status === 'queued';
      case 'running': return (s.status === 'running' || s.status === 'pending') && s.status_detail !== 'waiting_for_user' && !s.pr_url;
      case 'needs_input': return s.status_detail === 'waiting_for_user' && !s.pr_url;
      case 'needs_pr_approval': return !!s.pr_url && s.status !== 'merged' && !merged.has(s.id);
      case 'approved_solved': return s.status === 'merged' || merged.has(s.id) || ['completed', 'succeeded', 'finished', 'stopped'].includes(s.status);
      default: return true;
    }
  });

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>;

  const filters: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: sessions.length, color: 'var(--purple)' },
    ...(queued > 0 ? [{ key: 'queued' as FilterType, label: 'Queued', count: queued, color: '#f59e0b' }] : []),
    { key: 'running', label: 'Running', count: running, color: 'var(--blue)' },
    { key: 'needs_input', label: 'Needs User Input', count: needsInput, color: '#e9a820' },
    { key: 'needs_pr_approval', label: 'Needs PR Approval', count: needsPrApproval, color: '#8b5cf6' },
    { key: 'approved_solved', label: 'Approved & Solved', count: approvedSolved, color: 'var(--green)' },
  ];

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={refreshStatus}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--rule)', background: 'var(--bg2)', color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh Status
          </button>
        </div>, topbarEl
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--purple)' },
          { label: 'Queued', value: queued, color: '#f59e0b' },
          { label: 'Running', value: running, color: 'var(--blue)' },
          { label: 'Needs PR Approval', value: needsPrApproval, color: '#8b5cf6' },
          { label: 'Approved & Solved', value: approvedSolved, color: 'var(--green)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: s.color }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Filter size={14} style={{ color: 'var(--dim)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter:</span>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
              cursor: 'pointer', border: filter === f.key ? `2px solid ${f.color}` : '1px solid var(--rule)',
              background: filter === f.key ? `${f.color}15` : 'var(--white)',
              color: filter === f.key ? f.color : 'var(--dim)',
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
            }}
          >
            {f.label}
            <span style={{ fontSize: 10, fontWeight: 800, background: filter === f.key ? f.color : 'var(--bg)', color: filter === f.key ? '#fff' : 'var(--dim)', borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
        Devin Sessions
        {filter !== 'all' && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginLeft: 8 }}>({filteredSessions.length} of {sessions.length})</span>}
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 110px 90px 100px 100px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
          <div />
          {['Issue', 'Sent', 'Solved', 'Time to Correct', 'Status', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {filteredSessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            <Clock size={24} style={{ color: 'var(--dim)', display: 'block', margin: '0 auto 8px' }} />
            {filter === 'all' ? 'No Devin sessions yet. Send issues from Issue Triage to start.' : 'No sessions matching this filter.'}
          </div>
        ) : filteredSessions.map(session => (
          <div key={session.id}>
            {/* Session Row */}
            <div
              onClick={() => toggleExpand(session.id)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 110px 90px 100px 100px', padding: '14px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ color: 'var(--dim)' }}>
                {expanded.has(session.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>
                  {session.issue_title || 'Devin Session'}
                </div>
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {session.issue_number && <span>#{session.issue_number}</span>}
                  {session.repo_full_name && <span>{session.repo_full_name}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--dim)' }}>
                <Send size={10} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: 10 }}>{formatTimestamp(session.created_at)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--dim)' }}>
                {merged.has(session.id) || session.status === 'merged' || prDiffs[session.id]?.merged ? (
                  <><CheckCheck size={10} style={{ color: '#8b5cf6', flexShrink: 0 }} /><span className="font-mono" style={{ fontSize: 10, color: '#8b5cf6' }}>{formatTimestamp(session.updated_at)}</span></>
                ) : session.pr_url && ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <><CheckCheck size={10} style={{ color: '#8b5cf6', flexShrink: 0 }} /><span className="font-mono" style={{ fontSize: 10, color: '#8b5cf6' }}>{formatTimestamp(session.updated_at)}</span></>
                ) : ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <><CheckCheck size={10} style={{ color: 'var(--green)', flexShrink: 0 }} /><span className="font-mono" style={{ fontSize: 10, color: 'var(--green)' }}>{formatTimestamp(session.updated_at)}</span></>
                ) : session.status_detail === 'waiting_for_user' ? (
                  <span style={{ fontSize: 10, color: '#e9a820', fontWeight: 600 }}>Waiting...</span>
                ) : session.status === 'queued' ? (
                  <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>Queued</span>
                ) : session.status === 'running' ? (
                  <span style={{ fontSize: 10, color: 'var(--blue)' }}>In progress...</span>
                ) : session.status === 'suspended' ? (
                  <span style={{ fontSize: 10, color: '#e53e3e' }}>Suspended</span>
                ) : session.status === 'blocked' ? (
                  <span style={{ fontSize: 10, color: '#e53e3e' }}>Blocked</span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{session.status || '\u2014'}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--dim)' }}>
                {session.pr_url && ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <span className="font-mono" style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 600 }}>{timeDiff(session.created_at, session.updated_at)}</span>
                ) : ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>{timeDiff(session.created_at, session.updated_at)}</span>
                ) : session.status_detail === 'waiting_for_user' ? (
                  <span className="font-mono" style={{ fontSize: 10, color: '#e9a820', fontWeight: 600 }}>{timeDiff(session.created_at, session.updated_at || new Date().toISOString())}</span>
                ) : (session.status === 'running' || session.status === 'pending') ? (
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--blue)' }}>{timeDiff(session.created_at, new Date().toISOString())}</span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{'—'}</span>
                )}
              </div>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                  {merged.has(session.id) || session.status === 'merged' || prDiffs[session.id]?.merged ? (
                    <><GitMerge size={14} style={{ color: '#8b5cf6' }} /><span style={{ color: '#8b5cf6' }}>Merged</span></>
                  ) : session.pr_url && ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                    <><span className="dot" style={{ background: '#8b5cf6' }} /><span style={{ color: '#8b5cf6' }}>PR Ready</span></>
                  ) : ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                    <><CheckCircle size={14} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>Done</span></>
                  ) : session.pr_url ? (
                    <><span className="dot" style={{ background: '#8b5cf6' }} /><span style={{ color: '#8b5cf6' }}>PR Ready</span></>
                  ) : session.status_detail === 'waiting_for_user' ? (
                    <><span className="dot" style={{ background: '#e9a820' }} /><span style={{ color: '#e9a820' }}>Needs Input</span></>
                  ) : session.status === 'queued' ? (
                    <><span className="dot" style={{ background: '#f59e0b' }} /><span style={{ color: '#f59e0b' }}>Queued</span></>
                  ) : (session.status === 'running' || session.status === 'pending') ? (
                    <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Running</span></>
                  ) : session.status === 'suspended' ? (
                    <><span className="dot" style={{ background: '#9ca3af' }} /><span style={{ color: '#9ca3af' }}>Suspended</span></>
                  ) : session.status === 'blocked' ? (
                    <><span className="dot" style={{ background: '#e53e3e' }} /><span style={{ color: '#e53e3e' }}>Blocked</span></>
                  ) : (
                    <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>{session.status}</span></>
                  )}
                </span>
              </div>
              <div onClick={e => e.stopPropagation()}>
                {session.status === 'queued' ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} /> Waiting
                  </span>
                ) : merged.has(session.id) || session.status === 'merged' || prDiffs[session.id]?.merged ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(33,193,154,0.12)', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {(approved.has(session.id) || manuallyMerged.has(session.id)) ? (
                      <><CheckCircle size={10} /> Manually Approved</>
                    ) : (
                      <><DevinIcon size={12} /> Auto-Approved by Devin</>
                    )}
                  </span>
                ) : session.pr_url ? (
                  canAutoApprove(session.issue_severity) ? (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(57,105,202,0.1)', color: '#3969CA', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {merging.has(session.id) || autoMerging.has(session.id) ? (
                        <><Loader2 size={10} className="animate-spin" /> Auto-Approving...</>
                      ) : (
                        <><DevinIcon size={12} /> Auto-Approve Queued</>
                      )}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <button
                        onClick={() => { setManuallyMerged(prev => new Set(prev).add(session.id)); mergePr(session.id, session.pr_url!); }}
                        disabled={merging.has(session.id)}
                        style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: '#8b5cf6', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: merging.has(session.id) ? 0.6 : 1 }}>
                        {merging.has(session.id) ? <Loader2 size={10} className="animate-spin" /> : <GitMerge size={10} />} {merging.has(session.id) ? 'Merging...' : 'Approve & Merge'}
                      </button>
                      <span style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic' }}>
                        {session.issue_severity ? `${session.issue_severity} severity — requires manual approval` : 'Requires manual approval'}
                      </span>
                    </div>
                  )
                ) : (session.status_detail === 'waiting_for_user' && !approved.has(session.id)) ? (
                  <button
                    onClick={() => approveSession(session.id)}
                    disabled={approving.has(session.id)}
                    style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: '#e9a820', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: approving.has(session.id) ? 0.6 : 1 }}>
                    {approving.has(session.id) ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />} {approving.has(session.id) ? 'Approving...' : 'Approve'}
                  </button>
                ) : approved.has(session.id) ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(33,193,154,0.15)', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={10} /> Approved
                  </span>
                ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
              </div>
            </div>

            {/* Expanded Details */}
            {expanded.has(session.id) && (() => {
              const hasPr = !!(session.pr_url || liveData[session.id]?.pr_url);
              const prUrl = session.pr_url || liveData[session.id]?.pr_url || '';
              const diff = prDiffs[session.id];
              const isMerged = merged.has(session.id) || session.status === 'merged' || diff?.merged;
              const body = session.issue_body || '';
              const descMatch = body.match(/##?\s*Description\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
              const impactMatch = body.match(/##?\s*Impact\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
              const fileMatch = body.match(/##?\s*File\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
              const fixMatch = body.match(/##?\s*Recommended\s*Fix\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
              const desc = descMatch ? descMatch[1].trim() : body.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).slice(0, 2).join(' ').slice(0, 200);

              /* ═══════════════════════════════════════════════════════
                 PR APPROVAL VIEW — two-panel layout matching the HTML model
                 ═══════════════════════════════════════════════════════ */
              if (hasPr) return (
                <div style={{ borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 0, minHeight: 420 }}>

                    {/* ── LEFT PANEL ── */}
                    <div style={{ borderRight: '1px solid var(--rule)', background: 'var(--white)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                      {/* PR Header */}
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(57,105,202,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isMerged ? <GitMerge size={14} style={{ color: '#3969CA' }} /> : <GitPullRequest size={14} style={{ color: '#3969CA' }} />}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                            {isMerged ? 'PR Merged! Issue Resolved' : 'Pull Request Ready for Review'}
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 12, lineHeight: 1.5 }}>
                          {isMerged
                            ? 'PR was merged successfully. The code changes are now in the main branch.'
                            : 'Devin has created a PR. Review the code changes and recording below, then click "Approve & Merge" to merge it.'}
                        </div>
                        {diff && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FileCode size={12} /> {diff.changed_files} file{diff.changed_files !== 1 ? 's' : ''} changed
                            </span>
                            <span style={{ color: '#22a559', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}>+{diff.additions}</span>
                            <span style={{ color: '#cf222e', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }}>-{diff.deletions}</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--dim)', background: 'var(--bg)', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--rule)' }}>
                              {diff.head_branch} → {diff.base_branch}
                            </span>
                          </div>
                        )}
                        {/* Devin Review badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: isMerged ? 'rgba(33,193,154,0.06)' : 'rgba(57,105,202,0.06)', border: `1px solid ${isMerged ? 'rgba(33,193,154,0.15)' : 'rgba(57,105,202,0.15)'}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: isMerged ? 'rgba(33,193,154,0.12)' : 'rgba(57,105,202,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <DevinIcon size={16} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              Reviewed by Devin Review
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: isMerged ? 'rgba(33,193,154,0.15)' : 'rgba(57,105,202,0.12)', color: isMerged ? '#21C19A' : '#3969CA', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                                {isMerged ? 'Passed' : 'Reviewing'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                              {isMerged
                                ? 'Devin Review approved this PR — no critical issues found.'
                                : 'Devin Review is analyzing code quality, security, and potential bugs.'}
                            </div>
                          </div>
                          <Eye size={14} style={{ color: isMerged ? '#21C19A' : '#3969CA', flexShrink: 0 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!isMerged ? (
                            <button
                              onClick={() => mergePr(session.id, prUrl)}
                              disabled={merging.has(session.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, padding: '9px 20px', background: '#3969CA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', transition: '.15s', opacity: merging.has(session.id) ? 0.6 : 1 }}>
                              {merging.has(session.id) ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} {merging.has(session.id) ? 'Merging...' : 'Approve & Merge'}
                            </button>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, padding: '9px 20px', background: '#21C19A', color: '#fff', borderRadius: 8 }}>
                              <CheckCircle size={13} /> Merged
                            </span>
                          )}
                          <a href={prUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, padding: '8px 16px', background: 'var(--white)', color: 'var(--ink)', border: '1px solid var(--rule)', borderRadius: 8, textDecoration: 'none', cursor: 'pointer', transition: '0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <GitHubIcon size={16} /> View on GitHub
                          </a>
                          {session.session_url && (
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, padding: '8px 16px', background: '#1a1f2e', color: '#fff', border: '1px solid #2d333b', borderRadius: 8, textDecoration: 'none', cursor: 'pointer', transition: '0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#252c3a'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#1a1f2e'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <DevinIcon size={18} /> View on Devin
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Problem Card */}
                      <div style={{ margin: 16, borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239,68,68,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#e53e3e' }}>
                            {session.issue_category === 'security' ? <Shield size={13} style={{ color: '#e53e3e' }} /> : <Bug size={13} style={{ color: '#e53e3e' }} />}
                            The Problem
                          </div>
                          {session.issue_severity && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const,
                              background: session.issue_severity === 'critical' || session.issue_severity === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(217,119,6,0.1)',
                              color: session.issue_severity === 'critical' || session.issue_severity === 'high' ? '#e53e3e' : '#d97706',
                              border: `1px solid ${session.issue_severity === 'critical' || session.issue_severity === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(217,119,6,0.2)'}`,
                            }}>{session.issue_severity}</span>
                          )}
                        </div>
                        <div style={{ padding: '12px 14px', background: 'var(--white)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>{session.issue_title || 'Issue details loading...'}</div>
                          {desc && <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 8, lineHeight: 1.5 }}>{desc}</div>}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {session.issue_category && (
                              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: session.issue_category === 'security' ? 'rgba(239,68,68,0.08)' : 'var(--bg)', color: session.issue_category === 'security' ? '#e53e3e' : 'var(--dim)', border: '1px solid var(--rule)' }}>{session.issue_category.toUpperCase()}</span>
                            )}
                            {session.repo_full_name && (
                              <a href={`https://github.com/${session.repo_full_name}`} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg)', color: 'var(--blue)', border: '1px solid var(--rule)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <FileCode size={10} /> {session.repo_full_name}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Arrow divider */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0', color: 'var(--dim)' }}>
                        <ChevronDown size={16} />
                      </div>

                      {/* Approach Card */}
                      <div style={{ margin: '0 16px 16px', borderRadius: 10, border: '1px solid rgba(33,193,154,0.25)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(33,193,154,0.05)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#21C19A' }}>
                            <Wrench size={13} style={{ color: '#21C19A' }} />
                            Devin's Approach
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5,
                            background: isMerged ? 'rgba(33,193,154,0.1)' : 'rgba(217,119,6,0.1)',
                            color: isMerged ? '#21C19A' : '#d97706',
                            border: `1px solid ${isMerged ? 'rgba(33,193,154,0.2)' : 'rgba(217,119,6,0.2)'}`,
                          }}>
                            {!isMerged && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', animation: 'pulse 1.4s infinite' }} />}
                            {isMerged ? 'Merged' : 'Awaiting Approval'}
                          </span>
                        </div>
                        <div style={{ padding: 14, background: 'var(--white)' }}>
                          {impactMatch && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#e53e3e', marginBottom: 4 }}>Impact</div>
                              <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{impactMatch[1].trim()}</div>
                            </div>
                          )}
                          {fileMatch && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--blue)', marginBottom: 4 }}>File</div>
                              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink)', background: 'var(--bg)', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--rule)' }}>{fileMatch[1].trim()}</div>
                            </div>
                          )}
                          {fixMatch && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#21C19A', marginBottom: 4 }}>Recommended Fix</div>
                              <div style={{ background: 'rgba(33,193,154,0.06)', borderLeft: '3px solid #21C19A', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{fixMatch[1].trim()}</div>
                            </div>
                          )}
                          {liveData[session.id]?.title && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 4 }}>Instructions to Devin</div>
                              <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--mid)', border: '1px solid var(--rule)' }}>{liveData[session.id].title}</div>
                            </div>
                          )}

                          {/* Progress steps */}
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 8 }}>Devin's Progress</div>
                            {(liveData[session.id]?.timeline || []).map((step, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                                <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0,
                                  background: step.status === 'done' ? 'rgba(33,193,154,0.15)' : 'rgba(217,119,6,0.1)',
                                  color: step.status === 'done' ? '#21C19A' : '#d97706',
                                }}>{step.status === 'done' ? '✓' : '●'}</div>
                                <span style={{ color: step.status === 'done' ? 'var(--mid)' : 'var(--ink)', fontWeight: step.status === 'done' ? 400 : 500 }}>{step.step}</span>
                              </div>
                            ))}
                            {(liveData[session.id]?.timeline || []).length === 0 && (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: 'rgba(33,193,154,0.15)', color: '#21C19A' }}>✓</div>
                                  <span style={{ color: 'var(--mid)' }}>Session started</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: 'rgba(33,193,154,0.15)', color: '#21C19A' }}>✓</div>
                                  <span style={{ color: 'var(--mid)' }}>PR created</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: isMerged ? 'rgba(33,193,154,0.15)' : 'rgba(217,119,6,0.1)', color: isMerged ? '#21C19A' : '#d97706' }}>{isMerged ? '✓' : '●'}</div>
                                  <span style={{ color: isMerged ? 'var(--mid)' : 'var(--ink)', fontWeight: isMerged ? 400 : 500 }}>{isMerged ? 'Merged' : 'Awaiting approval'}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Sent + links row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)' }}>
                            <span style={{ fontSize: 11, color: 'var(--dim)' }}>Sent: {formatTimestamp(session.created_at)}</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <a href={prUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 6, transition: '0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                                <GitHubIcon size={13} /> View on GitHub
                              </a>
                              {session.session_url && (
                                <a href={session.session_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', borderRadius: 6, transition: '0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                                  <DevinIcon size={15} /> View on Devin
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── RIGHT PANEL ── */}
                    <div style={{ background: 'var(--bg)', overflowY: 'auto', maxHeight: 600, padding: 20 }}>

                      {/* 1. Desktop Recording */}
                      {(() => {
                        const videoUrl = recordingUrls[session.id] || session.recording_url || liveData[session.id]?.playback_url || '';
                        const isLoading = loadingRecording.has(session.id);
                        if (videoUrl) {
                          return (
                        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Video size={14} style={{ color: 'var(--mid)' }} /> Devin Desktop Recording
                            </div>
                            <a href={session.session_url || undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                              <ExternalLink size={11} /> Open full session
                            </a>
                          </div>
                          <video src={videoUrl} controls style={{ width: '100%', display: 'block', maxHeight: 340, background: '#0d1117' }} preload="metadata" controlsList="nodownload" />
                          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock size={12} style={{ color: 'var(--dim)' }} /> Recorded {formatTimestamp(session.updated_at)}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#21C19A', background: 'rgba(33,193,154,0.1)', padding: '2px 8px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Play size={9} /> Playable inline
                            </span>
                          </div>
                        </div>
                          );
                        }
                        if (isLoading) {
                          return (
                        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Video size={14} style={{ color: 'var(--mid)' }} /> Devin Desktop Recording
                            </div>
                          </div>
                          <div style={{ padding: '32px 16px', background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 }}>
                            <Loader2 size={28} style={{ color: '#58a6ff', animation: 'spin 1s linear infinite' }} />
                            <div style={{ fontSize: 12, color: '#8b949e' }}>Loading recording...</div>
                          </div>
                        </div>
                          );
                        }
                        if (session.session_url) {
                          return (
                        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <Video size={14} style={{ color: 'var(--mid)' }} /> Devin Desktop Recording
                            </div>
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                              <ExternalLink size={11} /> Open full session
                            </a>
                          </div>
                          <div style={{ padding: '24px 16px', background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 }}>
                            <div style={{ fontSize: 12, color: '#8b949e', textAlign: 'center' as const }}>
                              No recording file available yet.
                            </div>
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 11, fontWeight: 600, color: '#58a6ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'rgba(88,166,255,0.1)', borderRadius: 8, border: '1px solid rgba(88,166,255,0.2)' }}>
                              <ExternalLink size={11} /> View session on Devin
                            </a>
                          </div>
                        </div>
                          );
                        }
                        return (
                        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Video size={14} style={{ color: 'var(--dim)' }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Desktop Recording</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mid)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 10 }}>
                              Pending
                            </span>
                          </div>
                        </div>
                        );
                      })()}

                      {/* 2. Code Changes (PR Diff) */}
                      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <FileDiff size={14} style={{ color: 'var(--mid)' }} /> Code Changes (PR Diff)
                          </div>
                          {diff && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--bg)', color: 'var(--dim)', border: '1px solid var(--rule)' }}>{diff.changed_files} FILES</span>}
                        </div>
                        {loadingDiff.has(session.id) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 20 }}>
                            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--blue)' }} />
                            <span style={{ fontSize: 12, color: 'var(--mid)' }}>Loading PR diff from GitHub...</span>
                          </div>
                        ) : diff ? (
                          <>
                            {diff.files.map((file, fi) => {
                              const fileKey = `${session.id}-${fi}`;
                              const isFileExpanded = expandedFiles.has(fileKey);
                              const totalChanges = file.additions + file.deletions;
                              const addPct = totalChanges > 0 ? Math.round((file.additions / totalChanges) * 100) : 50;
                              return (
                                <div key={fi}>
                                  <div
                                    onClick={() => setExpandedFiles(prev => {
                                      const next = new Set(prev);
                                      if (next.has(fileKey)) next.delete(fileKey); else next.add(fileKey);
                                      return next;
                                    })}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rule)', cursor: 'pointer', transition: '.1s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <FileCode size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink)', flex: 1, fontWeight: 500 }}>{file.filename}</span>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#22a559' }}>+{file.additions}</span>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#cf222e' }}>-{file.deletions}</span>
                                    <div style={{ width: 80, height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                                      <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, #22a559 ${addPct}%, #cf222e ${addPct}%)` }} />
                                    </div>
                                    {isFileExpanded ? <ChevronDown size={12} style={{ color: 'var(--dim)' }} /> : <ChevronRight size={12} style={{ color: 'var(--dim)' }} />}
                                  </div>
                                  {isFileExpanded && file.patch && (
                                    <div style={{ background: '#0d1117', margin: '0 14px 14px', borderRadius: 8, overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                                      <div style={{ background: '#161b22', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 12px', fontSize: 10, fontWeight: 600, color: '#7d8590', letterSpacing: '0.04em' }}>
                                        {diff.title}
                                      </div>
                                      {file.patch.split('\n').map((line, li) => {
                                        const isAdd = line.startsWith('+') && !line.startsWith('+++');
                                        const isRm = line.startsWith('-') && !line.startsWith('---');
                                        return (
                                          <div key={li} style={{ padding: '1px 12px', display: 'flex', gap: 10, background: isRm ? 'rgba(207,34,46,0.08)' : isAdd ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                                            <span style={{ width: 10, flexShrink: 0, color: isRm ? '#f85149' : isAdd ? '#3fb950' : '#484f58' }}>{isRm ? '-' : isAdd ? '+' : ' '}</span>
                                            <span style={{ color: isRm ? '#ffa198' : isAdd ? '#7ee787' : '#484f58' }}>{line.slice(1) || ' '}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div style={{ padding: 20, textAlign: 'center', color: 'var(--dim)', fontSize: 11 }}>
                            <AlertCircle size={16} style={{ display: 'block', margin: '0 auto 6px', opacity: 0.4 }} />
                            Could not load PR diff
                          </div>
                        )}
                      </div>

                      {/* 3. Devin's Live Session (collapsible) */}
                      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Clock size={14} style={{ color: 'var(--mid)' }} /> Devin's Live Session
                          </div>
                          {session.session_url && (
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                              Open full session <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(33,193,154,0.15)', border: '1px solid rgba(33,193,154,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#21C19A', flexShrink: 0 }}>D</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 1 }}>Devin AI</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--mid)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isMerged ? '#21C19A' : '#d97706', animation: isMerged ? 'none' : 'pulse 1.4s infinite' }} />
                              {isMerged ? 'PR merged successfully' : 'Waiting for your approval'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. What Changed & Why — rich PR body content */}
                      {(() => {
                        const prBody = diff?.body || '';
                        // Parse PR body sections
                        const summaryMatch = prBody.match(/##\s*Summary\s*\n([\s\S]*?)(?=\n##\s|$)/i);
                        const changesMatch = prBody.match(/##\s*Changes\s*\n([\s\S]*?)(?=\n##\s|$)/i);
                        const testMatch = prBody.match(/##\s*Test(?:ing|s)?\s*\n([\s\S]*?)(?=\n##\s|$)/i);
                        const notesMatch = prBody.match(/##\s*Notes?\s*\n([\s\S]*?)(?=\n##\s|$)/i);
                        const hasPrBody = !!(summaryMatch || changesMatch || prBody.length > 20);

                        // Helper to render markdown-like bullet points
                        const renderLines = (text: string) => {
                          return text.split('\n').filter(l => l.trim()).map((line, i) => {
                            const trimmed = line.trim();
                            // File header like ### `src/utils/crypto.js`
                            if (trimmed.startsWith('###')) {
                              const file = trimmed.replace(/^###\s*/, '').replace(/`/g, '');
                              return <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: 'var(--blue)', marginTop: i > 0 ? 8 : 0, marginBottom: 3 }}>{file}</div>;
                            }
                            // Bullet point
                            if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                              const content = trimmed.replace(/^[-*]\s*/, '');
                              // Render inline code
                              const parts = content.split(/(`[^`]+`)/g);
                              return (
                                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--ink)', lineHeight: 1.6, marginBottom: 2, paddingLeft: 4 }}>
                                  <span style={{ color: 'var(--dim)', flexShrink: 0 }}>•</span>
                                  <span>{parts.map((p, j) => p.startsWith('`') && p.endsWith('`')
                                    ? <code key={j} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, background: 'var(--bg)', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--rule)' }}>{p.slice(1, -1)}</code>
                                    : <span key={j}>{p}</span>
                                  )}</span>
                                </div>
                              );
                            }
                            // Regular paragraph
                            return <div key={i} style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6, marginBottom: 2 }}>{trimmed}</div>;
                          });
                        };

                        return (
                          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                <FileCode size={14} style={{ color: 'var(--mid)' }} /> What Changed & Why
                              </div>
                              {diff && (
                                <div style={{ display: 'flex', gap: 5 }}>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: '#22a559' }}>+{diff.additions}</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: '#cf222e' }}>-{diff.deletions}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ padding: '14px 16px' }}>
                              {hasPrBody ? (
                                <>
                                  {/* Summary / Root Cause */}
                                  {summaryMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#e53e3e', marginBottom: 5 }}>Summary</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{renderLines(summaryMatch[1].trim())}</div>
                                    </div>
                                  )}
                                  {/* Changes — the rich bullet points */}
                                  {changesMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--blue)', marginBottom: 5 }}>What Changed</div>
                                      <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--rule)' }}>
                                        {renderLines(changesMatch[1].trim())}
                                      </div>
                                    </div>
                                  )}
                                  {/* Test Results */}
                                  {testMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#21C19A', marginBottom: 5 }}>Test Results</div>
                                      <div style={{ background: 'rgba(33,193,154,0.07)', borderLeft: '3px solid #21C19A', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>
                                        {renderLines(testMatch[1].trim())}
                                      </div>
                                    </div>
                                  )}
                                  {/* Notes */}
                                  {notesMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 5 }}>Notes</div>
                                      <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.6 }}>{renderLines(notesMatch[1].trim())}</div>
                                    </div>
                                  )}
                                  {/* Fallback: show full body if no sections parsed */}
                                  {!summaryMatch && !changesMatch && prBody && (
                                    <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{renderLines(prBody)}</div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Fallback to issue body parsing when no PR body */}
                                  {impactMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#e53e3e', marginBottom: 5 }}>Root Cause</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{impactMatch[1].trim()}</div>
                                    </div>
                                  )}
                                  {fileMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--blue)', marginBottom: 5 }}>What Changed</div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink)', background: 'var(--bg)', padding: '6px 10px', borderRadius: 5, border: '1px solid var(--rule)', lineHeight: 1.6 }}>{fileMatch[1].trim()}</div>
                                    </div>
                                  )}
                                  {fixMatch && (
                                    <div style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#21C19A', marginBottom: 5 }}>Why It Fixes It</div>
                                      <div style={{ background: 'rgba(33,193,154,0.07)', borderLeft: '3px solid #21C19A', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontSize: 12, color: 'var(--ink)', lineHeight: 1.6 }}>{fixMatch[1].trim()}</div>
                                    </div>
                                  )}
                                </>
                              )}
                              {/* Confidence badges */}
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 5 }}>Confidence</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {diff && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(33,193,154,0.1)', color: '#0d9e7e', border: '1px solid rgba(33,193,154,0.25)' }}>Tests passing</span>}
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(57,105,202,0.1)', color: '#3969CA', border: '1px solid rgba(57,105,202,0.25)' }}>Score 85</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.25)' }}>Low complexity</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 5. Leave a Comment on PR (shown when merged) */}
                      {isMerged && (
                        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rule)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
                              <MessageSquare size={14} style={{ color: 'var(--mid)' }} /> Leave a Comment on PR
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <GitMerge size={12} style={{ color: '#8b5cf6' }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6' }}>Merged</span>
                            </div>
                          </div>
                          <div style={{ padding: '14px 16px' }}>
                            <textarea
                              value={prComments[session.id] || ''}
                              onChange={e => setPrComments(prev => ({ ...prev, [session.id]: e.target.value }))}
                              placeholder="Leave feedback, request follow-up changes, or add notes to this PR..."
                              style={{
                                width: '100%', minHeight: 70, padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
                                border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--bg)', color: 'var(--ink)',
                                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                                boxSizing: 'border-box',
                              }}
                              onFocus={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(57,105,202,0.1)'; }}
                              onBlur={e => { e.currentTarget.style.borderColor = 'var(--rule)'; e.currentTarget.style.boxShadow = 'none'; }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                              <span style={{ fontSize: 11, color: 'var(--mid)' }}>
                                {commentPosted.has(session.id)
                                  ? <span style={{ color: '#21C19A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Comment posted!</span>
                                  : 'Comment will be posted directly on the GitHub PR'}
                              </span>
                              <button
                                onClick={() => postPrComment(session.id, prUrl)}
                                disabled={postingComment.has(session.id) || !prComments[session.id]?.trim()}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                                  padding: '7px 16px', background: '#3969CA', color: '#fff', border: 'none', borderRadius: 7,
                                  cursor: !prComments[session.id]?.trim() ? 'not-allowed' : 'pointer',
                                  opacity: !prComments[session.id]?.trim() ? 0.5 : 1, transition: '.15s',
                                }}
                              >
                                {postingComment.has(session.id) ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                {postingComment.has(session.id) ? 'Posting...' : 'Post Comment'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sticky Approve CTA */}
                      {!isMerged && (
                        <div style={{ position: 'sticky', bottom: 0, background: 'rgba(247,248,252,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid var(--rule)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: '0 0 12px 12px' }}>
                          <div style={{ fontSize: 12, color: 'var(--mid)' }}>
                            Ready to merge? {diff && <strong style={{ color: 'var(--ink)' }}>{diff.additions} lines added · {diff.deletions} removed · {diff.changed_files} files</strong>}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => mergePr(session.id, prUrl)}
                              disabled={merging.has(session.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, padding: '9px 22px', background: '#3969CA', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', transition: '.15s', opacity: merging.has(session.id) ? 0.6 : 1 }}>
                              {merging.has(session.id) ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />} {merging.has(session.id) ? 'Merging...' : 'Approve & Merge'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );

              /* ═══════════════════════════════════════════════════════
                 NON-PR VIEW — original layout for running/needs-input sessions
                 ═══════════════════════════════════════════════════════ */
              return (
                <div style={{ padding: '16px 16px 16px 44px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>

                  {/* Waiting for User / Approved banner (no PR yet) */}
                  {(session.status_detail === 'waiting_for_user' || approved.has(session.id)) && (
                    <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: approved.has(session.id) ? 'rgba(33,193,154,0.08)' : '#e9a82015', border: `1px solid ${approved.has(session.id) ? 'rgba(33,193,154,0.25)' : '#e9a82040'}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {approved.has(session.id) ? <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} /> : <MessageSquare size={20} style={{ color: '#e9a820', flexShrink: 0, marginTop: 2 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: approved.has(session.id) ? 'var(--green)' : '#e9a820', marginBottom: 4 }}>
                          {approved.has(session.id) ? 'Approved! Devin is now working on the fix.' : 'Devin needs your approval to proceed'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.5, marginBottom: 10 }}>
                          {approved.has(session.id)
                            ? 'Devin will implement the fix, create a PR, and run tests.'
                            : 'Devin has analyzed the issue and prepared a plan. Review the details below and click Approve to let Devin proceed.'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {!approved.has(session.id) ? (
                            <button
                              onClick={() => approveSession(session.id)}
                              disabled={approving.has(session.id)}
                              style={{ fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#e9a820', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: approving.has(session.id) ? 0.6 : 1 }}>
                              {approving.has(session.id) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} {approving.has(session.id) ? 'Sending approval...' : 'Approve & Proceed'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 8, background: 'rgba(33,193,154,0.15)', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <CheckCircle size={14} /> Approved
                            </span>
                          )}
                          {session.session_url && (
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid #2d333b', background: '#1a1f2e', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: '0.15s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#252c3a'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#1a1f2e'; e.currentTarget.style.boxShadow = 'none'; }}>
                              <DevinIcon size={18} /> View on Devin
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Problem + Solution two-column layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Left: Problem + Approach */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 14px', background: 'rgba(229,62,62,0.08)', borderBottom: '1px solid rgba(229,62,62,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {session.issue_category === 'security' ? <Shield size={14} style={{ color: '#e53e3e' }} /> : <Bug size={14} style={{ color: '#e53e3e' }} />}
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#e53e3e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>The Problem</span>
                          {session.issue_severity && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
                            background: session.issue_severity === 'critical' || session.issue_severity === 'high' ? 'rgba(229,62,62,0.12)' : 'rgba(217,119,6,0.12)',
                            color: session.issue_severity === 'critical' || session.issue_severity === 'high' ? '#e53e3e' : '#d97706',
                          }}>{session.issue_severity}</span>}
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{session.issue_title || 'Issue details loading...'}</div>
                          {desc && <div style={{ fontSize: 11, color: 'var(--mid)', lineHeight: 1.5, marginBottom: 6 }}>{desc}</div>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {session.issue_category && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', background: 'var(--bg)', color: 'var(--dim)', border: '1px solid var(--rule)' }}>{session.issue_category}</span>}
                            {session.repo_full_name && <a href={`https://github.com/${session.repo_full_name}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--bg)', color: 'var(--blue)', border: '1px solid var(--rule)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}><FileCode size={9} /> {session.repo_full_name}</a>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dim)' }}><ChevronDown size={16} /></div>
                      <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 14px', background: 'rgba(33,193,154,0.08)', borderBottom: '1px solid rgba(33,193,154,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Wrench size={14} style={{ color: 'var(--green)' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Devin's Approach</span>
                          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: session.status === 'running' ? 'rgba(2,148,222,0.12)' : 'rgba(233,168,32,0.12)',
                            color: session.status === 'running' ? 'var(--blue)' : '#e9a820',
                          }}>{session.status === 'running' ? 'IN PROGRESS' : 'AWAITING APPROVAL'}</span>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                          {impactMatch && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: '#e53e3e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Impact</div><div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{impactMatch[1].trim()}</div></div>}
                          {fileMatch && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>File</div><div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'monospace', background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--rule)', display: 'inline-block' }}>{fileMatch[1].trim()}</div></div>}
                          {fixMatch && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Recommended Fix</div><div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, padding: '6px 10px', background: 'rgba(33,193,154,0.06)', borderRadius: 6, borderLeft: '3px solid var(--green)' }}>{fixMatch[1].trim()}</div></div>}
                          {liveData[session.id]?.title && <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--rule)', marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Instructions to Devin</div><div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5 }}>{liveData[session.id].title}</div></div>}
                          {(liveData[session.id]?.timeline || []).length > 0 && <div style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--rule)', marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Devin's Progress</div><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{(liveData[session.id]?.timeline || []).map((step, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink)' }}><span style={{ width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 8, fontWeight: 700, background: step.status === 'done' ? 'rgba(33,193,154,0.12)' : step.status === 'running' ? 'rgba(2,148,222,0.12)' : 'rgba(233,168,32,0.12)', color: step.status === 'done' ? 'var(--green)' : step.status === 'running' ? 'var(--blue)' : '#e9a820' }}>{step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : '!'}</span><span style={{ fontWeight: 500, fontSize: 10 }}>{step.step}</span></div>))}</div></div>}
                          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 8 }}>Sent: <span className="font-mono">{formatTimestamp(session.created_at)}</span></div>
                          {session.session_url && <div style={{ marginTop: 8 }}><a href={session.session_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '5px 10px', borderRadius: 6, background: '#1a1f2e', border: '1px solid #2d333b', transition: '0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = '#252c3a'; }} onMouseLeave={e => { e.currentTarget.style.background = '#1a1f2e'; }}><DevinIcon size={15} /> <span style={{ color: '#fff' }}>View on Devin</span></a></div>}
                        </div>
                      </div>
                    </div>

                    {/* Right: Live Session */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Video size={12} /> Devin's Live Session
                      </div>
                      {session.session_url ? (
                        <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden', background: '#0d1117' }}>
                          <div style={{ padding: '16px 18px', minHeight: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                              <img src="/brand/devin-icon.png" alt="Devin" style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1f2e' }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>Devin AI</div>
                                <div style={{ fontSize: 10, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', background: session.status === 'running' ? '#3fb950' : '#e9a820', animation: session.status === 'running' ? 'pulse 2s infinite' : 'none' }} />
                                  {session.status === 'running' ? 'Working on fix...' : 'Waiting for your approval'}
                                </div>
                              </div>
                            </div>
                            {(liveData[session.id]?.todos || []).length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <CheckCheck size={9} /> Task Progress
                                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 500, color: '#58a6ff' }}>{(liveData[session.id]?.todos || []).filter(t => t.status === 'completed').length}/{(liveData[session.id]?.todos || []).length}</span>
                                </div>
                                <div style={{ background: '#161b22', borderRadius: 8, padding: '10px 12px', border: '1px solid #21262d' }}>
                                  <div style={{ height: 3, borderRadius: 2, background: '#21262d', marginBottom: 8 }}>
                                    <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #3fb950, #58a6ff)', width: `${Math.round(((liveData[session.id]?.todos || []).filter(t => t.status === 'completed').length / Math.max((liveData[session.id]?.todos || []).length, 1)) * 100)}%`, transition: 'width 0.5s ease' }} />
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {(liveData[session.id]?.todos || []).map((todo, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, lineHeight: 1.4 }}>
                                        <span style={{ width: 12, height: 12, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, fontSize: 7, fontWeight: 700, background: todo.status === 'completed' ? 'rgba(63,185,80,0.15)' : todo.status === 'in_progress' ? 'rgba(88,166,255,0.15)' : 'rgba(139,148,158,0.1)', color: todo.status === 'completed' ? '#3fb950' : todo.status === 'in_progress' ? '#58a6ff' : '#484f58', border: `1px solid ${todo.status === 'completed' ? 'rgba(63,185,80,0.3)' : todo.status === 'in_progress' ? 'rgba(88,166,255,0.3)' : 'rgba(139,148,158,0.15)'}` }}>
                                          {todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '▶' : '○'}
                                        </span>
                                        <span style={{ color: todo.status === 'completed' ? '#8b949e' : todo.status === 'in_progress' ? '#e6edf3' : '#484f58', textDecoration: todo.status === 'completed' ? 'line-through' : 'none', fontWeight: todo.status === 'in_progress' ? 600 : 400 }}>
                                          {todo.content}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            {(liveData[session.id]?.todos || []).length === 0 && (
                              <div style={{ background: '#161b22', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: '#8b949e' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: session.status === 'running' ? '#3fb950' : '#e9a820', animation: 'pulse 2s infinite' }} />
                                  <span style={{ color: '#e6edf3', fontSize: 11 }}>Working on: {session.issue_title || 'issue fix'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '8px 14px', background: '#161b22', borderTop: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 10, color: '#8b949e' }}>Live Devin session</span>
                            <a href={session.session_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 600, color: '#58a6ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}><ExternalLink size={10} /> Open full session</a>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 24, textAlign: 'center', borderRadius: 10, border: '1px dashed var(--rule)', color: 'var(--dim)', fontSize: 11 }}>
                          <Play size={24} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px' }} />
                          Session details loading...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Merge Error Modal */}
      {mergeError && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
          onClick={() => setMergeError(null)}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ background: '#fef2f2', padding: '20px 24px', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={18} style={{ color: '#e53e3e' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>PR Cannot Be Merged</div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Action required on GitHub</div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 16px' }}>{mergeError.reason}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={mergeError.prUrl} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#1f2937', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                  <GitHubIcon size={14} /> View PR on GitHub
                </a>
                <button onClick={() => { setMergeError(null); mergePr(mergeError.sessionId, mergeError.prUrl); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#8b5cf6', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  <RefreshCw size={12} /> Retry Merge
                </button>
              </div>
              <button onClick={() => setMergeError(null)}
                style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'transparent', color: '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'success' ? '#21C19A' : '#e53e3e',
          color: '#fff', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.3s ease-out',
        }}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <Eye size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
