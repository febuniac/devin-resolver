import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitPullRequest,
  Shield,
  CheckCircle,
  BarChart3,
  Settings,
  Zap,
  Github,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/client';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/issues', icon: GitPullRequest, label: 'Issue Triage' },
  { path: '/security', icon: Shield, label: 'Security' },
  { path: '/approvals', icon: CheckCircle, label: 'Approvals' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [repoCount, setRepoCount] = useState<number | null>(null);
  const [devinConnected, setDevinConnected] = useState<boolean | null>(null);

  useEffect(() => {
    api.getStatus()
      .then((data) => {
        setRepoCount(data.repos_connected);
        setDevinConnected(data.devin_connected);
      })
      .catch(() => {
        setRepoCount(null);
        setDevinConnected(null);
      });
  }, [location.pathname]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 sidebar-glass border-r border-zinc-800/50 dark:border-zinc-800/50 light:border-zinc-200 flex flex-col z-50">
      <div className="p-5 border-b border-zinc-800/50 dark:border-zinc-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">DevinResolver</h1>
              <p className="text-xs text-zinc-500">Powered by Devin AI</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-zinc-200 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
              }`}
            >
              <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-violet-600 dark:text-violet-400' : ''}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/50">
        <div className="sidebar-card rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {repoCount !== null ? `${repoCount} repo${repoCount !== 1 ? 's' : ''} connected` : 'Loading...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${devinConnected ? 'bg-emerald-400 animate-pulse' : devinConnected === false ? 'bg-zinc-500' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-500">
              {devinConnected === null ? 'Checking Devin...' : devinConnected ? 'Devin connected' : 'Devin not connected'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
