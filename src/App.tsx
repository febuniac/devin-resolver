import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import IssueTriage from './pages/IssueTriage';
import Security from './pages/Security';
import Approvals from './pages/Approvals';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Integrations from './pages/Integrations';
import Wiki from './pages/Wiki';
import AuditReport from './pages/AuditReport';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <div style={{ color: 'var(--dim)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/issues" element={<IssueTriage />} />
          <Route path="/security" element={<Security />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/audit" element={<AuditReport />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
