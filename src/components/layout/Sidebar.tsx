import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, GitPullRequestArrow, Shield, CheckSquare, BarChart3, Radio, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useState, useEffect } from 'react';
import api from '../../api/client';

const mainNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/issues', icon: GitPullRequestArrow, label: 'Issue Triage', badgeKey: 'issues' },
  { to: '/security', icon: Shield, label: 'Security', badgeKey: 'security', badgeColor: 'red' },
  { to: '/approvals', icon: CheckSquare, label: 'Review Work', badgeKey: 'review', badgeColor: 'green' },
];

const insightNav = [
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/integrations', icon: Radio, label: 'Integrations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [repoCount, setRepoCount] = useState(0);
  const [devinConnected, setDevinConnected] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: Record<string, unknown>) => {
      if (s.github_token) setRepoCount((s.repos as string[] || []).length || 0);
      if (s.devin_api_token) setDevinConnected(true);
    }).catch(() => {});
  }, []);

  const badges: Record<string, number> = {
    issues: 47,
    security: 12,
    review: 8,
  };

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
          {repoCount > 0 ? 'U' : 'BZ'}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            {repoCount > 0 ? repoCount + ' repo' + (repoCount !== 1 ? 's' : '') : 'Not connected'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {devinConnected ? 'Devin active' : 'Setup required'}
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
