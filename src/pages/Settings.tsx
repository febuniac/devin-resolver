import { useState, useEffect } from 'react';
import { Github, Plus, Trash2, RefreshCw, Slack, Shield, Bell, CheckCircle2, Key, Bot, Loader2, AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import api from '../api/client';

interface ConnectedRepo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  language: string;
  open_issues_count: number;
  last_sync: string | null;
  sync_enabled: boolean;
}

interface SettingsData {
  github_token_set: boolean;
  devin_api_token_set: boolean;
  slack_webhook_url: string;
  slack_channels: string[];
  auto_approve_enabled: boolean;
  auto_approve_confidence: number;
  auto_approve_max_severity: string;
  codeql_enabled: boolean;
  scan_frequency: string;
  notifications: Record<string, boolean>;
}

type ValidationStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Settings() {
  const [repos, setRepos] = useState<ConnectedRepo[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [devinToken, setDevinToken] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState(false);
  const [githubValidation, setGithubValidation] = useState<ValidationStatus>('idle');
  const [devinValidation, setDevinValidation] = useState<ValidationStatus>('idle');
  const [slackValidation, setSlackValidation] = useState<ValidationStatus>('idle');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [repoData, settingsData] = await Promise.all([
        api.listRepos(),
        api.getSettings(),
      ]);
      setRepos(repoData);
      setSettings(settingsData);
      setSlackWebhook(settingsData.slack_webhook_url || '');
    } catch {
      setError('Failed to load settings. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const saveToken = async (field: string, value: string) => {
    setSaving(true);
    setError('');
    try {
      await api.updateSettings({ [field]: value });
      const label = field === 'github_token' ? 'GitHub' : field === 'devin_api_token' ? 'Devin' : 'Slack';
      setSuccessMsg(`${label} token saved!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const validateGithub = async () => {
    setGithubValidation('loading');
    try {
      const result = await api.validateGithub();
      setGithubValidation(result.valid ? 'success' : 'error');
    } catch {
      setGithubValidation('error');
    }
  };

  const validateDevin = async () => {
    setDevinValidation('loading');
    try {
      const result = await api.validateDevin();
      setDevinValidation(result.valid ? 'success' : 'error');
    } catch {
      setDevinValidation('error');
    }
  };

  const validateSlack = async () => {
    setSlackValidation('loading');
    try {
      const result = await api.validateSlack();
      setSlackValidation(result.valid ? 'success' : 'error');
    } catch {
      setSlackValidation('error');
    }
  };

  const addRepo = async () => {
    if (!newRepoUrl || !newRepoUrl.includes('/')) return;
    setConnectingRepo(true);
    setError('');
    try {
      const [owner, name] = newRepoUrl.split('/');
      await api.connectRepo(owner, name);
      setNewRepoUrl('');
      await loadData();
      setSuccessMsg(`Connected ${newRepoUrl}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect repo');
    } finally {
      setConnectingRepo(false);
    }
  };

  const removeRepo = async (id: number) => {
    try {
      await api.disconnectRepo(id);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove repo');
    }
  };

  const syncRepo = async (id: number) => {
    setSyncing(id);
    setError('');
    try {
      const result = await api.syncRepo(id);
      setSuccessMsg(`Synced: ${result.issues_synced} issues, ${result.security_synced} security findings`);
      setTimeout(() => setSuccessMsg(''), 5000);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to sync repo');
    } finally {
      setSyncing(null);
    }
  };

  const updateSetting = async (key: string, value: unknown) => {
    try {
      await api.updateSettings({ [key]: value });
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update setting');
    }
  };

  const ValidationIcon = ({ status }: { status: ValidationStatus }) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />;
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-400" />;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure repositories, integrations, and automation preferences</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-400/70 hover:text-red-400">dismiss</button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* API Tokens */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">API Tokens</h3>
        </div>

        <div className="space-y-6">
          {/* GitHub Token */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-2">
              <Github className="w-3.5 h-3.5" />
              GitHub Personal Access Token
              {settings?.github_token_set && <span className="text-emerald-400 text-xs">(configured)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder={settings?.github_token_set ? '••••••••••••••••' : 'ghp_xxxxxxxxxxxxx'}
                className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={() => saveToken('github_token', githubToken)}
                disabled={!githubToken || saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={validateGithub} className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors">
                <ValidationIcon status={githubValidation} />
                {githubValidation === 'idle' && <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1">Needs repo, read:org, and security_events scopes</p>

            {/* GitHub Token Step-by-Step Guide */}
            <details className="mt-3 group">
              <summary className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer select-none transition-colors">
                <ChevronDown className="w-3.5 h-3.5 group-open:hidden" />
                <ChevronUp className="w-3.5 h-3.5 hidden group-open:block" />
                How to get your GitHub token (step-by-step)
              </summary>
              <div className="mt-2 ml-1 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-zinc-400">
                    Go to <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5">github.com/settings/tokens/new <ExternalLink className="w-3 h-3" /></a>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-zinc-400">Give it a name like <span className="text-zinc-300 font-medium">&quot;DevinResolver&quot;</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-zinc-400">Set expiration to <span className="text-zinc-300 font-medium">90 days</span> (or custom)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <div className="text-xs text-zinc-400">
                    <p>Select these scopes:</p>
                    <ul className="mt-1 ml-3 space-y-0.5 list-disc text-zinc-500">
                      <li><span className="text-zinc-300 font-mono">repo</span> - Full control of private repositories</li>
                      <li><span className="text-zinc-300 font-mono">read:org</span> - Read org membership</li>
                      <li><span className="text-zinc-300 font-mono">security_events</span> - Read and write security events (under repo)</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                  <p className="text-xs text-zinc-400">Click <span className="text-zinc-300 font-medium">&quot;Generate token&quot;</span> and copy the <span className="text-zinc-300 font-mono">ghp_...</span> value</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">6</span>
                  <p className="text-xs text-zinc-400">Paste it in the field above and click <span className="text-zinc-300 font-medium">Save</span></p>
                </div>
              </div>
            </details>
          </div>

          {/* Devin API Token */}
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5" />
              Devin API Token
              {settings?.devin_api_token_set && <span className="text-emerald-400 text-xs">(configured)</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={devinToken}
                onChange={(e) => setDevinToken(e.target.value)}
                placeholder={settings?.devin_api_token_set ? '••••••••••••••••' : 'devin_xxxxxxxxxxxxx'}
                className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={() => saveToken('devin_api_token', devinToken)}
                disabled={!devinToken || saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={validateDevin} className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors">
                <ValidationIcon status={devinValidation} />
                {devinValidation === 'idle' && <RefreshCw className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1">Get your token at app.devin.ai/settings</p>

            {/* Devin Token Step-by-Step Guide */}
            <details className="mt-3 group">
              <summary className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer select-none transition-colors">
                <ChevronDown className="w-3.5 h-3.5 group-open:hidden" />
                <ChevronUp className="w-3.5 h-3.5 hidden group-open:block" />
                How to get your Devin API token (step-by-step)
              </summary>
              <div className="mt-2 ml-1 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-zinc-400">
                    Go to <a href="https://app.devin.ai/settings" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5">app.devin.ai/settings <ExternalLink className="w-3 h-3" /></a>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-zinc-400">Click <span className="text-zinc-300 font-medium">&quot;API keys&quot;</span> in the left sidebar (under Membership)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-zinc-400">Click <span className="text-zinc-300 font-medium">&quot;View key&quot;</span> next to Personal API Key to reveal it</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p className="text-xs text-zinc-400">Copy the API key</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                  <p className="text-xs text-zinc-400">Paste it in the field above and click <span className="text-zinc-300 font-medium">Save</span></p>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Connected Repositories */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Github className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Connected Repositories</h3>
          <span className="text-xs text-zinc-500 ml-auto">{repos.length} repos</span>
        </div>

        {repos.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No repositories connected yet. Add one below to get started.
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {repos.map((repo) => (
              <div key={repo.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{repo.full_name}</p>
                    <p className="text-xs text-zinc-500">{repo.language || 'Unknown'} - {repo.open_issues_count} open issues</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {repo.last_sync ? `Synced ${repo.last_sync}` : 'Never synced'}
                  </span>
                  <button
                    onClick={() => syncRepo(repo.id)}
                    disabled={syncing === repo.id}
                    className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing === repo.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => removeRepo(repo.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newRepoUrl}
            onChange={(e) => setNewRepoUrl(e.target.value)}
            placeholder="owner/repository"
            onKeyDown={(e) => e.key === 'Enter' && addRepo()}
            className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={addRepo}
            disabled={connectingRepo || !newRepoUrl.includes('/')}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {connectingRepo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Repository
          </button>
        </div>
      </div>

      {/* Slack Integration */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Slack className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Slack Integration</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Webhook URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={() => saveToken('slack_webhook_url', slackWebhook)}
                disabled={!slackWebhook || saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
              <button onClick={validateSlack} className="p-2 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors">
                <ValidationIcon status={slackValidation} />
                {slackValidation === 'idle' && <RefreshCw className="w-4 h-4" />}
              </button>
            </div>

            {/* Slack Webhook Step-by-Step Guide */}
            <details className="mt-3 group">
              <summary className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer select-none transition-colors">
                <ChevronDown className="w-3.5 h-3.5 group-open:hidden" />
                <ChevronUp className="w-3.5 h-3.5 hidden group-open:block" />
                How to create a Slack webhook (step-by-step)
              </summary>
              <div className="mt-2 ml-1 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-zinc-400">
                    Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5">api.slack.com/apps <ExternalLink className="w-3 h-3" /></a>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-zinc-400">Click <span className="text-zinc-300 font-medium">&quot;Create New App&quot;</span> &rarr; <span className="text-zinc-300 font-medium">&quot;From scratch&quot;</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-zinc-400">Name it <span className="text-zinc-300 font-medium">&quot;DevinResolver&quot;</span> and select your workspace</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p className="text-xs text-zinc-400">Go to <span className="text-zinc-300 font-medium">&quot;Incoming Webhooks&quot;</span> in the left sidebar and toggle it <span className="text-zinc-300 font-medium">On</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                  <p className="text-xs text-zinc-400">Click <span className="text-zinc-300 font-medium">&quot;Add New Webhook to Workspace&quot;</span> and select the channel for notifications</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">6</span>
                  <p className="text-xs text-zinc-400">Copy the webhook URL (<span className="text-zinc-300 font-mono">https://hooks.slack.com/services/...</span>) and paste it above</p>
                </div>
              </div>
            </details>
          </div>
          {settings?.slack_channels && settings.slack_channels.length > 0 && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Notification Channels</label>
              <div className="flex flex-wrap gap-2">
                {settings.slack_channels.map((ch) => (
                  <span key={ch} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300">
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Scanning */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Security Scanning</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-sm text-zinc-200">CodeQL Analysis</p>
                <p className="text-xs text-zinc-500">Automated code scanning for vulnerabilities</p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('codeql_enabled', !settings?.codeql_enabled)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${settings?.codeql_enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'}`}
            >
              {settings?.codeql_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Scan Frequency</label>
            <select
              value={settings?.scan_frequency || 'daily'}
              onChange={(e) => updateSetting('scan_frequency', e.target.value)}
              className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 px-3 py-2 focus:outline-none focus:border-violet-500/50"
            >
              <option value="realtime">Real-time (on every push)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Notifications</h3>
        </div>

        <div className="space-y-2">
          {settings?.notifications && Object.entries(settings.notifications).map(([key, value]) => {
            const labels: Record<string, string> = {
              pr_opened: 'PR opened by Devin',
              pr_merged: 'PR merged',
              triage_complete: 'Triage batch complete',
              security_alert: 'Critical security finding detected',
              weekly_report: 'Weekly summary report',
            };
            return (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-sm text-zinc-300">{labels[key] || key}</span>
                <button
                  onClick={() => updateSetting('notifications', { ...settings.notifications, [key]: !value })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${value ? 'bg-violet-500/15 text-violet-400' : 'bg-zinc-700/50 text-zinc-500'}`}
                >
                  {value ? 'On' : 'Off'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
