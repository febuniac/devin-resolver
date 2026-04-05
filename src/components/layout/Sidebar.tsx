import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitPullRequestArrow, Shield, CheckSquare, BarChart3, Radio, Settings, Sun, Moon, AlertCircle, Github, BookOpen, FileText } from 'lucide-react';
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
  { to: '/wiki', icon: BookOpen, label: 'Wiki' },
  { to: '/audit', icon: FileText, label: 'Audit Report' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/integrations', icon: Radio, label: 'Integrations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [status, setStatus] = useState<StatusData | null>(null);

  const refreshStatus = () => {
    api.getStatus().then((s: StatusData) => setStatus(s)).catch(() => {});
  };

  useEffect(() => {
    refreshStatus();
    // Refresh badges when issues change (sync, send to Devin, etc.)
    const handler = () => refreshStatus();
    window.addEventListener('issues-changed', handler);
    // Also refresh every 30 seconds
    const interval = setInterval(refreshStatus, 30000);
    return () => {
      window.removeEventListener('issues-changed', handler);
      clearInterval(interval);
    };
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
        marginTop: 'auto', padding: '14px 16px',
        borderTop: '1px solid var(--rule)',
      }}>
        {/* Devin status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: status?.devin_connected ? 'rgba(33,193,154,.08)' : 'var(--bg2)',
          }}>
            <img
              src="/brand/devin-icon.png"
              alt="Devin"
              style={{
                width: 18, height: 18, objectFit: 'contain',
                filter: status?.devin_connected ? 'none' : 'grayscale(100%) opacity(0.4)',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>Devin AI</div>
            <div style={{ fontSize: 10, color: status?.devin_connected ? 'var(--green)' : 'var(--dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status?.devin_connected ? 'var(--green)' : '#999', display: 'inline-block' }} />
              {status ? (status.devin_connected ? 'Connected' : 'Not connected') : '...'}
            </div>
          </div>
        </div>

        {/* GitHub status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: status && status.repos_connected > 0 ? 'rgba(33,193,154,.08)' : 'var(--bg2)',
          }}>
            <Github size={16} style={{ color: status && status.repos_connected > 0 ? 'var(--green)' : '#e53e3e' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>GitHub</div>
            <div style={{ fontSize: 10, color: status && status.repos_connected > 0 ? 'var(--green)' : '#e53e3e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: status && status.repos_connected > 0 ? 'var(--green)' : '#e53e3e', display: 'inline-block' }} />
              {status ? (status.repos_connected > 0 ? status.repos_connected + ' repo' + (status.repos_connected !== 1 ? 's' : '') : 'No repos') : '...'}
            </div>
          </div>
          {/* Theme toggle - aligned right with GitHub row */}
          <button onClick={toggleTheme}
            style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'var(--bg2)', border: '1px solid var(--rule)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--mid)',
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
