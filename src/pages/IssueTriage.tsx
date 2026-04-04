import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Send, RefreshCw, Loader2, X, Sparkles, Brain, Play, GitPullRequest, PartyPopper, ChevronDown, ChevronUp } from 'lucide-react';
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
  effort_estimate: string;
  description: string;
}

const categoryChipClass: Record<string, string> = {
  bug: 'chip-red', security: 'chip-red', feature: 'chip-blue',
  enhancement: 'chip-amber', performance: 'chip-purple',
};

const severityChipClass: Record<string, string> = {
  critical: 'chip-red', high: 'chip-red', medium: 'chip-amber', low: 'chip-dim',
};

export function IssueTriage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [successModal, setSuccessModal] = useState({ show: false, count: 0 });
  const [error, setError] = useState('');

  useEffect(() => { loadIssues(); }, []);

  const loadIssues = async () => {
    try { setIssues(await api.listIssues() as Issue[]); }
    catch { setError('Failed to load issues'); }
    finally { setLoading(false); }
  };

  const triageAll = async () => {
    setSyncing(true);
    try { await api.triageAll(); await loadIssues(); }
    catch { setError('Failed to sync'); }
    finally { setSyncing(false); }
  };

  const sendToDevin = async (issueIds?: number[]) => {
    const ids = issueIds || Array.from(selectedIssues);
    if (ids.length === 0) return;
    setSending(true);
    try {
      await api.approveIssues(ids);
      setSuccessModal({ show: true, count: ids.length });
      setSelectedIssues(new Set());
      await loadIssues();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send to Devin');
    } finally { setSending(false); }
  };

  const filtered = issues.filter(issue => {
    if (searchQuery && !issue.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    return true;
  });

  const toggleIssue = (id: number) => {
    const s = new Set(selectedIssues);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIssues(s);
  };

  const selectAll = () => {
    selectedIssues.size === filtered.length ? setSelectedIssues(new Set()) : setSelectedIssues(new Set(filtered.map(i => i.id)));
  };

  const topbarEl = document.getElementById('topbar-actions');

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>;

  return (
    <div className="animate-fade-in">
      {/* Success Modal */}
      {successModal.show && createPortal(
        <div className="animate-modal-bg" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSuccessModal({ ...successModal, show: false })}>
          <div className="animate-modal-pop" style={{ position: 'relative', background: '#18181b', border: '1px solid rgba(57,105,202,0.3)', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(57,105,202,0.2)' }} onClick={e => e.stopPropagation()}>
            <div className="animate-confetti-pop" style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--purple), var(--green))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <PartyPopper size={32} color="#fff" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{successModal.count} issue{successModal.count !== 1 ? 's' : ''} off your plate!</h2>
            <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 4 }}>That{'\u2019'}s {successModal.count} fewer thing{successModal.count !== 1 ? 's' : ''} you have to worry about.</p>
            <p style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Devin takes it from here.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 11, color: '#71717a', marginBottom: 16 }}>
              {[{ I: Sparkles, l: 'Analyzing' }, { I: Brain, l: 'Writing fix' }, { I: Play, l: 'Testing' }, { I: GitPullRequest, l: 'Opening PR' }].map((s, i) => (
                <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: '#3f3f46', marginRight: 4 }}>{'\u2192'}</span>}
                  <s.I size={14} style={{ color: 'var(--blue)' }} /><span>{s.l}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSuccessModal({ ...successModal, show: false })} style={{ background: 'var(--purple)', color: '#fff', padding: '8px 24px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Got it!</button>
            <button onClick={() => setSuccessModal({ ...successModal, show: false })} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}><X size={20} /></button>
          </div>
        </div>,
        document.body
      )}

      {/* Topbar actions */}
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedIssues.size > 0 && (
            <button onClick={() => sendToDevin()} disabled={sending}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: 'none', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={14} /> Send {selectedIssues.size} to Devin
            </button>
          )}
          <button onClick={triageAll} disabled={syncing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--rule)', background: 'var(--bg2)', color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync & Triage
          </button>
        </div>,
        topbarEl
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: 'rgba(229,62,62,.1)', border: '1px solid rgba(229,62,62,.2)', color: '#c53030', fontSize: 13, marginBottom: 14 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c53030', cursor: 'pointer', fontSize: 12 }}>dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
          <input type="text" placeholder="Search issues..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--white)', fontSize: 13, color: 'var(--ink)', outline: 'none' }} />
        </div>
        {[
          { val: severityFilter, set: setSeverityFilter, opts: ['all','critical','high','medium','low'], label: 'Severity' },
          { val: statusFilter, set: setStatusFilter, opts: ['all','triaged','approved','in_progress','resolved'], label: 'Status' },
          { val: categoryFilter, set: setCategoryFilter, opts: ['all','bug','security','feature','enhancement','performance'], label: 'Category' },
        ].map(f => (
          <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--white)', fontSize: 12, color: 'var(--mid)', cursor: 'pointer' }}>
            {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? 'All ' + f.label : o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 52px 1fr 90px 80px 90px 80px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
          <div><input type="checkbox" checked={selectedIssues.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ cursor: 'pointer' }} /></div>
          {['ID', 'Issue', 'Type', 'Score', 'Status', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No issues match your filters.</div>
        ) : filtered.map(issue => (
          <div key={issue.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 52px 1fr 90px 80px 90px 80px', padding: '12px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
              <div onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIssues.has(issue.id)} onChange={() => toggleIssue(issue.id)} style={{ cursor: 'pointer' }} /></div>
              <div className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)' }}>#{issue.github_id}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {issue.title}
                  {expandedIssue === issue.id ? <ChevronUp size={14} style={{ color: 'var(--dim)' }} /> : <ChevronDown size={14} style={{ color: 'var(--dim)' }} />}
                </div>
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>{issue.repo}</div>
              </div>
              <div><span className={`chip ${categoryChipClass[issue.category] || 'chip-dim'}`}>{issue.category}</span></div>
              <div><span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: issue.confidence >= 75 ? 'var(--green)' : '#d97706' }}>{issue.confidence}</span></div>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                  {issue.status === 'resolved' ? <><span className="dot dot-green" /><span style={{ color: 'var(--green)' }}>Merged</span></> :
                   issue.status === 'in_progress' ? <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Running</span></> :
                   issue.status === 'approved' ? <><span className="dot dot-amber" /><span style={{ color: '#d97706' }}>Approved</span></> :
                   <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>Queued</span></>}
                </span>
              </div>
              <div onClick={e => e.stopPropagation()}>
                {issue.status === 'triaged' ? (
                  <button onClick={() => sendToDevin([issue.id])} style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff' }}>Approve {'\u2192'}</button>
                ) : (issue.status === 'approved' || issue.status === 'in_progress') ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{'\u2713'} Sent</span>
                ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
              </div>
            </div>
            {expandedIssue === issue.id && (
              <div style={{ padding: '12px 16px 12px 108px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)', fontSize: 12, color: 'var(--mid)', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <span>Severity: <span className={`chip ${severityChipClass[issue.severity] || 'chip-dim'}`}>{issue.severity}</span></span>
                  <span>Effort: <strong style={{ color: 'var(--ink)' }}>{issue.effort_estimate || 'Unknown'}</strong></span>
                </div>
                {issue.description && <p style={{ margin: 0 }}>{issue.description}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default IssueTriage;
