import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, CheckCircle, XCircle, Loader2, Eye, EyeOff, HelpCircle, Bell, Send } from 'lucide-react';
import api from '../api/client';

export default function Integrations() {
  const [githubToken, setGithubToken] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [devinToken, setDevinToken] = useState('');
  const [orgId, setOrgId] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGH, setShowGH] = useState(false);
  const [showPAT, setShowPAT] = useState(false);
  const [showDevin, setShowDevin] = useState(false);
  const [ghValid, setGhValid] = useState<boolean | null>(null);
  const [patSet, setPatSet] = useState<boolean>(false);
  const [devinValid, setDevinValid] = useState<boolean | null>(null);
  const [slackValid, setSlackValid] = useState<boolean | null>(null);
  const [showGHGuide, setShowGHGuide] = useState(false);
  const [showPATGuide, setShowPATGuide] = useState(false);
  const [showDevinGuide, setShowDevinGuide] = useState(false);
  const [validating, setValidating] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    new_issue_triaged: true,
    issue_sent_to_devin: true,
    devin_needs_input: true,
    pr_ready_for_review: true,
    pr_merged: true,
    devin_session_failed: true,
    daily_summary: false,
  });
  const [sendingSummary, setSendingSummary] = useState(false);

  useEffect(() => {
    api.getSettings().then(async (s: Record<string, unknown>) => {
      if (s.github_token) setGithubToken(s.github_token as string);
      if (s.devin_api_token) setDevinToken(s.devin_api_token as string);
      if (s.devin_org_id) setOrgId(s.devin_org_id as string);
      if (s.slack_webhook_url) setSlackWebhook(s.slack_webhook_url as string);
      if (s.github_pat_set) setPatSet(true);
      if (s.notifications) setNotifications(prev => ({ ...prev, ...(s.notifications as Record<string, boolean>) }));
      // Validate all configured tokens
      setValidating(true);
      try {
        if (s.github_token_set) {
          const gh = await api.validateGithub() as Record<string, unknown>;
          setGhValid(!!gh.valid);
        }
        if (s.devin_api_token_set) {
          const dv = await api.validateDevin() as Record<string, unknown>;
          setDevinValid(!!dv.valid);
        }
        if (s.slack_webhook_url) {
          const sl = await api.validateSlack() as Record<string, unknown>;
          setSlackValid(!!sl.valid);
        }
      } catch { /* ignore */ }
      setValidating(false);
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ github_token: githubToken, github_pat: githubPat || undefined, devin_api_token: devinToken, devin_org_id: orgId, slack_webhook: slackWebhook, notifications });
      if (githubPat) setPatSet(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (githubToken) {
        try { const r = await api.validateGithub() as Record<string, unknown>; setGhValid(!!r.valid); } catch { setGhValid(false); }
      }
      if (devinToken && orgId) {
        try { const r = await api.validateDevin() as Record<string, unknown>; setDevinValid(!!r.valid); } catch { setDevinValid(false); }
      }
      if (slackWebhook) {
        try { const r = await api.validateSlack() as Record<string, unknown>; setSlackValid(!!r.valid); } catch { setSlackValid(false); }
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
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
            {saved ? 'Saved!' : 'Save Integrations'}
          </button>
        </div>, topbarEl
      )}

      <div style={{ maxWidth: 640 }}>
        {/* GitHub Token */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>
            GitHub Token
            {ghValid === true && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(33,193,154,.12)', color: 'var(--green)', fontSize: 10, fontWeight: 700 }}><CheckCircle size={11} /> Connected</span>}
            {ghValid === false && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(229,62,62,.1)', color: '#e53e3e', fontSize: 10, fontWeight: 700 }}><XCircle size={11} /> Not connected</span>}
            {ghValid === null && validating && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--dim)' }} />}
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

        {/* GitHub PAT for Devin Push Access */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>
            GitHub PAT (for Devin write access)
            {patSet && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(33,193,154,.12)', color: 'var(--green)', fontSize: 10, fontWeight: 700 }}><CheckCircle size={11} /> Configured</span>}
            <button onClick={() => setShowPATGuide(!showPATGuide)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <HelpCircle size={13} /> Why is this needed?
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input type={showPAT ? 'text' : 'password'} value={githubPat} onChange={e => setGithubPat(e.target.value)} placeholder={patSet ? '••••••••  (already set, enter new value to update)' : 'ghp_...'} style={inputStyle} />
            <button onClick={() => setShowPAT(!showPAT)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer' }}>
              {showPAT ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {showPATGuide && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--rule)', fontSize: 12, color: 'var(--mid)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--ink)' }}>Why a separate PAT?</strong><br />
              The GitHub token above is used by Backlog Zero to read issues and sync repos. This PAT is injected into Devin sessions so they can <strong>push code and create PRs</strong> on your behalf.<br /><br />
              <strong style={{ color: 'var(--ink)' }}>How to create it:</strong><br />
              1. Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>github.com/settings/tokens</a><br />
              2. Click <strong>{"\u201c"}Generate new token (classic){"\u201d"}</strong><br />
              3. Select scope: <code style={{ background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>repo</code> (full access)<br />
              4. Copy the token and paste it here
            </div>
          )}
        </div>

        {/* Devin API Token */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={labelStyle}>
            Devin API Token
            {devinValid === true && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(33,193,154,.12)', color: 'var(--green)', fontSize: 10, fontWeight: 700 }}><CheckCircle size={11} /> Connected</span>}
            {devinValid === false && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(229,62,62,.1)', color: '#e53e3e', fontSize: 10, fontWeight: 700 }}><XCircle size={11} /> Not connected</span>}
            {devinValid === null && validating && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--dim)' }} />}
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
          <div style={labelStyle}>
            Slack Webhook URL <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>(optional)</span>
            {slackValid === true && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(33,193,154,.12)', color: 'var(--green)', fontSize: 10, fontWeight: 700 }}><CheckCircle size={11} /> Connected</span>}
            {slackValid === false && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 10, background: 'rgba(229,62,62,.1)', color: '#e53e3e', fontSize: 10, fontWeight: 700 }}><XCircle size={11} /> Not connected</span>}
            {slackValid === null && slackWebhook && validating && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--dim)' }} />}
          </div>
          <input type="text" value={slackWebhook} onChange={e => setSlackWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." style={inputStyle} />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
            Get notified in Slack when Devin opens PRs or completes work. <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>Learn how to create a webhook</a>
          </div>
        </div>

        {/* Notification Toggles */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: '20px 24px' }}>
          <div style={{ ...labelStyle, marginBottom: 16 }}>
            <Bell size={14} /> Slack Notification Preferences
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.5 }}>
            Choose which events trigger Slack notifications. Requires a valid Slack webhook above.
          </div>
          {[
            { key: 'new_issue_triaged', label: 'New Issue Triaged', desc: 'When a new issue is synced and AI analysis is complete', priority: 'High' },
            { key: 'issue_sent_to_devin', label: 'Issue Sent to Devin', desc: 'When an approved issue is dispatched to Devin', priority: 'High' },
            { key: 'devin_needs_input', label: 'Devin Needs Input', desc: 'When Devin is blocked and waiting for your feedback', priority: 'High' },
            { key: 'pr_ready_for_review', label: 'PR Ready for Review', desc: 'When Devin opens a pull request for your review', priority: 'High' },
            { key: 'pr_merged', label: 'PR Merged / Issue Resolved', desc: 'When a PR is merged and the issue is marked resolved', priority: 'Medium' },
            { key: 'devin_session_failed', label: 'Devin Session Failed', desc: 'When a Devin session errors out or gets suspended', priority: 'Medium' },
            { key: 'daily_summary', label: 'Daily Summary Digest', desc: 'Aggregated daily stats for your backlog', priority: 'Low' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.label}
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: item.priority === 'High' ? 'rgba(229,62,62,.1)' : item.priority === 'Medium' ? 'rgba(237,137,54,.1)' : 'rgba(113,128,150,.1)', color: item.priority === 'High' ? '#e53e3e' : item.priority === 'Medium' ? '#dd6b20' : '#718096' }}>
                    {item.priority}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>{item.desc}</div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0, marginLeft: 16, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifications[item.key] ?? true}
                  onChange={e => setNotifications(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 11, transition: '0.2s',
                  background: notifications[item.key] ? 'var(--purple)' : 'var(--rule)',
                }} />
                <span style={{
                  position: 'absolute', top: 2, left: notifications[item.key] ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: '0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </label>
            </div>
          ))}
          {/* Send Daily Summary button */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={async () => {
                setSendingSummary(true);
                try { await api.sendDailySummary(); } catch { /* ignore */ }
                finally { setSendingSummary(false); }
              }}
              disabled={sendingSummary || !slackWebhook}
              style={{ fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7, cursor: slackWebhook ? 'pointer' : 'not-allowed', border: 'none', background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, opacity: slackWebhook ? 1 : 0.5, transition: '0.2s' }}
            >
              {sendingSummary ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Send Daily Summary Now
            </button>
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>Manually trigger the daily digest</span>
          </div>
        </div>
      </div>
    </div>
  );
}
