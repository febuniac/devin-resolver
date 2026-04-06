import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme === 'dark'
        ? 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)'
        : 'linear-gradient(135deg, #f0f2f5 0%, #e8edf5 50%, #f0f2f5 100%)',
    }}>
      <div style={{
        width: 380,
        padding: 40,
        borderRadius: 16,
        background: 'var(--white)',
        border: '1px solid var(--rule)',
        boxShadow: theme === 'dark'
          ? '0 8px 32px rgba(0,0,0,.4)'
          : '0 8px 32px rgba(0,0,0,.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src={theme === 'dark' ? '/brand/backlogzero-dark.png' : '/brand/backlogzero-light.png'}
            alt="Backlog Zero"
            style={{ height: 48, width: 'auto', display: 'inline-block' }}
          />
          <p style={{
            fontSize: 13,
            color: 'var(--dim)',
            marginTop: 8,
          }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error message */}
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(229,62,62,.08)',
              border: '1px solid rgba(229,62,62,.2)',
              color: '#e53e3e',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
              marginBottom: 6,
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--rule)',
                background: 'var(--bg2)',
                color: 'var(--ink)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--purple)'}
              onBlur={e => e.target.style.borderColor = 'var(--rule)'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
              marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--rule)',
                background: 'var(--bg2)',
                color: 'var(--ink)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--purple)'}
              onBlur={e => e.target.style.borderColor = 'var(--rule)'}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%',
              padding: '11px 0',
              borderRadius: 8,
              border: 'none',
              background: loading || !username || !password
                ? 'var(--dim)'
                : 'linear-gradient(135deg, #3969ca, #21c19a)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !username || !password ? 'not-allowed' : 'pointer',
              transition: '0.15s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--dim)',
          marginTop: 24,
        }}>
          Powered by Devin AI
        </p>
      </div>
    </div>
  );
}
