import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useTheme } from '../../context/ThemeContext';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/issues': 'Issue Triage',
  '/security': 'Security',
  '/approvals': 'Review Work',
  '/analytics': 'Analytics',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
};

export default function Layout() {
  const { theme } = useTheme();
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Dashboard';

  return (
    <div className={theme} style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-w)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div
          style={{
            background: 'var(--white)',
            borderBottom: '1px solid var(--rule)',
            padding: '0 32px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
          <div id="topbar-actions" />
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px', flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
