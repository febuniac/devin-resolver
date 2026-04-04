import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, CheckCircle, XCircle, Loader2, Eye, EyeOff, Plus, Trash2, HelpCircle } from 'lucide-react';
import api from '../api/client';

export default function Settings() {
  const [githubToken, setGithubToken] = useState('');
  const [devinToken, setDevinToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [repos, setRepos] = useState<string[]>([]);
  const [newRepo, setNewRepo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGH, setShowGH] = useState(false);
  const [showDevin, setShowDevin] = useState(false);
  const [ghValid, setGhValid] = useState<boolean | null>(null);
  const [devinValid, setDevinValid] = useState<boolean | null>(null);
  const [showGHGuide, setShowGHGuide] = useState(false);
  const [showDevinGuide, setShowDevinGuide] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: Record<string, unknown>) => {
      if (s.github_token) setGithubToken(s.github_token as string);
      if (s.devin_api_token) setDevinToken(s.devin_api_token as string);
      if (s.devin_org_id) setOrgId(s.devin_org_id as string);
      if (s.slack_webhook) setSlackWebhook(s.slack_webhook as string);
      if (s.repos) setRepos(s.repos as string[]);
      if (s.github_token) setGhValid(true);
      if (s.devin_api_token) setDevinValid(true);
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ github_token: githubToken, devin_api_token: devinToken, devin_org_id: orgId, slack_webhook: slackWebhook, repos });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (githubToken) {
        try { await api.validateGithub(); setGhValid(true); } catch { setGhValid(false); }
      }
      if (devinToken && orgId) {
        try { await api.validateDevin(); setDevinValid(true); } catch { setDevinValid(false); }
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const addRepo = () => {
    if (newRepo.trim() && !repos.includes(newRepo.trim())) {
      setRepos([...repos, newRepo.trim()]);
      setNewRepo('');
    }
  };

  const removeRepo = (r: string) => setRepos(repos.filter(x => x !== r));
  const topbarEl = document.getElementById('topbar-actions');

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'var(--mono)' };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 };

  return (
    <div className="animate-fade-in">
      {topbarEl && createPortal(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={saveSettings} disabled={saving}
            style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7, cursor: 'pointer', border: 'none', background: saved ? 'var(--green)' : 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, transition: '0.2s' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>, topbarEl
      )}

      <div style={{ maxWidth: 640 }}>
        {/* GitHub Token */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>
            GitHub Token
            {ghValid === true && <CheckCircle size={14} style={{ color: 'var(--green)' }} />}
            {ghValid === false && <XCircle size={14} style={{ color: '#e53e3e' }} />}
            <button onClick={() => setShowGHGuide(!showGHGuide)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HelpCircle size={13} /> How to get this
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input type={showGH ? 'text' : 'password'} value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_..." style={inputStyle} />
            <button onClick={() => setShowGH(!showGH)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>
              {showGH ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {showGHGuide && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', fontSize: 12, color: 'var(--mid)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink)' }}>How to create a GitHub Personal Access Token:</strong><br />
              1. Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>github.com/settings/tokens</a><br />
              2. Click <strong>{'\u201c'}Generate new token (classic){'\u201d'}</strong><br />
              3. Select scopes: <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>repo</code>, <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>security_events</code><br />
              4. Click <strong>{'\u201c'}Generate token{'\u201d'}</strong> and copy it
            </div>
          )}
        </div>

        {/* Devin API Token */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>
            Devin API Token
            {devinValid === true && <CheckCircle size={14} style={{ color: 'var(--green)' }} />}
            {devinValid === false && <XCircle size={14} style={{ color: '#e53e3e' }} />}
            <button onClick={() => setShowDevinGuide(!showDevinGuide)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HelpCircle size={13} /> How to get this
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input type={showDevin ? 'text' : 'password'} value={devinToken} onChange={e => setDevinToken(e.target.value)} placeholder="cog_..." style={inputStyle} />
            <button onClick={() => setShowDevin(!showDevin)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>
              {showDevin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ ...labelStyle, marginTop: 4 }}>Organization ID</div>
            <input type="text" value={orgId} onChange={e => setOrgId(e.target.value)} placeholder="org-..." style={inputStyle} />
          </div>
          {showDevinGuide && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', fontSize: 12, color: 'var(--mid)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink)' }}>Service User Key (recommended):</strong><br />
              1. Go to <a href="https://app.devin.ai/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>app.devin.ai/settings</a><br />
              2. Click <strong>{'\u201c'}Service users{'\u201d'}</strong> in the sidebar<br />
              3. Create or select a service user<br />
              4. Copy the <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>cog_</code> key<br />
              5. The <strong>Organization ID</strong> is shown on the same page (starts with <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>org-</code>)
            </div>
          )}
        </div>

        {/* Slack Webhook */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>Slack Webhook URL <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>(optional)</span></div>
          <input type="text" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." style={inputStyle} />
        </div>

        {/* Repos */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={labelStyle}>Connected Repositories</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="text" value={newRepo} onChange={e => setNewRepo(e.target.value)} placeholder="owner/repo" onKeyDown={e => e.key === 'Enter' && addRepo()}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addRepo}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--purple)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Plus size={14} /> Add
            </button>
          </div>
          {repos.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>No repositories connected yet.</div>
          ) : repos.map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--rule)', marginBottom: 6 }}>
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{r}</span>
              <button onClick={() => removeRepo(r)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
