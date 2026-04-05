import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, CheckCircle, Loader2, Plus, Trash2, RefreshCw, GitBranch, AlertCircle, Zap } from 'lucide-react';
import api from '../api/client';

interface Repo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  language: string;
  default_branch: string;
  open_issues_count: number;
  connected_at: string;
  last_sync: string | null;
  sync_enabled: boolean;
}

export default function Settings() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [newRepo, setNewRepo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveConfidence, setAutoApproveConfidence] = useState(90);
  const [autoApproveMaxSeverity, setAutoApproveMaxSeverity] = useState('medium');

  useEffect(() => { loadRepos(); loadAutoApproveSettings(); }, []);

  const loadAutoApproveSettings = async () => {
    try {
      const s = await api.getSettings() as any;
      setAutoApprove(!!s.auto_approve_enabled);
      setAutoApproveConfidence(s.auto_approve_confidence ?? 90);
      setAutoApproveMaxSeverity(s.auto_approve_max_severity || 'medium');
    } catch { /* ignore */ }
  };

  const loadRepos = async () => {
    try {
      const data = await api.listRepos();
      setRepos(data as Repo[]);
    } catch { /* ignore */ }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        auto_approve_enabled: autoApprove,
        auto_approve_confidence: autoApproveConfidence,
        auto_approve_max_severity: autoApproveMaxSeverity,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const addRepo = async () => {
    const val = newRepo.trim();
    if (!val || !val.includes('/')) {
      setError('Please enter a valid owner/repo format');
      return;
    }
    const [owner, name] = val.split('/');
    if (!owner || !name) {
      setError('Please enter a valid owner/repo format');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await api.connectRepo(owner, name);
      setNewRepo('');
      await loadRepos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect repository');
    } finally { setAdding(false); }
  };

  const removeRepo = async (repo: Repo) => {
    try {
      await api.disconnectRepo(repo.id);
      await loadRepos();
    } catch { /* ignore */ }
  };

  const syncRepo = async (repo: Repo) => {
    setSyncing(repo.id);
    try {
      await api.syncRepo(repo.id);
      await loadRepos();
    } catch { /* ignore */ }
    finally { setSyncing(null); }
  };

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
        {/* Add repo */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>Add Repository</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.5 }}>
            Enter a repository in <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>owner/repo</code> format. Make sure your GitHub token (in Integrations) has access to this repo.
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, background: 'rgba(229,62,62,.1)', border: '1px solid rgba(229,62,62,.2)', color: '#c53030', fontSize: 12, marginBottom: 10 }}>
              <AlertCircle size={14} /> {error}
              <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c53030', cursor: 'pointer', fontSize: 11 }}>dismiss</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={newRepo} onChange={e => setNewRepo(e.target.value)} placeholder="owner/repo" onKeyDown={e => e.key === 'Enter' && addRepo()}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addRepo} disabled={adding}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--purple)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', opacity: adding ? 0.7 : 1 }}>
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Auto-approve mode */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}><Zap size={14} style={{ color: 'var(--purple)' }} /> Auto-Approve Mode</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 14, lineHeight: 1.6 }}>
            When enabled, PRs will be automatically merged <strong>only after Devin Review passes</strong> (no critical issues found) and the confidence threshold is met. This gives you the speed of automation with an AI quality gate.
          </div>

          {/* Devin Review explainer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(57,105,202,0.06)', border: '1px solid rgba(57,105,202,0.12)', marginBottom: 12 }}>
            <img src="/brand/devin-logo.png" alt="Devin Review" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>Powered by Devin Review</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 1, lineHeight: 1.5 }}>
                Every PR is automatically reviewed by Devin Review for code quality, security vulnerabilities, and potential bugs before auto-approve can trigger.
              </div>
            </div>
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>Enable Auto-Approve</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>PRs auto-merge only when Devin Review passes + confidence threshold is met</div>
            </div>
            <button onClick={() => setAutoApprove(!autoApprove)}
              style={{ width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', transition: '0.2s', background: autoApprove ? 'var(--green)' : 'var(--rule)' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: autoApprove ? 21 : 3, transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.15)' }} />
            </button>
          </div>

          {autoApprove && (
            <div style={{ display: 'grid', gap: 10 }}>
              {/* Confidence threshold */}
              <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Minimum Confidence Threshold</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={50} max={100} value={autoApproveConfidence} onChange={e => setAutoApproveConfidence(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--purple)', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="number" min={50} max={100} value={autoApproveConfidence} onChange={e => setAutoApproveConfidence(Math.min(100, Math.max(50, Number(e.target.value))))}
                      style={{ width: 48, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--rule)', background: 'var(--bg)', fontSize: 13, fontWeight: 700, color: 'var(--green)', textAlign: 'center', fontFamily: 'var(--mono)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>%</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>PRs with AI confidence ≥ {autoApproveConfidence}% will be auto-merged</div>
              </div>

              {/* Max severity */}
              <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Maximum Severity to Auto-Approve</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['low', 'medium', 'high', 'critical'].map(sev => (
                    <button key={sev} onClick={() => setAutoApproveMaxSeverity(sev)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: autoApproveMaxSeverity === sev ? '2px solid var(--purple)' : '1px solid var(--rule)', background: autoApproveMaxSeverity === sev ? 'rgba(57,105,202,.08)' : 'var(--white)', cursor: 'pointer', fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: autoApproveMaxSeverity === sev ? 'var(--purple)' : 'var(--mid)', transition: '0.15s' }}>
                      {sev}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>Issues with severity above "{autoApproveMaxSeverity}" will require manual approval</div>
              </div>
            </div>
          )}
        </div>

        {/* Connected repos */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={labelStyle}>Connected Repositories</div>
          {repos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>
              <GitBranch size={28} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div>No repositories connected yet.</div>
              <div style={{ marginTop: 4 }}>Add a repository above to start triaging issues.</div>
            </div>
          ) : repos.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', marginBottom: 8, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GitBranch size={15} style={{ color: 'var(--purple)', flexShrink: 0 }} />
                <div>
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{r.full_name}</span>
                  <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                    {r.language && <span>{r.language} · </span>}
                    {r.open_issues_count} issues
                    {r.last_sync && <span> · Last sync: {new Date(r.last_sync).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => syncRepo(r)} disabled={syncing === r.id}
                  style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 6, padding: '4px 8px', color: 'var(--mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
                  {syncing === r.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync
                </button>
                <button onClick={() => removeRepo(r)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
