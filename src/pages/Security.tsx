import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, RefreshCw, Loader2, Sparkles, Cpu, Play, GitPullRequest, X, ChevronDown, ChevronUp, Shield, Clock, TrendingDown, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface Issue {
  id: number;
  github_id: number;
  number: number;
  title: string;
  body: string;
  status: string;
  severity: string;
  category: string;
  repo_full_name: string;
  ai_confidence: number;
  estimated_effort: string;
  ai_summary: string;
  labels: string[];
  author: string;
  devin_session_id: string | null;
  devin_session_url: string | null;
  pr_url: string | null;
}

const severityChipClass: Record<string, string> = {
  critical: 'chip-red', high: 'chip-red', medium: 'chip-amber', low: 'chip-dim',
};

/* ---- Success Modal Component ---- */
function SuccessModal({ count, issues, onClose, onViewProgress }: { count: number; issues: Issue[]; onClose: () => void; onViewProgress: () => void }) {
  const isMultiple = count > 1;

  const getEstTime = () => {
    if (issues.length === 0) return '~1h';
    const efforts = issues.map(i => {
      const e = (i.estimated_effort || '').toLowerCase();
      if (e.includes('high') || e.includes('3') || e.includes('4')) return 3;
      if (e.includes('medium') || e.includes('2')) return 2;
      return 1;
    });
    const maxEffort = Math.max(...efforts);
    if (maxEffort >= 3) return '~2h';
    if (maxEffort >= 2) return '~1.5h';
    return '~45m';
  };

  const getMergeRate = () => {
    if (issues.length === 0) return '95%';
    const avg = Math.round(issues.reduce((sum, i) => sum + (i.ai_confidence || 90), 0) / issues.length);
    return `${avg}%`;
  };

  const steps = [
    { icon: Sparkles, label: 'Analyzing' },
    { icon: Cpu, label: 'Writing fix' },
    { icon: Play, label: 'Testing' },
    { icon: GitPullRequest, label: 'Opening PR' },
  ];

  return createPortal(
    <div className="animate-modal-bg"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="animate-modal-pop"
        style={{ position: 'relative', borderRadius: 20, maxWidth: 440, width: '100%', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}
        onClick={e => e.stopPropagation()}>

        {/* Dark gradient header */}
        <div style={{ background: 'linear-gradient(135deg, #0d1117, #1a2332, #0d1117)', padding: '28px 28px 24px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#9aa0b0', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#21C19A', display: 'inline-block' }}></span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e5e7', fontFamily: 'var(--mono)' }}>
              {count === 1 ? `Issue #${issues[0]?.number || issues[0]?.github_id || 0} approved` : `${count} issues approved`}
            </span>
          </div>

          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 4 }}>
            That{'\u2019'}s <strong style={{ color: '#fff' }}>{count} fewer vulnerability{count !== 1 ? 'ies' : ''}</strong> to worry about.
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#21C19A', lineHeight: 1.2 }}>
            Devin takes it<br />from here.
          </div>
        </div>

        {/* White body */}
        <div style={{ background: '#fff', padding: '24px 28px 20px' }}>
          {isMultiple && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: '#f0fdf8', border: '1px solid #d1fae5', marginBottom: 16 }}>
              <Cpu size={14} style={{ color: '#0d7c5f' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0d7c5f' }}>Parallel fleet</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{"\u2014"} {count} Devin sessions running simultaneously</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {steps.map((step, i) => (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <span style={{ color: '#d1d5db', fontSize: 16 }}>{'\u2192'}</span>}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f0fdf8', border: '1px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <step.icon size={18} style={{ color: '#0d7c5f' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280' }}>{step.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, maxHeight: isMultiple ? 160 : 'none', overflowY: isMultiple ? 'auto' : 'visible' }}>
            {issues.map(issue => (
              <div key={issue.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#f0f4ff', border: '1px solid #dbeafe', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#3969CA', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                  #{issue.number || issue.github_id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', flex: 1, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                <span style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{issue.severity}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              { value: getEstTime(), label: isMultiple ? 'EST. TIME (PARALLEL)' : 'EST. TIME', color: '#21C19A' },
              { value: getMergeRate(), label: 'CONFIDENCE', color: '#1f2937' },
              { value: 'Slack', label: 'NOTIFY VIA', color: '#3969CA' },
            ].map(stat => (
              <div key={stat.label} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#9ca3af', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <button onClick={onClose}
            style={{ width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0d3331, #134e4a)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: '#21C19A' }} />
            Got it {'\u2014'} I{'\u2019'}ll focus on other things
          </button>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <a href="#" onClick={e => { e.preventDefault(); onViewProgress(); }} style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', cursor: 'pointer' }}>
              View Devin{'\u2019'}s progress in real time {'\u2192'}
            </a>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <img src="/brand/backlogzero-light.png" alt="Backlog Zero" style={{ height: 20, opacity: 0.5 }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SecurityMetrics {
  total_findings: number;
  open_findings: number;
  resolved_findings: number;
  avg_remediation_hrs: number;
  resolved_this_week: number;
  resolved_this_month: number;
  remediation_rate: number;
  audit_readiness_score: number;
  fastest_remediation_hrs: number;
  slowest_remediation_hrs: number;
  open_by_severity: Record<string, number>;
}

export default function Security() {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('triaged');
  const [selectedIssues, setSelectedIssues] = useState<Set<number>>(new Set());
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [successModal, setSuccessModal] = useState<{ show: boolean; count: number; issues: Issue[] }>({ show: false, count: 0, issues: [] });
  const [error, setError] = useState('');
  const [secMetrics, setSecMetrics] = useState<SecurityMetrics | null>(null);

  useEffect(() => { loadIssues(); loadSecurityMetrics(); }, []);

  const loadSecurityMetrics = async () => {
    try {
      const data = await api.getSecurityMetrics();
      setSecMetrics(data);
    } catch { /* ignore */ }
  };

  const loadIssues = async () => {
    try {
      const data = await api.listIssues({ category: 'security' }) as Issue[];
      setIssues(data);
    }
    catch { setError('Failed to load security issues'); }
    finally { setLoading(false); }
  };

  const triageAll = async () => {
    setSyncing(true);
    try {
      await api.syncAndTriage();
      await api.retryStuck().catch(() => {});
      await loadIssues();
      window.dispatchEvent(new Event('issues-changed'));
    }
    catch { setError('Failed to sync'); }
    finally { setSyncing(false); }
  };

  const sendToDevin = async (issueIds?: number[]) => {
    const ids = issueIds || Array.from(selectedIssues);
    if (ids.length === 0) return;
    setSending(true);
    try {
      await api.approveIssues(ids);
      const sentIssues = issues.filter(i => ids.includes(i.id));
      setSuccessModal({ show: true, count: ids.length, issues: sentIssues });
      setSelectedIssues(new Set());
      await loadIssues();
      window.dispatchEvent(new Event('issues-changed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send to Devin');
    } finally { setSending(false); }
  };

  const filtered = issues.filter(issue => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!issue.title.toLowerCase().includes(q) && !(issue.body || '').toLowerCase().includes(q)) return false;
    }
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
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
      {successModal.show && <SuccessModal count={successModal.count} issues={successModal.issues} onClose={() => setSuccessModal({ ...successModal, show: false })} onViewProgress={() => { setSuccessModal({ ...successModal, show: false }); navigate('/approvals'); }} />}

      {/* Topbar actions */}
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedIssues.size > 0 && (
            <button onClick={() => sendToDevin()} disabled={sending}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: 'none', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/brand/devin-icon.png" alt="Devin" style={{ width: 14, height: 14, borderRadius: 2, filter: 'brightness(0) invert(1)', flexShrink: 0 }} /> Send {selectedIssues.size} to Devin
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

      {/* Security Metrics Header */}
      {secMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--green)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Clock size={13} style={{ color: 'var(--green)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as any, color: 'var(--dim)' }}>Time to Remediation</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, color: 'var(--green)', marginBottom: 4 }}>
              {secMetrics.avg_remediation_hrs}h
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              avg {'\u00b7'} fastest {secMetrics.fastest_remediation_hrs}h {'\u00b7'} slowest {secMetrics.slowest_remediation_hrs}h
            </div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--purple)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingDown size={13} style={{ color: 'var(--purple)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as any, color: 'var(--dim)' }}>Remediation Rate</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, color: 'var(--purple)', marginBottom: 4 }}>
              {secMetrics.remediation_rate}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {secMetrics.resolved_findings} of {secMetrics.total_findings} resolved
            </div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#e53e3e' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Shield size={13} style={{ color: '#e53e3e' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as any, color: 'var(--dim)' }}>Open Findings</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, color: '#e53e3e', marginBottom: 4 }}>
              {secMetrics.open_findings}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {secMetrics.open_by_severity?.critical || 0} critical {'\u00b7'} {secMetrics.open_by_severity?.high || 0} high
            </div>
          </div>

          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--blue)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <FileCheck size={13} style={{ color: 'var(--blue)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as any, color: 'var(--dim)' }}>Audit Readiness</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, color: 'var(--blue)', marginBottom: 4 }}>
              {secMetrics.audit_readiness_score}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>
              {secMetrics.resolved_this_month} resolved this month
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)' }} />
          <input type="text" placeholder="Search security issues..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--white)', fontSize: 13, color: 'var(--ink)', outline: 'none' }} />
        </div>
        {[
          { val: severityFilter, set: setSeverityFilter, opts: ['all','critical','high','medium','low'], label: 'Severity' },
          { val: statusFilter, set: setStatusFilter, opts: ['all','triaged','queued','approved','in_progress','resolved'], label: 'Status' },
        ].map(f => (
          <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--white)', fontSize: 12, color: 'var(--mid)', cursor: 'pointer' }}>
            {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? 'All ' + f.label : o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 100px 1fr 76px 56px 76px 76px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)', gap: '0 10px' }}>
          <div><input type="checkbox" checked={selectedIssues.size === filtered.length && filtered.length > 0} onChange={selectAll} style={{ cursor: 'pointer' }} /></div>
          {['ID', 'Issue', 'Severity', 'Score', 'Status', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>No security issues match your filters.</div>
        ) : filtered.map(issue => (
          <div key={issue.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '36px 100px 1fr 76px 56px 76px 76px', padding: '10px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center', cursor: 'pointer', gap: '0 10px' }}
              onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
              <div onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIssues.has(issue.id)} onChange={() => toggleIssue(issue.id)} style={{ cursor: 'pointer' }} /></div>
              <div className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{issue.number || issue.github_id}</div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title.replace(/^\[SECURITY\]\s*/i, '')}</span>
                  {expandedIssue === issue.id ? <ChevronUp size={14} style={{ color: 'var(--dim)', flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: 'var(--dim)', flexShrink: 0 }} />}
                </div>
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.repo_full_name}</div>
              </div>
              <div><span className={`chip ${severityChipClass[issue.severity] || 'chip-dim'}`} style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', fontSize: 9 }}>{issue.severity}</span></div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--rule)', overflow: 'hidden' }}>
                    <div style={{ width: `${issue.ai_confidence || 0}%`, height: '100%', borderRadius: 2, background: (issue.ai_confidence || 0) >= 80 ? 'var(--green)' : (issue.ai_confidence || 0) >= 60 ? '#d97706' : '#e53e3e' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: (issue.ai_confidence || 0) >= 80 ? 'var(--green)' : (issue.ai_confidence || 0) >= 60 ? '#d97706' : '#e53e3e' }}>{issue.ai_confidence || 0}%</span>
                </div>
              </div>
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                  {issue.status === 'resolved' ? <><span className="dot dot-green" /><span style={{ color: 'var(--green)' }}>Merged</span></> :
                   issue.status === 'in_progress' ? <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Running</span></> :
                   issue.status === 'approved' ? <><span className="dot dot-amber" /><span style={{ color: '#d97706' }}>Sending...</span></> :
                   issue.status === 'queued' ? <><span className="dot dot-amber" /><span style={{ color: '#d97706' }}>Queued</span></> :
                   <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>Triaged</span></>}
                </span>
              </div>
              <div onClick={e => e.stopPropagation()}>
                {issue.status === 'triaged' ? (
                  <button onClick={() => sendToDevin([issue.id])} style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 }}><img src="/brand/devin-icon.png" alt="Devin" style={{ width: 12, height: 12, borderRadius: 2, filter: 'brightness(0) invert(1)', flexShrink: 0 }} /> Send {'\u2192'}</button>
                ) : issue.status === 'queued' ? (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> Retrying</span>
                ) : (issue.status === 'approved' || issue.status === 'in_progress') ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>{'\u2713'} Sent</span>
                ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
              </div>
            </div>
            {expandedIssue === issue.id && (
              <div style={{ padding: '12px 16px 12px 108px', borderBottom: '1px solid var(--rule)', background: 'var(--bg)', fontSize: 12, color: 'var(--mid)', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span>Severity: <span className={`chip ${severityChipClass[issue.severity] || 'chip-dim'}`}>{issue.severity}</span></span>
                  <span>Effort: <strong style={{ color: 'var(--ink)' }}>{issue.estimated_effort || 'Unknown'}</strong></span>
                  <span>Confidence: <strong style={{ color: (issue.ai_confidence || 0) >= 80 ? 'var(--green)' : '#d97706' }}>{issue.ai_confidence || 0}%</strong></span>
                  {issue.devin_session_url && <a href={issue.devin_session_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--purple)', textDecoration: 'none', fontWeight: 600 }}>View Devin Session {'\u2192'}</a>}
                  {issue.pr_url && <a href={issue.pr_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>View PR {'\u2192'}</a>}
                </div>
                {issue.ai_summary && <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: 'var(--dim)', fontSize: 11 }}>{issue.ai_summary}</p>}
                {issue.body && (() => {
                  const sections = issue.body.split(/##\s+/).filter(Boolean);
                  if (sections.length > 1) {
                    return (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {sections.map((section, i) => {
                          const lines = section.trim().split('\n');
                          const heading = lines[0].trim();
                          const content = lines.slice(1).join(' ').trim();
                          return (
                            <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 8, padding: '8px 12px' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--purple)', marginBottom: 4 }}>{heading}</div>
                              <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{content || heading}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return <p style={{ margin: 0 }}>{issue.body.length > 400 ? issue.body.slice(0, 400) + '...' : issue.body}</p>;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
