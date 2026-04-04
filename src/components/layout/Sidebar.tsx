import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitPullRequestArrow, Shield, CheckSquare, BarChart3, Radio, Settings, Sun, Moon, AlertCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useState, useEffect } from 'react';
import api from '../../api/client';

interface StatusData {
  repos_connected: number;
  devin_connected: boolean;
  issues_count: number;
  security_count: number;
  review_count: number;
}

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/issues', icon: GitPullRequestArrow, label: 'Issue Triage', badgeKey: 'issues' as const },
  { to: '/security', icon: Shield, label: 'Security', badgeKey: 'security' as const, badgeColor: 'red' },
  { to: '/approvals', icon: CheckSquare, label: 'Review Work', badgeKey: 'review' as const, badgeColor: 'green' },
];

const insightNav = [
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/integrations', icon: Radio, label: 'Integrations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    api.getStatus().then((s: StatusData) => setStatus(s)).catch(() => {});
  }, []);

  const badges: Record<string, number> = {
    issues: status?.issues_count ?? 0,
    security: status?.security_count ?? 0,
    review: status?.review_count ?? 0,
  };

  const needsSetup = status !== null && status.repos_connected === 0;

  return (
    <aside
      style={{
        position: 'fixed', left: 0, top: 0, bottom: 0,
        width: 'var(--sidebar-w)',
        background: 'var(--white)',
        borderRight: '1px solid var(--rule)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--rule)' }}>
        <img
          src={theme === 'dark' ? '/brand/backlogzero-dark.png' : '/brand/backlogzero-light.png'}
          alt="Backlog Zero"
          style={{ height: 42, width: 'auto', display: 'block' }}
        />
      </div>

      {/* Onboarding prompt */}
      {needsSetup && (
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          <div style={{
            margin: '12px 12px 0', padding: '10px 14px', borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(57,105,202,.08), rgba(33,193,154,.06))',
            border: '1px solid rgba(57,105,202,.15)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <AlertCircle size={16} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>Connect a repository</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.4, marginTop: 2 }}>Add a repo in Settings to start triaging issues.</div>
            </div>
          </div>
        </NavLink>
      )}

      {/* Main nav */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)', padding: '20px 20px 8px' }}>
        Main
      </div>

      {mainNav.map(item => {
        const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
        return (
          <NavLink key={item.to} to={item.to}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px', margin: '1px 8px', borderRadius: 8,
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--purple)' : 'var(--mid)',
              background: isActive ? 'linear-gradient(135deg, rgba(57,105,202,.1), rgba(33,193,154,.08))' : 'transparent',
              textDecoration: 'none', transition: '0.15s',
            }}
          >
            <item.icon size={18} />
            {item.label}
            {item.badgeKey && badges[item.badgeKey] > 0 && (
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                padding: '2px 7px', borderRadius: 10,
                background: item.badgeColor === 'red' ? '#e53e3e' : item.badgeColor === 'green' ? 'var(--green)' : 'var(--purple)',
                color: '#fff',
              }}>
                {badges[item.badgeKey]}
              </span>
            )}
          </NavLink>
        );
      })}

      {/* Insights section */}
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)', padding: '20px 20px 8px' }}>
        Insights
      </div>

      {insightNav.map(item => {
        const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
        return (
          <NavLink key={item.to} to={item.to}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 16px', margin: '1px 8px', borderRadius: 8,
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--purple)' : 'var(--mid)',
              background: isActive ? 'linear-gradient(135deg, rgba(57,105,202,.1), rgba(33,193,154,.08))' : 'transparent',
              textDecoration: 'none', transition: '0.15s',
            }}
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        );
      })}

      {/* Footer */}
      <div style={{
        marginTop: 'auto', padding: '16px 20px',
        borderTop: '1px solid var(--rule)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--purple), var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {status && status.repos_connected > 0 ? 'U' : 'BZ'}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {status ? (status.repos_connected > 0 ? status.repos_connected + ' repo' + (status.repos_connected !== 1 ? 's' : '') : 'Not connected') : '...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {status ? (status.devin_connected ? 'Devin active' : 'Setup required') : '...'}
          </div>
        </div>
        <button onClick={toggleTheme}
          style={{
            marginLeft: 'auto', width: 28, height: 28, borderRadius: '50%',
            background: 'var(--bg2)', border: '1px solid var(--rule)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--mid)',
          }}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
      </div>
    </aside>
  );
}
