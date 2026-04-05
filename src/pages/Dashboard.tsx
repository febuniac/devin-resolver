import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Plus, Loader2, Activity, GitPullRequest, CheckCircle, DollarSign, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DashboardMetrics {
  backlog_health: {
    open_issues: number;
    resolved_this_month: number;
    critical_cves: number;
    critical_resolved_week: number;
    avg_issue_age_days: number;
    burn_rate_week: number;
    resolved_week: number;
    opened_week: number;
  };
  devin_performance: {
    active_sessions: number;
    prs_awaiting_review: number;
    merge_rate_pct: number;
    cost_per_pr: number;
  };
  needs_attention: {
    awaiting_approval: { id: number; github_id: number; number: number; title: string; score: number; repo: string }[];
    awaiting_total: number;
    prs_ready: { id: number; session_id: string; pr_url: string; pr_number: number; status: string; title: string; hours_open: number }[];
    prs_ready_total: number;
  };
  this_month: {
    weeks: { label: string; count: number }[];
    total_merged: number;
    merge_rate_pct: number;
    cost_per_pr: number;
    avg_resolution_min: number;
    recently_resolved: { id: number; github_id: number; number: number; title: string; status: string; date: string }[];
    savings: {
      cost_saved: number;
      issues_resolved: number;
      hours_saved: number;
      avg_resolution_min: number;
      total_devin_cost: number;
    };
  };
}

function MetricInfo({ title, text }: { title: string; text: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5, cursor: 'help', verticalAlign: 'middle' }}
      onMouseEnter={() => {
        if (iconRef.current) {
          const rect = iconRef.current.getBoundingClientRect();
          setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 - 130 });
        }
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      <span ref={iconRef} style={{
        width: 16, height: 16, borderRadius: '50%',
        background: show ? 'var(--purple)' : 'transparent',
        border: '1.5px solid ' + (show ? 'var(--purple)' : '#b0b0b0'),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color: show ? '#fff' : '#999',
        fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1, transition: '.15s',
        textTransform: 'lowercase' as any
      }}>i</span>
      {show && createPortal(
        <span style={{
          position: 'fixed', top: pos.top, left: pos.left,
          transform: 'translateY(-100%)',
          background: '#0d1117', color: 'rgba(255,255,255,.85)',
          fontSize: 11, fontWeight: 400, lineHeight: 1.6,
          padding: '9px 13px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,.08)',
          minWidth: 220, maxWidth: 280, whiteSpace: 'normal',
          zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.2)', pointerEvents: 'none'
        }}>
          <strong style={{ color: '#fff', display: 'block', marginBottom: 4, fontSize: 11 }}>{title}</strong>
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}

