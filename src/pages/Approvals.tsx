import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, ExternalLink, CheckCircle, Clock, ChevronDown, ChevronRight, Play, GitPullRequest } from 'lucide-react';
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
  session_url: string;
  recording_url: string | null;
}

export default function Approvals() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topbarEl = document.getElementById('topbar-actions');
  const running = sessions.filter(s => s.status === 'running' || s.status === 'pending').length;
  const completed = sessions.filter(s => ['completed', 'succeeded', 'finished', 'stopped'].includes(s.status)).length;
  const withPR = sessions.filter(s => s.pr_url).length;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>;

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--purple)' },
          { label: 'Running', value: running, color: 'var(--blue)' },
          { label: 'Completed', value: completed, color: 'var(--green)' },
          { label: 'PRs Opened', value: withPR, color: '#e9a820' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: s.color }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Sessions Table */}
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Devin Sessions</div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 100px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
          <div />
          {['Issue', 'Session', 'Status', 'PR'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {sessions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            <Clock size={24} style={{ color: 'var(--dim)', display: 'block', margin: '0 auto 8px' }} />
            No Devin sessions yet. Send issues from Issue Triage to start.
          </div>
        ) : sessions.map(session => (
          <div key={session.id}>
            {/* Session Row */}
            <div
              onClick={() => toggleExpand(session.id)}
              style={{ display: 'grid', gridTemplateColumns: '28px 1fr 120px 100px 100px', padding: '14px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
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
                  <span>Created {new Date(session.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div>
                {session.session_url ? (
                  <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="font-mono" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    View <ExternalLink size={10} />
                  </a>
                ) : <span style={{ fontSize: 11, color: 'var(--dim)' }}>Pending</span>}
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
              <div>
                {session.pr_url ? (
                  <a href={session.pr_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--green)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Review PR <ExternalLink size={10} />
                  </a>
                ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
              </div>
            </div>

            {/* Expanded Details */}
            {expanded.has(session.id) && (
              <div style={{ padding: '16px 16px 16px 44px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Left: Details */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Session Details</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--dim)', width: 70 }}>Status:</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: ['completed', 'succeeded', 'finished', 'stopped'].includes(session.status) ? 'var(--green)' : 'var(--blue)' }}>
                          {session.status}
                        </span>
                      </div>
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
                    </div>
                  </div>

                  {/* Right: Recording */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dim)', marginBottom: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Test Recording</div>
                    {session.recording_url ? (
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rule)', background: '#000' }}>
                        <video
                          src={session.recording_url}
                          controls
                          style={{ width: '100%', display: 'block', maxHeight: 200 }}
                          preload="metadata"
                        />
                        <a href={session.recording_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg)', fontSize: 11, color: 'var(--blue)', textDecoration: 'none', borderTop: '1px solid var(--rule)' }}>
                          <Play size={12} /> Watch full recording
                        </a>
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
