import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, ExternalLink, CheckCircle, Clock, ChevronDown, ChevronRight, Play, GitPullRequest, Send, CheckCheck, MessageSquare, Filter, Eye } from 'lucide-react';
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
}

interface LiveData {
  title: string;
  status: string;
  status_detail: string;
  url: string;
  playback_url: string;
  pr_url: string;
  structured_output: Record<string, unknown>;
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
  const [filter, setFilter] = useState<FilterType>('all');
  const [liveData, setLiveData] = useState<Record<string, LiveData>>({});
  const [loadingLive, setLoadingLive] = useState<Set<string>>(new Set());

  useEffect(() => { loadSessions(); }, []);

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

  const toggleExpand = async (id: string) => {
    const wasExpanded = expanded.has(id);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (!wasExpanded && !liveData[id]) {
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

  const approveSession = async (sessionId: string) => {
    setApproving(prev => new Set(prev).add(sessionId));
    try {
      await api.approveSession(sessionId);
      await loadSessions();
    } catch (e) {
      console.error('Failed to approve session:', e);
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
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 110px 100px 100px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
          <div />
          {['Issue', 'Sent', 'Solved', 'Status', 'Action'].map(h => (
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
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 110px 110px 100px 100px', padding: '14px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
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
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--dim)' }}>{session.status === 'running' ? 'In progress...' : '—'}</span>
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
                  ) : session.status === 'blocked' ? (
                    <><span className="dot" style={{ background: '#e53e3e' }} /><span style={{ color: '#e53e3e' }}>Blocked</span></>
                  ) : (
                    <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>{session.status}</span></>
                  )}
                </span>
              </div>
              <div onClick={e => e.stopPropagation()}>
                {session.status_detail === 'waiting_for_user' ? (
                  <button
                    onClick={() => approveSession(session.id)}
                    disabled={approving.has(session.id)}
                    style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: '#e9a820', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: approving.has(session.id) ? 0.6 : 1 }}>
                    {approving.has(session.id) ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />} Approve
                  </button>
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
                {/* Waiting for User - Prominent approval banner */}
                {session.status_detail === 'waiting_for_user' && (
                  <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 10, background: '#e9a82015', border: '1px solid #e9a82040', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <MessageSquare size={20} style={{ color: '#e9a820', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#e9a820', marginBottom: 4 }}>Devin needs your approval to proceed</div>
                      <div style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.5, marginBottom: 10 }}>
                        Devin has analyzed the issue and prepared a plan. Review the details below and click Approve to let Devin proceed with the fix, PR creation, and testing.
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button
                          onClick={() => approveSession(session.id)}
                          disabled={approving.has(session.id)}
                          style={{ fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#e9a820', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: approving.has(session.id) ? 0.6 : 1 }}>
                          {approving.has(session.id) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve &amp; Proceed
                        </button>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Left: Details */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Session Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Status:</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: session.status_detail === 'waiting_for_user' ? '#e9a820' : ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'var(--green)' : 'var(--blue)' }}>
                          {session.status_detail === 'waiting_for_user' ? 'Waiting for Approval' : session.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Sent:</span>
                        <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{formatTimestamp(session.created_at)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Solved:</span>
                        <span className="font-mono" style={{ fontSize: 12, color: ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'var(--green)' : 'var(--dim)' }}>
                          {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? formatTimestamp(session.updated_at) : 'In progress...'}
                        </span>
                      </div>
                      {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) && session.updated_at && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Duration:</span>
                          <span className="font-mono" style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 600 }}>{timeDiff(session.created_at, session.updated_at)}</span>
                        </div>
                      )}
                      {session.issue_number && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Issue:</span>
                          <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink)' }}>#{session.issue_number} {session.issue_title}</span>
                        </div>
                      )}
                      {session.repo_full_name && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Repo:</span>
                          <a href={`https://github.com/${session.repo_full_name}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>
                            {session.repo_full_name}
                          </a>
                        </div>
                      )}
                      {session.session_url && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Session:</span>
                          <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            View on Devin <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                      {session.pr_url && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>PR:</span>
                          <a href={session.pr_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <GitPullRequest size={12} /> {session.pr_url.split('/').slice(-2).join('#')}
                          </a>
                        </div>
                      )}
                      {loadingLive.has(session.id) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                          <Loader2 size={12} className="animate-spin" style={{ color: 'var(--blue)' }} />
                          <span style={{ fontSize: 11, color: 'var(--dim)' }}>Fetching live details from Devin...</span>
                        </div>
                      )}
                      {liveData[session.id]?.title && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--dim)', width: 70, flexShrink: 0 }}>Plan:</span>
                          <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>{liveData[session.id].title}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Recording / Preview */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                      {session.recording_url || liveData[session.id]?.playback_url ? 'Test Recording' : 'Preview'}
                    </div>
                    {(session.recording_url || liveData[session.id]?.playback_url) ? (
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rule)', background: '#000' }}>
                        <video
                          src={session.recording_url || undefined}
                          controls
                          style={{ width: '100%', display: 'block', maxHeight: 200 }}
                          preload="metadata"
                        />
                        <a href={session.recording_url || undefined} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg)', fontSize: 11, color: 'var(--blue)', textDecoration: 'none', borderTop: '1px solid var(--rule)' }}>
                          <Play size={12} /> Watch full recording
                        </a>
                      </div>
                    ) : session.session_url ? (
                      <div style={{ borderRadius: 8, border: '1px solid var(--rule)', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', textAlign: 'center', background: 'var(--white)' }}>
                          <Eye size={24} style={{ margin: '0 auto 8px', color: 'var(--blue)', display: 'block' }} />
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                            {session.status_detail === 'waiting_for_user' ? "Review Devin's work before approving" : 'View live session on Devin'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12 }}>
                            {session.status_detail === 'waiting_for_user'
                              ? 'Click below to see what Devin has analyzed and planned'
                              : 'Recording will be available when Devin completes the fix'}
                          </div>
                          <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, padding: '8px 20px', borderRadius: 8, background: 'var(--blue)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <ExternalLink size={12} /> Open in Devin
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 20, textAlign: 'center', borderRadius: 8, border: '1px dashed var(--rule)', color: 'var(--dim)', fontSize: 11 }}>
                        <Play size={20} style={{ margin: '0 auto 6px', opacity: 0.3, display: 'block' }} />
                        {['completed', 'succeeded', 'finished', 'stopped'].includes(session.status)
                          ? 'No recording available for this session'
                          : 'Recording will be available when Devin completes the fix'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
