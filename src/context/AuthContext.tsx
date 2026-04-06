import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  role: string;
  token: string;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: '',
  role: '',
  token: '',
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    username: '',
    role: '',
    token: localStorage.getItem('bz-token') || '',
    loading: true,
  });

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('bz-token');
    if (!token) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }
    fetch(`${API_BASE}/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setState({ isAuthenticated: true, username: data.username, role: data.role, token, loading: false });
        } else {
          localStorage.removeItem('bz-token');
          setState({ isAuthenticated: false, username: '', role: '', token: '', loading: false });
        }
      })
      .catch(() => {
        // If backend is unreachable, keep token and assume valid (offline mode)
        setState({ isAuthenticated: true, username: 'admin', role: 'admin', token, loading: false });
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('bz-token', data.token);
    setState({ isAuthenticated: true, username: data.username, role: data.role, token: data.token, loading: false });
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem('bz-token');
    if (token) {
      fetch(`${API_BASE}/api/auth/logout?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
    }
    localStorage.removeItem('bz-token');
    setState({ isAuthenticated: false, username: '', role: '', token: '', loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
