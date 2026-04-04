import { createPortal } from 'react-dom';

export default function Analytics() {
  const topbarEl = document.getElementById('topbar-actions');

  const stats = [
    { label: 'Issues Resolved', value: '312', color: 'var(--purple)', delta: '+45% vs last quarter' },
    { label: 'Engineer Hours Saved', value: '1,248', color: 'var(--green)', delta: '~$187K value' },
    { label: 'Avg Resolution Time', value: '47m', color: 'var(--blue)', delta: 'Down from 4.2h manual' },
    { label: 'PR Merge Rate', value: '98%', color: 'var(--green)', delta: 'Up from 67% baseline' },
  ];

  const monthly = [
    { month: 'Jan', issues: 42, prs: 38 },
    { month: 'Feb', issues: 56, prs: 51 },
    { month: 'Mar', issues: 73, prs: 68 },
    { month: 'Apr', issues: 87, prs: 82 },
  ];

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(<div />, topbarEl)}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: s.color }} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: 'var(--green)' }}>{'\u2191'} {s.delta}</div>
          </div>
        ))}
      </div>

      {/* Monthly Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Monthly Trend</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 18 }}>Issues resolved & PRs merged</div>
          {monthly.map(m => (
            <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--mid)', width: 32, textAlign: 'right' }}>{m.month}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (m.issues/100*100)+'%', borderRadius: 3, background: 'var(--purple)', transition: 'width 0.8s' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--purple)', width: 24 }}>{m.issues}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (m.prs/100*100)+'%', borderRadius: 3, background: 'var(--green)', transition: 'width 0.8s' }} />
                  </div>
                  <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', width: 24 }}>{m.prs}</span>
                </div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--rule)', display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--purple)' }} /> Issues resolved
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)' }} /> PRs merged
            </div>
          </div>
        </div>

        {/* Cost Savings */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Cost Savings</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 18 }}>Estimated value delivered</div>
          {[
            { label: 'Engineer hours saved', value: '1,248 hrs', sub: '@$150/hr = $187,200', color: 'var(--green)' },
            { label: 'Devin API costs', value: '$4,056', sub: '312 sessions x ~$13 avg', color: 'var(--purple)' },
            { label: 'Net savings', value: '$183,144', sub: '46x ROI', color: 'var(--green)' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: i < 2 ? '1px solid var(--rule)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--mid)' }}>{item.label}</span>
                <span className="font-mono" style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolution by Category */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Resolution by Category</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 18 }}>Breakdown of issues resolved by type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          {[
            { label: 'Bugs', value: 142, pct: 46, color: '#e53e3e' },
            { label: 'Security', value: 67, pct: 22, color: 'var(--purple)' },
            { label: 'Features', value: 48, pct: 15, color: 'var(--blue)' },
            { label: 'Enhancements', value: 35, pct: 11, color: '#d97706' },
            { label: 'Performance', value: 20, pct: 6, color: 'var(--green)' },
          ].map(c => (
            <div key={c.label} style={{ textAlign: 'center' }}>
              <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: c.color, marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{c.label}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{c.pct}%</div>
              <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: c.pct+'%', borderRadius: 2, background: c.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
