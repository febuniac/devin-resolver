import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import api from '../api/client';

interface Session {
  id: string;
  issue_id: number;
  issue_title: string;
  status: string;
  pr_url: string;
  created_at: string;
  session_url: string;
}

export default function Approvals() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

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

  const topbarEl = document.getElementById('topbar-actions');
  const running = sessions.filter(s => s.status === 'running' || s.status === 'pending').length;
  const completed = sessions.filter(s => s.status === 'completed' || s.status === 'succeeded').length;

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Sessions', value: sessions.length, color: 'var(--purple)' },
          { label: 'Running', value: running, color: 'var(--blue)' },
          { label: 'Completed', value: completed, color: 'var(--green)' },
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
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
          <div key={session.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 100px', padding: '14px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>{session.issue_title || 'Devin Session'}</div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>Created {new Date(session.created_at).toLocaleDateString()}</div>
            </div>
            <div>
              {session.session_url ? (
                <a href={session.session_url} target="_blank" rel="noopener noreferrer"
                  className="font-mono" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View <ExternalLink size={10} />
                </a>
              ) : <span style={{ fontSize: 11, color: 'var(--dim)' }}>Pending</span>}
            </div>
            <div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                {(session.status === 'completed' || session.status === 'succeeded') ? (
                  <><CheckCircle size={14} style={{ color: 'var(--green)' }} /><span style={{ color: 'var(--green)' }}>Done</span></>
                ) : (session.status === 'running' || session.status === 'pending') ? (
                  <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Running</span></>
                ) : (
                  <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>{session.status}</span></>
                )}
              </span>
            </div>
            <div>
              {session.pr_url ? (
                <a href={session.pr_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'var(--green)', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Review PR <ExternalLink size={10} />
                </a>
              ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
