import { useState } from 'react';
import { Github, Plus, Trash2, RefreshCw, Slack, Shield, Bell, CheckCircle2 } from 'lucide-react';
import { repositories } from '../data/mockData';

export default function Settings() {
  const [repos, setRepos] = useState(repositories);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T0XXX/B0XXX/xxxxx');
  const [slackChannels] = useState(['#engineering-devin', '#security-fixes']);
  const [codeqlEnabled, setCodeqlEnabled] = useState(true);
  const [scanFrequency, setScanFrequency] = useState('daily');
  const [notifications, setNotifications] = useState({
    prOpened: true,
    prMerged: true,
    triageComplete: true,
    securityAlert: true,
    weeklyReport: true,
  });

  const addRepo = () => {
    if (!newRepoUrl) return;
    const name = newRepoUrl.split('/').pop() || 'new-repo';
    setRepos([...repos, {
      id: String(repos.length + 1),
      name,
      fullName: newRepoUrl,
      openIssues: 0,
      securityIssues: 0,
      language: 'Unknown',
      lastSync: 'Never',
      connected: true,
    }]);
    setNewRepoUrl('');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure repositories, integrations, and automation preferences</p>
      </div>

      {/* Connected Repositories */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Github className="w-5 h-5 text-zinc-300" />
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Connected Repositories</h3>
        </div>
        
        <div className="space-y-2 mb-4">
          {repos.map((repo) => (
            <div key={repo.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{repo.fullName}</p>
                  <p className="text-xs text-zinc-500">{repo.language} - {repo.openIssues} open issues, {repo.securityIssues} security findings</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Synced {repo.lastSync}</span>
                <button className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newRepoUrl}
            onChange={(e) => setNewRepoUrl(e.target.value)}
            placeholder="owner/repository"
            className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
          />
          <button onClick={addRepo} className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
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
            <input
              type="text"
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Notification Channels</label>
            <div className="flex flex-wrap gap-2">
              {slackChannels.map((ch) => (
                <span key={ch} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-xs text-zinc-300">
                  {ch}
                  <button className="text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
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
              onClick={() => setCodeqlEnabled(!codeqlEnabled)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${codeqlEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'}`}
            >
              {codeqlEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Scan Frequency</label>
            <select
              value={scanFrequency}
              onChange={(e) => setScanFrequency(e.target.value)}
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
          {Object.entries(notifications).map(([key, value]) => {
            const labels: Record<string, string> = {
              prOpened: 'PR opened by Devin',
              prMerged: 'PR merged',
              triageComplete: 'Triage batch complete',
              securityAlert: 'Critical security finding detected',
              weeklyReport: 'Weekly summary report',
            };
            return (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-sm text-zinc-300">{labels[key]}</span>
                <button
                  onClick={() => setNotifications({ ...notifications, [key]: !value })}
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
