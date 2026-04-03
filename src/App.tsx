import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import IssueTriage from './pages/IssueTriage';
import Security from './pages/Security';
import Approvals from './pages/Approvals';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function App() {
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