function Sparkline({ heights, color }: { heights: number[]; color: string }) {
  const colorMap: Record<string, string> = {
    'var(--purple)': '57,105,202',
    'var(--red)': '229,62,62',
    'var(--green)': '33,193,154',
    'var(--blue)': '2,148,222',
  };
  const rgb = colorMap[color] || '57,105,202';

  return (
    <div style={{ marginTop: 10, height: 28, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
        {heights.map((h, i) => (
          <div key={i} style={{
            flex: 1,
            background: i === heights.length - 1 ? color : 'rgba(' + rgb + ',' + (0.1 + (i / heights.length) * 0.15) + ')',
            borderRadius: '2px 2px 0 0',
            height: h + '%',
            transition: 'height 0.6s cubic-bezier(.4,0,.2,1)'
          }} />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadMetrics(); }, []);

  const loadMetrics = async () => {
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
    } catch (e) {
      console.error('Dashboard metrics error:', e);
    } finally {
      setLoading(false);
    }
  };

  const syncGithub = async () => {
    setSyncing(true);
    try { await api.triageAll(); await loadMetrics(); }
    catch { /* ignore */ }
    finally { setSyncing(false); }
  };

  const approveIssue = async (id: number) => {
    try { await api.approveIssues([id]); await loadMetrics(); }
    catch { /* ignore */ }
  };

  const topbarEl = document.getElementById('topbar-actions');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={32} style={{ color: 'var(--blue)' }} className="animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--dim)' }}>
        Failed to load dashboard metrics. Check your backend connection.
      </div>
    );
  }

  const bh = metrics.backlog_health;
  const dp = metrics.devin_performance;
  const na = metrics.needs_attention;
  const tm = metrics.this_month;
  const maxWeek = Math.max(...tm.weeks.map(w => w.count), 1);
  const weekColors = ['var(--purple)', 'var(--purple)', 'var(--green)', 'var(--blue)'];

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={syncGithub} disabled={syncing}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--rule)', background: 'var(--bg2)', color: 'var(--mid)', display: 'flex', alignItems: 'center', gap: 5, transition: '.12s' }}>
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync GitHub
          </button>
          <button onClick={() => navigate('/issues')}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', border: 'none', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={12} /> Approve Batch
          </button>
        </div>, topbarEl
      )}

      {/* ZONE 1: BACKLOG HEALTH */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Backlog Health</div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>Current state of your repositories</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <HealthCard accent="var(--purple)" label="Open Issues"
          tooltip={{ title: 'Open Issues', text: 'Total unresolved GitHub issues across all connected repositories right now.' }}
          value={bh.open_issues} sub={'\u2193 ' + bh.resolved_this_month + ' resolved this month'} subColor="var(--green)"
          sparkHeights={[80, 95, 70, 55, 40, 28, Math.max(5, Math.min(100, Math.round((bh.open_issues / Math.max(bh.open_issues + bh.resolved_this_month, 1)) * 100)))]}
          sparkColor="var(--purple)" />

        <HealthCard accent="#e53e3e" label="Critical CVEs"
          tooltip={{ title: 'Critical CVEs', text: 'High or critical severity findings flagged by CodeQL, SonarQube, or Veracode and not yet resolved.' }}
          value={bh.critical_cves} valueColor="#e53e3e"
          sub={'\u2193 ' + bh.critical_resolved_week + ' resolved by Devin this week'} subColor="var(--green)"
          sparkHeights={[100, 85, 75, 65, 55, 45, Math.max(5, Math.min(100, Math.round((bh.critical_cves / Math.max(bh.critical_cves + bh.critical_resolved_week, 1)) * 100)))]}
          sparkColor="var(--red)" />

        <HealthCard accent="var(--green)" label="Avg Issue Age"
          tooltip={{ title: 'Average Issue Age', text: 'Mean number of days an issue has been open. Calculated across all unresolved issues at time of sync.' }}
          value={bh.avg_issue_age_days + 'd'} valueColor="var(--green)"
          sub={'\u2193 Trending down with BacklogZero'} subColor="var(--green)"
          sparkHeights={[100, 82, 64, 46, 32, 18, Math.max(5, Math.min(50, bh.avg_issue_age_days))]}
          sparkColor="var(--green)" />

        <HealthCard accent="var(--blue)" label="Backlog Burn Rate"
          tooltip={{ title: 'Backlog Burn Rate', text: 'Issues resolved this week minus new issues opened this week. Positive = backlog shrinking.' }}
          value={(bh.burn_rate_week >= 0 ? '+' : '') + bh.burn_rate_week + '/wk'} valueColor="var(--blue)"
          sub={(bh.burn_rate_week >= 0 ? '\u2191 More resolved than opened' : '\u2193 Backlog growing') + ' this week'}
          subColor={bh.burn_rate_week >= 0 ? 'var(--green)' : '#e53e3e'}
          sparkHeights={[12, 22, 36, 48, 56, 64, 64]}
          sparkColor="var(--blue)" />
      </div>

      {/* ZONE 2: DEVIN PERFORMANCE */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Devin Performance</div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>What the agent is doing right now</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <PerfCard icon={<Activity size={16} color="#21C19A" />} iconBg="rgba(33,193,154,.1)"
          value={dp.active_sessions} valueColor="var(--green)"
          label="Active sessions running now"
          tooltip={{ title: 'Active Sessions', text: 'Devin sessions currently executing in parallel \u2014 writing code, running tests, or opening PRs.' }}
          footnote={dp.active_sessions > 0 ? '\u25cf LIVE \u2014 parallel execution' : '\u25cb No active sessions'}
          footnoteColor="var(--green)" />

        <PerfCard icon={<GitPullRequest size={16} color="#d97706" />} iconBg="rgba(217,119,6,.1)"
          value={dp.prs_awaiting_review} valueColor="#d97706"
          label="PRs awaiting your review"
          tooltip={{ title: 'PRs Awaiting Review', text: 'Pull requests opened by Devin that have not yet been reviewed or merged by your team.' }}
          footnote={dp.prs_awaiting_review > 0 ? '\u2191 ' + dp.prs_awaiting_review + ' ready to review' : 'All caught up'}
          footnoteColor="#d97706" />

        <PerfCard icon={<CheckCircle size={16} color="#3969CA" />} iconBg="rgba(57,105,202,.1)"
          value={dp.merge_rate_pct + '%'} valueColor="var(--purple)"
          label="PR merge rate this month"
          tooltip={{ title: 'PR Merge Rate', text: 'Percentage of Devin-opened PRs that were merged without being closed or rejected. Baseline: 67%.' }}
          footnote={'\u2191 FROM 67% BASELINE'}
          footnoteColor="var(--purple)" />

        <PerfCard icon={<DollarSign size={16} color="#0294DE" />} iconBg="rgba(2,148,222,.1)"
          value={'~$' + dp.cost_per_pr} valueColor="var(--blue)"
          label="Cost per merged PR"
          tooltip={{ title: 'Cost per Merged PR', text: 'Total Devin ACU cost this month divided by number of PRs merged. One ACU \u2248 $0.09.' }}
          footnote={'VS $150\u2013300 ENGINEER HOUR'}
          footnoteColor="var(--blue)" />
      </div>

      {/* ZONE 3: NEEDS ATTENTION */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Needs Your Attention</div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>Action required from your team</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {/* Awaiting Approval */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Clock size={13} /> Awaiting Approval
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(217,119,6,.1)', color: '#d97706' }}>
              {na.awaiting_total} issues
            </span>
          </div>
          {na.awaiting_approval.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rule)', transition: '.1s', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#d97706', animation: 'pulse 1.4s infinite' }} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--purple)', flexShrink: 0, width: 90 }}>#{item.github_id || item.number}</div>
              <div style={{ fontSize: 12, color: 'var(--ink)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{item.title}</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', flexShrink: 0, marginRight: 8 }}>Score {item.score}</div>
              <button onClick={() => approveIssue(item.id)} style={{
                fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 14, border: 'none',
                background: 'var(--green)', color: '#fff', cursor: 'pointer', transition: '.12s', flexShrink: 0
              }}>Approve</button>
            </div>
          ))}
          {na.awaiting_total > 3 && (
            <div style={{ padding: '10px 16px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>+ {na.awaiting_total - 3} more in queue</div>
              <span onClick={() => navigate('/issues')} style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple)', cursor: 'pointer' }}>{'View all \u2192'}</span>
            </div>
          )}
          {na.awaiting_approval.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--dim)' }}>No issues awaiting approval</div>
          )}
        </div>

        {/* PRs Ready to Merge */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <GitPullRequest size={13} /> PRs Ready to Merge
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(57,105,202,.1)', color: 'var(--purple)' }}>
              {na.prs_ready_total} PRs
            </span>
          </div>
          {na.prs_ready.map(pr => (
            <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--rule)', transition: '.1s', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: pr.hours_open > 24 ? '#e53e3e' : 'var(--purple)', animation: pr.hours_open > 24 ? 'pulse 1.4s infinite' : 'none' }} />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--purple)', flexShrink: 0, width: 90 }}>PR #{pr.pr_number || '\u2014'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{pr.title}</div>
              <div style={{ fontSize: 10, flexShrink: 0, marginRight: 8, color: pr.hours_open > 24 ? '#d97706' : 'var(--green)', fontWeight: 600 }}>
                {pr.hours_open > 24 ? 'Open ' + pr.hours_open + 'h' : '\u2713'}
              </div>
              <button onClick={() => { if (pr.pr_url) window.open(pr.pr_url, '_blank'); else navigate('/approvals'); }} style={{
                fontSize: 10, fontWeight: 700, padding: '4px 11px', borderRadius: 14,
                border: '1px solid var(--rule)', background: 'none', color: 'var(--mid)',
                cursor: 'pointer', transition: '.12s', flexShrink: 0
              }}>{'Review \u2192'}</button>
            </div>
          ))}
          {na.prs_ready.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--dim)' }}>No PRs awaiting review</div>
          )}
        </div>
      </div>

      {/* ZONE 4: THIS MONTH */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>This Month</div>
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>
          {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} {'\u00b7'} {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} days
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
        {/* PRs merged per week */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>PRs merged per week</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--purple)', letterSpacing: '-.03em', fontFamily: 'var(--mono)' }}>{tm.total_merged}</div>
          </div>
          <div style={{ padding: 16 }}>
            {tm.weeks.map((w, i) => (
              <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < tm.weeks.length - 1 ? 9 : 0 }}>
                <span style={{ fontSize: 11, color: 'var(--mid)', width: 24, textAlign: 'right' as const, fontFamily: 'var(--mono)', flexShrink: 0 }}>{w.label}</span>
                <div style={{ flex: 1, height: 7, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: weekColors[i] || 'var(--purple)', width: (w.count / maxWeek) * 100 + '%', transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--mono)', width: 20, flexShrink: 0 }}>{w.count}</span>
              </div>
            ))}
            <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid var(--rule)', display: 'flex', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Merge rate <span style={{ fontWeight: 700, color: 'var(--green)' }}>{tm.merge_rate_pct}%</span></div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Cost/PR <span style={{ fontWeight: 700, color: 'var(--purple)' }}>~${tm.cost_per_pr}</span></div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>Avg time <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{tm.avg_resolution_min}min</span></div>
            </div>
          </div>
        </div>

        {/* Recently resolved */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Recently resolved</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>Last 7 days</div>
          </div>
          <div style={{ padding: '10px 16px' }}>
            {tm.recently_resolved.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, color: 'var(--purple)', width: 80, flexShrink: 0 }}>#{item.github_id || item.number}</div>
                <div style={{ fontSize: 11, color: 'var(--ink)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, flexShrink: 0,
                  ...(item.status === 'Merged'
                    ? { background: 'rgba(33,193,154,.1)', color: '#0d9e7e', border: '1px solid rgba(33,193,154,.2)' }
                    : { background: 'rgba(57,105,202,.1)', color: 'var(--purple)', border: '1px solid rgba(57,105,202,.2)' })
                }}>{item.status}</span>
                <div style={{ fontSize: 10, color: 'var(--dim)', width: 44, textAlign: 'right' as const, flexShrink: 0, fontFamily: 'var(--mono)' }}>{item.date}</div>
              </div>
            ))}
            {tm.recently_resolved.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--dim)' }}>No issues resolved recently</div>
            )}
          </div>
        </div>

        {/* Time and cost saved */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{'Time & cost saved'}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>vs. manual engineering</div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-.04em', color: 'var(--green)', lineHeight: 1, marginBottom: 4 }}>
                ~${tm.savings.cost_saved >= 1000 ? Math.round(tm.savings.cost_saved / 1000) + 'k' : tm.savings.cost_saved}
              </div>
              <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 16 }}>Estimated engineering cost saved this month</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <SavingsBox value={tm.savings.issues_resolved} label="Issues resolved by Devin" color="var(--green)" />
              <SavingsBox value={'~' + tm.savings.hours_saved + 'h'} label="Engineer hours freed up" color="var(--purple)" />
              <SavingsBox value={tm.savings.avg_resolution_min + 'min'} label="Avg resolution time" color="var(--blue)" />
              <SavingsBox value={'$' + tm.savings.total_devin_cost} label="Total Devin cost this month" color="#d97706" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function HealthCard({ accent, label, tooltip, value, valueColor, sub, subColor, sparkHeights, sparkColor }: {
  accent: string; label: string; tooltip: { title: string; text: string };
  value: string | number; valueColor?: string; sub: string; subColor: string;
  sparkHeights: number[]; sparkColor: string;
}) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '16px 18px', position: 'relative', overflow: 'visible' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '11px 11px 0 0', background: accent }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: 'var(--dim)', marginBottom: 6 }}>
        {label}
        <MetricInfo title={tooltip.title} text={tooltip.text} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1, marginBottom: 5, color: valueColor || accent }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: subColor }}>{sub}</div>
      <Sparkline heights={sparkHeights} color={sparkColor} />
    </div>
  );
}

function PerfCard({ icon, iconBg, value, valueColor, label, tooltip, footnote, footnoteColor }: {
  icon: React.ReactNode; iconBg: string;
  value: string | number; valueColor: string;
  label: string; tooltip: { title: string; text: string };
  footnote: string; footnoteColor: string;
}) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 11, padding: '14px 16px' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, background: iconBg }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, marginBottom: 3, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 6, lineHeight: 1.35 }}>
        {label}
        <MetricInfo title={tooltip.title} text={tooltip.text} />
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', color: footnoteColor }}>{footnote}</div>
    </div>
  );
}

function SavingsBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 7, padding: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', marginBottom: 2, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--dim)', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
