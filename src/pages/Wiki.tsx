import { useState, useEffect } from 'react';
import { BookOpen, Layers, FolderTree, FileText, Users, CircleDot, RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import api from '../api/client';

interface WikiRepo {
  repo_full_name: string;
  language: string;
  default_branch: string;
  page_count: number;
  last_generated: string;
}

interface WikiPage {
  id: number;
  slug: string;
  title: string;
  content: string;
  icon: string;
  sort_order: number;
  generated_at: string;
}

const iconMap: Record<string, typeof BookOpen> = {
  BookOpen, Layers, FolderTree, FileText, Users, CircleDot,
};

/* ── Simple Markdown renderer ── */
function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 12px' }}>{line.slice(2)}</h1>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: '20px 0 8px' }}>{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '16px 0 6px' }}>{line.slice(4)}</h3>);
      i++; continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={key++} style={{
          background: 'var(--bg2)', border: '1px solid var(--rule)', borderRadius: 8,
          padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', overflowX: 'auto',
          lineHeight: 1.6, margin: '8px 0', color: 'var(--ink)', whiteSpace: 'pre',
        }}>
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      // Parse header + separator + body
      if (tableRows.length >= 2) {
        const parseRow = (row: string) => row.split('|').filter(c => c.trim() !== '' && !c.match(/^[\s-]+$/)).map(c => c.trim());
        const header = parseRow(tableRows[0]);
        const isSeparator = (r: string) => r.replace(/[|\s-]/g, '').length === 0;
        const bodyStart = isSeparator(tableRows[1]) ? 2 : 1;
        const bodyRows = tableRows.slice(bodyStart).map(parseRow);

        elements.push(
          <div key={key++} style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {header.map((h, j) => (
                    <th key={j} style={{
                      textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--rule)',
                      fontWeight: 600, color: 'var(--dim)', fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((cells, ri) => (
                  <tr key={ri}>
                    {cells.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '8px 12px', borderBottom: '1px solid var(--rule)', color: 'var(--ink)',
                      }}>
                        {/* Render links in cells */}
                        {cell.match(/\[(.+?)\]\((.+?)\)/) ? (
                          <a href={cell.match(/\[(.+?)\]\((.+?)\)/)![2]} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--purple)', textDecoration: 'none' }}>
                            {cell.match(/\[(.+?)\]\((.+?)\)/)![1]}
                          </a>
                        ) : cell.startsWith('`') && cell.endsWith('`') ? (
                          <code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
                            {cell.slice(1, -1)}
                          </code>
                        ) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bold text line
    if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(<p key={key++} style={{ fontWeight: 600, color: 'var(--ink)', margin: '6px 0' }}>{line.replace(/\*\*/g, '')}</p>);
      i++; continue;
    }

    // Regular paragraph (with inline formatting)
    if (line.trim()) {
      const rendered = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code style="background:var(--bg2);padding:2px 6px;border-radius:4px;font-size:12px">$1</code>');
      elements.push(<p key={key++} style={{ color: 'var(--mid)', lineHeight: 1.7, margin: '4px 0', fontSize: 13 }} dangerouslySetInnerHTML={{ __html: rendered }} />);
      i++; continue;
    }

    // Empty line
    i++;
  }

  return <>{elements}</>;
}

export default function Wiki() {
  const [repos, setRepos] = useState<WikiRepo[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<{ id: number; full_name: string; language: string }[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [activePage, setActivePage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [wikiRepos, allRepos] = await Promise.all([
        api.listWikiRepos(),
        api.listRepos(),
      ]);
      setRepos(wikiRepos);
      setConnectedRepos(allRepos.map((r: any) => ({ id: r.id, full_name: r.full_name, language: r.language })));

      // Auto-select first repo with wiki, or first connected repo
      if (wikiRepos.length > 0) {
        setSelectedRepo(wikiRepos[0].repo_full_name);
        await loadPages(wikiRepos[0].repo_full_name);
      } else if (allRepos.length > 0) {
        setSelectedRepo(allRepos[0].full_name);
      }
    } catch { setError('Failed to load wiki data'); }
    finally { setLoading(false); }
  };

  const loadPages = async (repoFullName: string) => {
    const [owner, name] = repoFullName.split('/');
    try {
      const data = await api.getWikiPages(owner, name);
      setPages(data);
      if (data.length > 0) setActivePage(data[0].slug);
    } catch { setPages([]); }
  };

  const handleRepoSelect = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    setPages([]);
    setActivePage('');
    await loadPages(repoFullName);
  };

  const handleGenerate = async () => {
    if (!selectedRepo) return;
    setGenerating(true);
    setError('');
    const [owner, name] = selectedRepo.split('/');
    try {
      await api.generateWiki(owner, name);
      await loadPages(selectedRepo);
      // Refresh repo list
      const wikiRepos = await api.listWikiRepos();
      setRepos(wikiRepos);
    } catch (e: any) { setError(e.message || 'Failed to generate wiki'); }
    finally { setGenerating(false); }
  };

  const currentPage = pages.find(p => p.slug === activePage);
  const hasWiki = pages.length > 0;
  const repoHasWiki = repos.some(r => r.repo_full_name === selectedRepo);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--purple)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Wiki</h1>
          <p style={{ fontSize: 13, color: 'var(--dim)', margin: '4px 0 0' }}>
            Auto-generated documentation for your connected repositories
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Repo selector */}
          <select
            value={selectedRepo}
            onChange={e => handleRepoSelect(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid var(--rule)',
              background: 'var(--white)', fontSize: 13, color: 'var(--ink)', cursor: 'pointer',
              minWidth: 200,
            }}
          >
            {connectedRepos.map(r => (
              <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
            ))}
          </select>
          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedRepo}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: generating ? 'var(--bg2)' : 'var(--purple)', color: '#fff',
              border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {generating ? 'Generating...' : repoHasWiki ? 'Regenerate Wiki' : 'Generate Wiki'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!hasWiki && !generating && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '50vh', gap: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(57,105,202,.1), rgba(33,193,154,.08))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={28} style={{ color: 'var(--purple)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
              No wiki generated yet
            </h2>
            <p style={{ fontSize: 13, color: 'var(--dim)', maxWidth: 400, lineHeight: 1.6 }}>
              Click "Generate Wiki" to automatically create documentation for <strong>{selectedRepo}</strong> by analyzing its repository structure, README, tech stack, and contributors.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'var(--purple)', color: '#fff',
              border: 'none', cursor: 'pointer', marginTop: 8,
            }}
          >
            <RefreshCw size={16} />
            Generate Wiki
          </button>
        </div>
      )}

      {/* Wiki content */}
      {hasWiki && (
        <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, border: '1px solid var(--rule)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Page sidebar */}
          <div style={{
            width: 220, flexShrink: 0,
            background: 'var(--bg)', borderRight: '1px solid var(--rule)',
            padding: '12px 0',
            overflowY: 'auto',
          }}>
            <div style={{ padding: '4px 16px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--dim)' }}>
              Pages
            </div>
            {pages.map(page => {
              const Icon = iconMap[page.icon] || BookOpen;
              const isActive = page.slug === activePage;
              return (
                <button
                  key={page.slug}
                  onClick={() => setActivePage(page.slug)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 16px', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--purple)' : 'var(--mid)',
                    background: isActive ? 'linear-gradient(135deg, rgba(57,105,202,.08), rgba(33,193,154,.05))' : 'transparent',
                    textAlign: 'left', transition: '0.15s',
                    borderLeft: isActive ? '3px solid var(--purple)' : '3px solid transparent',
                  }}
                >
                  <Icon size={16} />
                  {page.title}
                  {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                </button>
              );
            })}
            {/* Last generated */}
            {repos.find(r => r.repo_full_name === selectedRepo)?.last_generated && (
              <div style={{ padding: '16px 16px 4px', fontSize: 10, color: 'var(--dim)' }}>
                Generated: {new Date(repos.find(r => r.repo_full_name === selectedRepo)!.last_generated).toLocaleDateString()}
              </div>
            )}
          </div>

          {/* Content area */}
          <div style={{
            flex: 1, padding: '24px 32px', overflowY: 'auto',
            background: 'var(--white)',
          }}>
            {currentPage ? renderMarkdown(currentPage.content) : (
              <p style={{ color: 'var(--dim)' }}>Select a page from the sidebar.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
