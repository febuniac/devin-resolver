import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, ExternalLink, CheckCircle, Clock, ChevronDown, ChevronRight, Play, GitPullRequest, Send, CheckCheck, MessageSquare, Filter, Eye, Bug, Shield, Wrench, FileCode, Video } from 'lucide-react';
import api from '../api/client';

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
  created_at: string;
  updated_at: string;
}

type FilterType = 'all' | 'running' | 'needs_input' | 'completed' | 'has_pr';

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
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [liveData, setLiveData] = useState<Record<string, LiveData>>({});
  const [loadingLive, setLoadingLive] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Auto-poll on page load + every 30s
    const initialRefresh = async () => {
      try { await api.pollSessions(); } catch { /* ignore */ }
      try { setSessions(await api.listSessions() as Session[]); } catch { /* ignore */ }
      setLoading(false);
    };
    initialRefresh();
    const interval = setInterval(async () => {
      try { await api.pollSessions(); } catch { /* ignore */ }
      try { setSessions(await api.listSessions() as Session[]); } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try { setSessions(await api.listSessions() as Session[]); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const refreshStatus = async () => {
    setLoading(true);
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

  const topbarEl = document.getElementById('topbar-actions');
  const running = sessions.filter(s => s.status === 'running' || s.status === 'pending').length;
  const needsInput = sessions.filter(s => s.status_detail === 'waiting_for_user').length;
  const completed = sessions.filter(s => ['completed', 'succeeded', 'finished', 'stopped'].includes(s.status)).length;
  const withPR = sessions.filter(s => s.pr_url).length;

  const filteredSessions = sessions.filter(s => {
    switch (filter) {
      case 'running': return s.status === 'running' || s.status === 'pending';
      case 'needs_input': return s.status_detail === 'waiting_for_user';
      case 'completed': return ['completed', 'succeeded', 'finished', 'stopped'].includes(s.status);
      case 'has_pr': return !!s.pr_url;
      default: return true;
    }
  });

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>;

  const filters: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: sessions.length, color: 'var(--purple)' },
    { key: 'running', label: 'Running', count: running, color: 'var(--blue)' },
    { key: 'needs_input', label: 'Needs Input', count: needsInput, color: '#e9a820' },
    { key: 'completed', label: 'Completed', count: completed, color: 'var(--green)' },
    { key: 'has_pr', label: 'Has PR', count: withPR, color: '#f59e0b' },
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
          { label: 'Running', value: running, color: 'var(--blue)' },
          { label: 'Needs Input', value: needsInput, color: '#e9a820' },
          { label: 'Completed', value: completed, color: 'var(--green)' },
          { label: 'PRs Opened', value: withPR, color: '#f59e0b' },
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
                {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <><CheckCheck size={10} style={{ color: 'var(--green)', flexShrink: 0 }} /><span className="font-mono" style={{ fontSize: 10, color: 'var(--green)' }}>{formatTimestamp(session.updated_at)}</span></>
                ) : session.status_detail === 'waiting_for_user' ? (
                  <span style={{ fontSize: 10, color: '#e9a820', fontWeight: 600 }}>Waiting...</span>
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
                {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>{timeDiff(session.created_at, session.updated_at)}</span>
                ) : (session.status === 'running' || session.status === 'pending') ? (
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--blue)' }}>{timeDiff(session.created_at, new Date().toISOString())}</span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{'—'}</span>
                )}
              </div>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                  {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? (
                    <><CheckCircle size={14} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>Done</span></>
                  ) : session.status_detail === 'waiting_for_user' ? (
                    <><span className="dot" style={{ background: '#e9a820' }} /><span style={{ color: '#e9a820' }}>Needs Input</span></>
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
                {(session.status_detail === 'waiting_for_user' && !approved.has(session.id)) ? (
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
                ) : session.pr_url ? (
                  <a href={session.pr_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--green)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Review PR <ExternalLink size={10} />
                  </a>
                ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
              </div>
            </div>

            {/* Expanded Details */}
            {expanded.has(session.id) && (
              <div style={{ padding: '16px 16px 16px 44px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>
                {/* Waiting for User / Approved banner */}
                {(session.status_detail === 'waiting_for_user' || approved.has(session.id)) && (
                  <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: approved.has(session.id) ? 'rgba(33,193,154,0.08)' : '#e9a82015', border: `1px solid ${approved.has(session.id) ? 'rgba(33,193,154,0.25)' : '#e9a82040'}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {approved.has(session.id) ? <CheckCircle size={20} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} /> : <MessageSquare size={20} style={{ color: '#e9a820', flexShrink: 0, marginTop: 2 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: approved.has(session.id) ? 'var(--green)' : '#e9a820', marginBottom: 4 }}>
                        {approved.has(session.id) ? 'Approved! Devin is now working on the fix.' : 'Devin needs your approval to proceed'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.5, marginBottom: 10 }}>
                        {approved.has(session.id)
                          ? 'Devin will implement the fix, create a PR, and run tests. You can track progress below or on the Devin session page.'
                          : 'Devin has analyzed the issue and prepared a plan. Review the details below and click Approve to let Devin proceed with the fix, PR creation, and testing.'}
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
                            style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--white)', color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Eye size={14} /> View on Devin
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual Problem → Solution layout */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Left column: Problem + Solution cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* THE PROBLEM card — bug title + description only */}
                    <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'rgba(229,62,62,0.08)', borderBottom: '1px solid rgba(229,62,62,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {session.issue_category === 'security' ? <Shield size={14} style={{ color: '#e53e3e' }} /> : <Bug size={14} style={{ color: '#e53e3e' }} />}
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#e53e3e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>The Problem</span>
                        {session.issue_severity && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase',
                            background: session.issue_severity === 'critical' || session.issue_severity === 'high' ? 'rgba(229,62,62,0.12)' : 'rgba(217,119,6,0.12)',
                            color: session.issue_severity === 'critical' || session.issue_severity === 'high' ? '#e53e3e' : '#d97706',
                          }}>{session.issue_severity}</span>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4 }}>
                          {session.issue_title || 'Issue details loading...'}
                        </div>
                        {session.issue_body && (() => {
                          const body = session.issue_body || '';
                          const descMatch = body.match(/##?\s*Description\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                          const desc = descMatch ? descMatch[1].trim() : body.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).slice(0, 2).join(' ').slice(0, 200);
                          return desc ? (
                            <div style={{ fontSize: 11, color: 'var(--mid)', lineHeight: 1.5, marginBottom: 6 }}>
                              {desc}
                            </div>
                          ) : null;
                        })()}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          {session.issue_category && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', background: 'var(--bg)', color: 'var(--dim)', border: '1px solid var(--rule)' }}>{session.issue_category}</span>
                          )}
                          {session.repo_full_name && (
                            <a href={`https://github.com/${session.repo_full_name}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: 'var(--bg)', color: 'var(--blue)', border: '1px solid var(--rule)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <FileCode size={9} /> {session.repo_full_name}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow connector */}
                    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dim)', fontSize: 18 }}>{'\u2193'}</div>

                    {/* THE SOLUTION card */}
                    <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'rgba(33,193,154,0.08)', borderBottom: '1px solid rgba(33,193,154,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wrench size={14} style={{ color: 'var(--green)' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'How Devin Solved It' : "Devin's Approach"}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'rgba(33,193,154,0.12)' : session.status_detail === 'waiting_for_user' ? 'rgba(233,168,32,0.12)' : 'rgba(2,148,222,0.12)',
                          color: ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'var(--green)' : session.status_detail === 'waiting_for_user' ? '#e9a820' : 'var(--blue)',
                        }}>
                          {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'RESOLVED' : session.status_detail === 'waiting_for_user' ? 'AWAITING APPROVAL' : 'IN PROGRESS'}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        {loadingLive.has(session.id) ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>
                            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--blue)' }} />
                            <span style={{ fontSize: 12, color: 'var(--dim)' }}>Loading Devin's analysis...</span>
                          </div>
                        ) : (
                          <>
                            {/* Impact, File, Recommended Fix from issue body */}
                            {session.issue_body && (() => {
                              const body = session.issue_body || '';
                              const impactMatch = body.match(/##?\s*Impact\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                              const fileMatch = body.match(/##?\s*File\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                              const fixMatch = body.match(/##?\s*Recommended\s*Fix\s*\n([\s\S]*?)(?=\n##?\s|$)/i);

                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
                                  {impactMatch && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: '#e53e3e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Impact</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{impactMatch[1].trim()}</div>
                                    </div>
                                  )}
                                  {fileMatch && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>File</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, fontFamily: 'monospace', background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--rule)', display: 'inline-block' }}>{fileMatch[1].trim()}</div>
                                    </div>
                                  )}
                                  {fixMatch && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Recommended Fix</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, padding: '6px 10px', background: 'rgba(33,193,154,0.06)', borderRadius: 6, borderLeft: '3px solid var(--green)' }}>{fixMatch[1].trim()}</div>
                                    </div>
                                  )}
                                  {!impactMatch && !fileMatch && !fixMatch && session.ai_summary && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>AI Analysis</div>
                                      <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{session.ai_summary}</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Instructions sent to Devin */}
                            {liveData[session.id]?.title && (
                              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--rule)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Instructions to Devin</div>
                                <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.5 }}>{liveData[session.id].title}</div>
                              </div>
                            )}

                            {/* Timeline steps from Devin */}
                            {(liveData[session.id]?.timeline || []).length > 0 && (
                              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--rule)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Devin's Progress</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {(liveData[session.id]?.timeline || []).map((step, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink)' }}>
                                      <span style={{
                                        width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 8, fontWeight: 700,
                                        background: step.status === 'done' ? 'rgba(33,193,154,0.12)' : step.status === 'running' ? 'rgba(2,148,222,0.12)' : step.status === 'waiting' ? 'rgba(233,168,32,0.12)' : 'var(--bg)',
                                        color: step.status === 'done' ? 'var(--green)' : step.status === 'running' ? 'var(--blue)' : step.status === 'waiting' ? '#e9a820' : 'var(--dim)',
                                      }}>
                                        {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : step.status === 'waiting' ? '!' : (i + 1)}
                                      </span>
                                      <span style={{ fontWeight: 500, fontSize: 10 }}>{step.step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
                                <span style={{ fontWeight: 600, width: 52, flexShrink: 0 }}>Sent:</span>
                                <span className="font-mono">{formatTimestamp(session.created_at)}</span>
                              </div>
                              {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) && (
                                <>
                                  <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
                                    <span style={{ fontWeight: 600, width: 52, flexShrink: 0 }}>Solved:</span>
                                    <span className="font-mono" style={{ color: 'var(--green)' }}>{formatTimestamp(session.updated_at)}</span>
                                  </div>
                                  {session.updated_at && (
                                    <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
                                      <span style={{ fontWeight: 600, width: 52, flexShrink: 0 }}>Duration:</span>
                                      <span className="font-mono" style={{ color: 'var(--purple)', fontWeight: 700 }}>{timeDiff(session.created_at, session.updated_at)}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            {/* PR + Session links */}
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              {(session.pr_url || liveData[session.id]?.pr_url) && (
                                <a href={session.pr_url || liveData[session.id]?.pr_url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(33,193,154,0.1)', color: 'var(--green)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid rgba(33,193,154,0.2)' }}>
                                  <GitPullRequest size={11} /> View PR
                                </a>
                              )}
                              {session.session_url && (
                                <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--bg)', color: 'var(--blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--rule)' }}>
                                  <ExternalLink size={11} /> View on Devin
                                </a>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right column: Video / Recording / Devin Session Embed */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Video size={12} />
                      {(session.recording_url || liveData[session.id]?.playback_url) ? "Devin's Test Recording" : session.session_url ? "Devin's Live Session" : 'Preview'}
                    </div>
                    {(session.recording_url || liveData[session.id]?.playback_url) ? (
                      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--rule)', background: '#0d1117' }}>
                        <video
                          src={session.recording_url || liveData[session.id]?.playback_url || undefined}
                          controls
                          style={{ width: '100%', display: 'block', maxHeight: 260, background: '#000' }}
                          preload="metadata"
                          poster=""
                        />
                        <div style={{ padding: '8px 14px', background: 'var(--bg)', borderTop: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: 'var(--dim)' }}>Devin recorded this test run</span>
                          <a href={session.recording_url || liveData[session.id]?.playback_url || undefined} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Play size={10} /> Full screen
                          </a>
                        </div>
                      </div>
                    ) : session.session_url ? (
                      <div style={{ borderRadius: 10, border: '1px solid var(--rule)', overflow: 'hidden', background: '#0d1117' }}>
                        {/* Session activity preview */}
                        <div style={{ padding: '16px 18px', minHeight: 200 }}>
                          {/* Devin avatar + status header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <img src="/brand/devin-icon.png" alt="Devin" style={{ width: 28, height: 28, borderRadius: 6, background: '#1a1f2e' }} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#e6edf3' }}>Devin AI</div>
                              <div style={{ fontSize: 10, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                                  background: session.status_detail === 'waiting_for_user' ? '#e9a820' : session.status === 'running' ? '#3fb950' : '#8b949e',
                                  animation: session.status === 'running' ? 'pulse 2s infinite' : 'none'
                                }} />
                                {session.status_detail === 'waiting_for_user' ? 'Waiting for your approval' : session.status === 'running' ? 'Working on fix...' : session.status === 'suspended' ? 'Session paused' : session.status}
                              </div>
                            </div>
                          </div>

                          {/* Devin's Messages */}
                          {(liveData[session.id]?.messages || []).length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <MessageSquare size={9} /> Devin's Updates
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {(liveData[session.id]?.messages || []).map((msg, i) => (
                                  <div key={i} style={{ background: '#161b22', borderRadius: 8, padding: '8px 10px', border: '1px solid #21262d' }}>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5 }}>{msg.message}</div>
                                    <div style={{ fontSize: 9, color: '#484f58', marginTop: 4 }}>
                                      {(() => { try { const d = new Date(msg.timestamp + (msg.timestamp.includes('Z') || msg.timestamp.includes('+') ? '' : 'Z')); return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch { return ''; } })()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Task Progress (Todos) */}
                          {(liveData[session.id]?.todos || []).length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <CheckCheck size={9} /> Task Progress
                                <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 500, color: '#58a6ff' }}>
                                  {(liveData[session.id]?.todos || []).filter(t => t.status === 'completed').length}/{(liveData[session.id]?.todos || []).length} done
                                </span>
                              </div>
                              <div style={{ background: '#161b22', borderRadius: 8, padding: '10px 12px', border: '1px solid #21262d' }}>
                                {/* Progress bar */}
                                <div style={{ height: 3, borderRadius: 2, background: '#21262d', marginBottom: 8 }}>
                                  <div style={{
                                    height: '100%', borderRadius: 2,
                                    background: 'linear-gradient(90deg, #3fb950, #58a6ff)',
                                    width: `${Math.round(((liveData[session.id]?.todos || []).filter(t => t.status === 'completed').length / Math.max((liveData[session.id]?.todos || []).length, 1)) * 100)}%`,
                                    transition: 'width 0.5s ease'
                                  }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {(liveData[session.id]?.todos || []).map((todo, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 10, lineHeight: 1.4 }}>
                                      <span style={{
                                        width: 12, height: 12, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, marginTop: 1, fontSize: 7, fontWeight: 700,
                                        background: todo.status === 'completed' ? 'rgba(63,185,80,0.15)' : todo.status === 'in_progress' ? 'rgba(88,166,255,0.15)' : 'rgba(139,148,158,0.1)',
                                        color: todo.status === 'completed' ? '#3fb950' : todo.status === 'in_progress' ? '#58a6ff' : '#484f58',
                                        border: `1px solid ${todo.status === 'completed' ? 'rgba(63,185,80,0.3)' : todo.status === 'in_progress' ? 'rgba(88,166,255,0.3)' : 'rgba(139,148,158,0.15)'}`,
                                      }}>
                                        {todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '▶' : '○'}
                                      </span>
                                      <span style={{
                                        color: todo.status === 'completed' ? '#8b949e' : todo.status === 'in_progress' ? '#e6edf3' : '#484f58',
                                        textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                                        fontWeight: todo.status === 'in_progress' ? 600 : 400,
                                      }}>
                                        {todo.content}
                                        {todo.status === 'in_progress' && <span style={{ marginLeft: 4, color: '#58a6ff', fontSize: 9 }}>in progress</span>}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Timeline activity log (fallback if no todos) */}
                          {(liveData[session.id]?.todos || []).length === 0 && (
                          <div style={{ background: '#161b22', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
                            {loadingLive.has(session.id) ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
                                <Loader2 size={14} className="animate-spin" style={{ color: '#58a6ff' }} />
                                <span style={{ color: '#e6edf3' }}>Connecting to Devin...</span>
                              </div>
                            ) : (liveData[session.id]?.timeline || []).length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                {(liveData[session.id]?.timeline || []).map((step, i, arr) => (
                                  <div key={i} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                                    {/* Vertical line connector */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                                      <div style={{
                                        width: 10, height: 10, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                                        background: step.status === 'done' ? '#3fb950' : step.status === 'running' ? '#58a6ff' : step.status === 'waiting' ? '#e9a820' : '#484f58',
                                        boxShadow: step.status === 'running' ? '0 0 8px rgba(88,166,255,0.5)' : step.status === 'waiting' ? '0 0 8px rgba(233,168,32,0.5)' : 'none',
                                        animation: step.status === 'running' ? 'pulse 2s infinite' : 'none',
                                      }} />
                                      {i < arr.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 12, background: '#21262d' }} />}
                                    </div>
                                    {/* Step content */}
                                    <div style={{ paddingBottom: i < arr.length - 1 ? 10 : 0, flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        fontSize: 11, fontWeight: 600,
                                        color: step.status === 'done' ? '#e6edf3' : step.status === 'running' ? '#58a6ff' : step.status === 'waiting' ? '#e9a820' : '#8b949e',
                                      }}>
                                        {step.step}
                                        {step.status === 'running' && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>...</span>}
                                      </div>
                                      {step.detail && (
                                        <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {step.detail}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3fb950', animation: 'pulse 2s infinite' }} />
                                <span style={{ color: '#e6edf3', fontSize: 11 }}>Working on: {session.issue_title || 'issue fix'}</span>
                              </div>
                            )}
                          </div>
                          )}

                          {/* Worklog: Description, Impact, Recommended Fix */}
                          {session.issue_body && (() => {
                            const body = session.issue_body || '';
                            const descMatch = body.match(/##?\s*Description\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                            const impactMatch = body.match(/##?\s*Impact\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                            const fileMatch = body.match(/##?\s*File\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                            const fixMatch = body.match(/##?\s*Recommended\s*Fix\s*\n([\s\S]*?)(?=\n##?\s|$)/i);
                            return (
                              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {descMatch && (
                                  <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Description</div>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5 }}>{descMatch[1].trim()}</div>
                                  </div>
                                )}
                                {impactMatch && (
                                  <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#f85149', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Impact</div>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5 }}>{impactMatch[1].trim()}</div>
                                  </div>
                                )}
                                {fileMatch && (
                                  <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>File</div>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5, fontFamily: 'monospace' }}>{fileMatch[1].trim()}</div>
                                  </div>
                                )}
                                {fixMatch && (
                                  <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#3fb950', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Recommended Fix</div>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5 }}>{fixMatch[1].trim()}</div>
                                  </div>
                                )}
                                {!descMatch && !impactMatch && !fixMatch && (
                                  <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Details</div>
                                    <div style={{ fontSize: 11, color: '#e6edf3', lineHeight: 1.5 }}>{body.slice(0, 300)}{body.length > 300 ? '...' : ''}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Footer with link */}
                        <div style={{ padding: '8px 14px', background: '#161b22', borderTop: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: '#8b949e' }}>
                            {session.status_detail === 'waiting_for_user' ? "Review Devin's work before approving" : 'Live Devin session'}
                          </span>
                          <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, fontWeight: 600, color: '#58a6ff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={10} /> Open full session
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', borderRadius: 10, border: '1px dashed var(--rule)', color: 'var(--dim)', fontSize: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'center' }}>
                        <Play size={24} style={{ opacity: 0.2 }} />
                        <span>{['completed', 'succeeded', 'finished', 'stopped'].includes(session.status)
                          ? 'No recording available'
                          : 'Video will appear when Devin finishes'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

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
