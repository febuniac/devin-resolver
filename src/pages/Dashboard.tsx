import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Issue {
  id: number;
  github_id: number;
  title: string;
  status: string;
  severity: string;
  category: string;
  repo: string;
  confidence: number;
}

const categoryChipClass: Record<string, string> = {
  bug: 'chip-red',
  security: 'chip-red',
  feature: 'chip-blue',
  enhancement: 'chip-amber',
  performance: 'chip-purple',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadIssues(); }, []);

  const loadIssues = async () => {
    try { setIssues(await api.listIssues() as Issue[]); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const syncGithub = async () => {
    setSyncing(true);
    try { await api.triageAll(); await loadIssues(); }
    catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  const approveIssue = async (id: number) => {
    try { await api.approveIssues([id]); await loadIssues(); }
    catch { /* ignore */ }
  };

  const total = issues.length;
  const critical = issues.filter(i => i.severity === 'critical').length;
  const merged = issues.filter(i => i.status === 'resolved').length;
  const approved = issues.filter(i => i.status === 'approved' || i.status === 'in_progress' || i.status === 'resolved').length;
  const mergeRate = total > 0 ? Math.round((merged / Math.max(approved, 1)) * 100) : 0;
  const topIssues = issues.slice(0, 5);
  const topbarEl = document.getElementById('topbar-actions');

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={syncGithub} disabled={syncing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--rule)', background: 'var(--bg2)', color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync GitHub
          </button>
          <button onClick={() => navigate('/issues')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Approve Batch
          </button>
        </div>, topbarEl
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Open Issues', value: total, color: 'var(--purple)', delta: merged + ' resolved this month', dd: 'down' },
          { label: 'Critical CVEs', value: critical, color: '#e53e3e', delta: issues.filter(i => i.severity === 'critical' && i.status === 'resolved').length + ' resolved by Devin', dd: 'down' },
          { label: 'PRs Merged', value: merged, color: 'var(--green)', delta: merged + ' more than last month', dd: 'up' },
          { label: 'Merge Rate', value: mergeRate + '%', color: 'var(--blue)', delta: 'from 67% baseline', dd: 'up' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: s.color }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: 'var(--green)' }}>{s.dd === 'down' ? '\u2193' : '\u2191'} {s.delta}</div>
          </div>
        ))}
      </div>

      {/* Triage Queue */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Active Triage Queue</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>AI-scored {'\u00b7'} sorted by priority {'\u00b7'} awaiting approval</div>
        </div>
        <span onClick={() => navigate('/issues')} style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple)', cursor: 'pointer' }}>View all {total} issues {'\u2192'}</span>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 80px 90px 80px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)', gap: '0 10px' }}>
          {['ID', 'Issue', 'Type', 'Score', 'Status', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>
        ) : topIssues.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No issues yet. Connect a repo in Settings, then Sync GitHub.</div>
        ) : topIssues.map(issue => (
          <div key={issue.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 80px 90px 80px', padding: '12px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', gap: '0 10px' }}>
            <div className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{issue.github_id}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35 }}>{issue.title}</div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>{issue.repo}</div>
            </div>
            <div><span className={`chip ${categoryChipClass[issue.category] || 'chip-dim'}`}>{issue.category}</span></div>
            <div><span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: issue.confidence >= 75 ? 'var(--green)' : '#d97706' }}>{issue.confidence}</span></div>
            <div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                {issue.status === 'resolved' ? <><span className="dot dot-green" /><span style={{ color: 'var(--green)' }}>Merged {'\u2713'}</span></> :
                 issue.status === 'in_progress' ? <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Running</span></> :
                 issue.status === 'approved' ? <><span className="dot dot-amber" /><span style={{ color: '#d97706' }}>Approved</span></> :
                 <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>Queued</span></>}
              </span>
            </div>
            <div>
              {issue.status === 'triaged' ? (
                <button onClick={() => approveIssue(issue.id)} style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff' }}>Approve {'\u2192'}</button>
              ) : (issue.status === 'approved' || issue.status === 'in_progress') ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{'\u2713'} Approved</span>
              ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {/* PRs merged */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>PRs merged this month</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>By week {'\u00b7'} April 2026</div>
            </div>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--purple)' }}>{merged}</span>
          </div>
          {[{ l:'W1',p:55,c:'var(--purple)' },{ l:'W2',p:65,c:'var(--purple)' },{ l:'W3',p:80,c:'var(--green)' },{ l:'W4',p:35,c:'var(--blue)' }].map(b => (
            <div key={b.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--mid)', width: 28, textAlign: 'right' }}>{b.l}</span>
              <div style={{ flex: 1, height: 7, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: b.p+'%', borderRadius: 4, background: b.c, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
              </div>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', width: 28 }}>{Math.round(merged*b.p/100)}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)', display: 'flex', gap: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>Merge rate <strong style={{ color: 'var(--green)' }}>{mergeRate}%</strong></div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>Cost per PR <strong style={{ color: 'var(--purple)' }}>~$13</strong></div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>Avg time <strong style={{ color: 'var(--blue)' }}>47min</strong></div>
          </div>
        </div>

        {/* Slack */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Slack activity</div>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--dim)' }}># eng-devin</span>
          </div>
          <div style={{ background: '#1a1d21', borderRadius: 0 }}>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflow: 'hidden' }}>
              <SlackMsg av="D" isDevin name="Devin" time="9:58 AM" text={<><strong style={{color:'#d1d2d3',fontWeight:500}}>PR #2041 opened</strong> {'\u2014'} pagination bug fixed and tested.</>} attachment={{ title: 'Pagination \u00b7 PR #2041 \u00b7 5/5 tests \u00b7 CI green', sub: '+9 / -4 \u00b7 E2E verified \u00b7 Ready to merge' }} />
              <SlackMsg av="ME" isDevin={false} name="Maria E." time="10:04 AM" text={<>Merging. <strong style={{color:'#d1d2d3',fontWeight:500}}>@devin</strong> tag the issue fixed?</>} />
              <SlackMsg av="D" isDevin name="Devin" time="10:04 AM" text={<>Done {'\u2014'} #1847 labeled fixed, changelog updated. Moving to next issue.</>} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlackMsg({ av, isDevin, name, time, text, attachment }: { av: string; isDevin: boolean; name: string; time: string; text: React.ReactNode; attachment?: { title: string; sub: string } }) {
  const avStyle = isDevin
    ? { background: 'rgba(33,193,154,.15)', border: '1px solid rgba(33,193,154,.2)', color: 'var(--green)' }
    : { background: '#1e3a5f', color: '#7dd3fc' };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isDevin ? 9 : 8, fontWeight: 700, fontFamily: 'var(--mono)', ...avStyle }}>{av}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#d1d2d3', marginBottom: 1 }}>{name} <span className="font-mono" style={{ fontSize: 9, color: '#5c5e66', marginLeft: 5 }}>{time}</span></div>
        <div style={{ fontSize: 11, color: '#7c7e83', lineHeight: 1.5 }}>{text}</div>
        {attachment && (
          <div style={{ background: '#131517', borderLeft: '2px solid var(--green)', borderRadius: '0 4px 4px 0', padding: '6px 10px', marginTop: 5 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#d1d2d3', marginBottom: 1 }}>{attachment.title}</div>
            <div style={{ fontSize: 9, color: '#5c5e66' }}>{attachment.sub}</div>
          </div>
        )}
      </div>
    </div>
  );
}
