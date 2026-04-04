import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, CheckCircle, Loader2, Plus, Trash2, RefreshCw, GitBranch } from 'lucide-react';
import api from '../api/client';

export default function Settings() {
  const [repos, setRepos] = useState<string[]>([]);
  const [newRepo, setNewRepo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s: Record<string, unknown>) => {
      if (s.repos) setRepos(s.repos as string[]);
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ repos });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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

  const syncRepo = async (repoName: string) => {
    setSyncing(repoName);
    try {
      await api.triageAll();
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={newRepo} onChange={e => setNewRepo(e.target.value)} placeholder="owner/repo" onKeyDown={e => e.key === 'Enter' && addRepo()}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addRepo}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--purple)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Plus size={14} /> Add
            </button>
          </div>
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
            <div key={r} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--rule)', marginBottom: 8, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <GitBranch size={15} style={{ color: 'var(--purple)', flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>{r}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => syncRepo(r)} disabled={syncing === r}
                  style={{ background: 'none', border: '1px solid var(--rule)', borderRadius: 6, padding: '4px 8px', color: 'var(--mid)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
                  {syncing === r ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync
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
