import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useTheme } from '../../context/ThemeContext';

export default function Layout() {
  const { theme } = useTheme();
  return (
    <div className={`flex min-h-screen transition-colors duration-300 ${theme === 'light' ? 'bg-gray-50 text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
      <Sidebar />
      <main className="flex-1 ml-64 p-4">
        <Outlet />
      </main>
    </div>
  );
}
