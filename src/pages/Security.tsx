import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Loader2, Shield, AlertTriangle } from 'lucide-react';
import api from '../api/client';

interface Finding {
  id: number;
  title: string;
  severity: string;
  status: string;
  repo: string;
  confidence: number;
  category: string;
}

export default function Security() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFindings(); }, []);

  const loadFindings = async () => {
    try {
      const data = await api.listFindings() as Finding[];
      setFindings(data);
    } catch {
      // Fallback: try issues with security category
      try {
        const issues = await api.listIssues() as Finding[];
        setFindings(issues.filter(i => i.category === 'security' || i.severity === 'critical'));
      } catch { /* ignore */ }
    }
    finally { setLoading(false); }
  };

  const approveFinding = async (id: number) => {
    try {
      await api.approveFindings([id]);
      await loadFindings();
    } catch {
      // Fallback to issue approve
      try { await api.approveIssues([id]); await loadFindings(); } catch { /* ignore */ }
    }
  };

  const topbarEl = document.getElementById('topbar-actions');
  const critical = findings.filter(i => i.severity === 'critical').length;
  const high = findings.filter(i => i.severity === 'high').length;
  const resolved = findings.filter(i => i.status === 'resolved' || i.status === 'fixed').length;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}><Loader2 size={24} style={{ color: 'var(--blue)' }} className="animate-spin" /></div>;

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={loadFindings} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--rule)', background: 'var(--bg2)', color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>, topbarEl
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Vulnerabilities', value: findings.length, color: 'var(--purple)' },
          { label: 'Critical', value: critical, color: '#e53e3e' },
          { label: 'High Severity', value: high, color: '#d97706' },
          { label: 'Resolved', value: resolved, color: 'var(--green)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: s.color }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Security table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Security Vulnerabilities</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>CodeQL & dependency scan findings</div>
        </div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px 80px', padding: '10px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--rule)' }}>
          {['Vulnerability', 'Severity', 'Score', 'Status', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--dim)' }}>{h}</div>
          ))}
        </div>
        {findings.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
            <Shield size={24} style={{ color: 'var(--green)', display: 'block', margin: '0 auto 8px' }} />
            No security vulnerabilities found. Looking good!
          </div>
        ) : findings.map(f => (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 90px 80px', padding: '12px 16px', borderBottom: '1px solid var(--rule)', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6 }}>
                {f.severity === 'critical' && <AlertTriangle size={14} style={{ color: '#e53e3e' }} />}
                {f.title}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 3 }}>{f.repo}</div>
            </div>
            <div>
              <span className={`chip ${f.severity === 'critical' ? 'chip-red' : f.severity === 'high' ? 'chip-red' : 'chip-amber'}`}>
                {f.severity}
              </span>
            </div>
            <div><span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: (f.confidence || 0) >= 75 ? 'var(--green)' : '#d97706' }}>{f.confidence || 0}</span></div>
            <div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                {(f.status === 'resolved' || f.status === 'fixed') ? <><span className="dot dot-green" /><span style={{ color: 'var(--green)' }}>Fixed</span></> :
                 f.status === 'in_progress' ? <><span className="dot dot-blue" /><span style={{ color: 'var(--blue)' }}>Fixing</span></> :
                 f.status === 'approved' ? <><span className="dot dot-amber" /><span style={{ color: '#d97706' }}>Approved</span></> :
                 <><span className="dot dot-dim" /><span style={{ color: 'var(--dim)' }}>Open</span></>}
              </span>
            </div>
            <div>
              {(f.status === 'triaged' || f.status === 'open') ? (
                <button onClick={() => approveFinding(f.id)} style={{ fontSize: 10, fontWeight: 700, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff' }}>Fix {'\u2192'}</button>
              ) : <span style={{ color: 'var(--dim)' }}>{'\u2014'}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
