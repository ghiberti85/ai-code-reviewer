import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReview } from './hooks/useReview'
import { useHistory } from './hooks/useHistory'
import { ScoreBadge } from './components/Review/ScoreBadge'
import { IssueCard } from './components/Review/IssueCard'
import { DiffView } from './components/Review/DiffView'
import { FileDropZone } from './components/FileDropZone'
import { EmbedBadge } from './components/EmbedBadge'
import { LANGUAGES } from './lib/groq'
import { buildShareUrl, readShareFromUrl } from './lib/share'
import type { Language, HistoryEntry } from './types/review'

const SAMPLE_CODE = `// User authentication service
var users = []
var isLoading = false

function getUser(id) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id) {
      return users[i]
    }
  }
}

function saveUser(user) {
  var found = false
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == user.id) {
      users[i] = user
      found = true
    }
  }
  if (!found) {
    users.push(user)
  }
}

async function loadUsers() {
  isLoading = true
  var res = await fetch('/api/users')
  var data = await res.json()
  users = data
  isLoading = false
}

function deleteUser(id) {
  var idx = -1
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id) idx = i
  }
  if (idx > -1) {
    users.splice(idx, 1)
  }
}`

const S = {
  app: {
    minHeight: '100vh',
    background: '#0D0F0E',
    color: '#D4E8DC',
    fontFamily: 'Syne, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    borderBottom: '1px solid #1E2220',
    padding: '0 32px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#141716',
  },
  logo: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    fontWeight: 700,
    color: '#00FF88',
    letterSpacing: '0.05em',
  },
  tabs: {
    display: 'flex',
    gap: '2px',
  },
  tab: (active: boolean) => ({
    padding: '8px 20px',
    background: active ? '#00FF881A' : 'transparent',
    color: active ? '#00FF88' : '#8A9E95',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'Syne, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    transition: 'all 0.15s',
  }),
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0',
    height: 'calc(100vh - 56px)',
    overflow: 'hidden',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #1E2220',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#141716',
    flexShrink: 0,
  },
  select: {
    background: '#0D0F0E',
    color: '#D4E8DC',
    border: '1px solid #2A3530',
    borderRadius: '6px',
    padding: '6px 12px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    cursor: 'pointer',
    outline: 'none',
  },
  runBtn: (disabled: boolean) => ({
    marginLeft: 'auto',
    padding: '8px 20px',
    background: disabled ? '#1E2220' : '#00FF88',
    color: disabled ? '#8A9E95' : '#0D0F0E',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '13px',
    letterSpacing: '0.05em',
    transition: 'all 0.15s',
  }),
  textarea: {
    flex: 1,
    background: '#0D0F0E',
    color: '#D4E8DC',
    border: 'none',
    outline: 'none',
    resize: 'none' as const,
    padding: '24px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '1.7',
    borderRight: '1px solid #1E2220',
    overflow: 'auto',
  },
  resultsPanel: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  card: {
    background: '#141716',
    border: '1px solid #1E2220',
    borderRadius: '10px',
    padding: '20px',
  },
  sectionTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    fontWeight: 700,
    color: '#00FF88',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
  },
  copyBtn: {
    background: 'transparent',
    border: '1px solid #2A3530',
    color: '#8A9E95',
    borderRadius: '4px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    transition: 'all 0.15s',
  },
  historyPage: {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
  },
  historyItem: (active: boolean) => ({
    background: active ? '#141716' : 'transparent',
    border: '1px solid #1E2220',
    borderRadius: '8px',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }),
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    height: '100%',
    color: '#2A3530',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
  },
}

function StreamingDots() {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '16px 0' }}>
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#00FF88', display: 'block' }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
      <span style={{ color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginLeft: '8px' }}>
        Analyzing code...
      </span>
    </div>
  )
}

function HistoryPage({
  history,
  onSelect,
  onClear,
}: {
  history: HistoryEntry[]
  onSelect: (e: HistoryEntry) => void
  onClear: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const entry = history.find(h => h.id === selected)

  if (history.length === 0) {
    return (
      <div style={S.historyPage}>
        <div style={S.emptyState}>
          <span style={{ fontSize: '32px' }}>[ ]</span>
          <span>No reviews yet</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...S.historyPage, display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ ...S.sectionTitle, marginBottom: 0 }}>History ({history.length})</span>
          <button onClick={onClear} style={{ ...S.copyBtn, color: '#FF2244', borderColor: '#FF224422' }}>
            Clear
          </button>
        </div>
        {history.map(h => (
          <button
            key={h.id}
            onClick={() => { setSelected(h.id); onSelect(h) }}
            style={{ ...S.historyItem(h.id === selected), border: 'none', background: h.id === selected ? '#141716' : '#0D0F0E', width: '100%', textAlign: 'left' }}
          >
            <ScoreCircle score={h.result.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88', marginBottom: '4px' }}>
                {h.language}
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '12px', color: '#8A9E95', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {new Date(h.timestamp).toLocaleString()}
              </div>
            </div>
          </button>
        ))}
      </div>

      {entry && (
        <motion.div key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ResultPanel result={entry.result} />
        </motion.div>
      )}
    </div>
  )
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 90 ? '#00FF88' : score >= 70 ? '#88FF00' : score >= 50 ? '#FFD700' : score >= 30 ? '#FF8800' : '#FF2244'
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700 }}>{score}</span>
    </div>
  )
}

function ResultPanel({ result, originalCode, language }: { result: import('./types/review').ReviewResult; originalCode?: string; language?: Language }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ScoreBadge score={result.score} />
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Summary</div>
        <p style={{ margin: 0, color: '#D4E8DC', fontSize: '14px', lineHeight: 1.7 }}>{result.summary}</p>
      </div>

      {result.positives.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Positives</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.positives.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: '10px', color: '#D4E8DC', fontSize: '14px' }}>
                <span style={{ color: '#00FF88', fontFamily: 'JetBrains Mono, monospace' }}>✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.issues.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Issues ({result.issues.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {result.issues.map((issue, i) => (
              <IssueCard key={i} issue={issue} index={i} />
            ))}
          </div>
        </div>
      )}

      {result.refactored && originalCode && language && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Refactored</div>
          <DiffView original={originalCode} refactored={result.refactored} language={language} />
        </div>
      )}

      {result.refactored && (!originalCode || !language) && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={S.sectionTitle}>Refactored</div>
            <button onClick={() => copy(result.refactored!)} style={S.copyBtn}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{ margin: 0, background: '#0D0F0E', borderRadius: '6px', padding: '16px', overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: 1.7, color: '#D4E8DC' }}>
            {result.refactored}
          </pre>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [tab, setTab] = useState<'editor' | 'history'>('editor')
  const [code, setCode] = useState(SAMPLE_CODE)
  const [language, setLanguage] = useState<Language>('javascript')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const { status, result, error, runReview, loadResult } = useReview()
  const { history, addEntry, clearHistory } = useHistory()

  // Load shared review from URL on mount
  useEffect(() => {
    const shared = readShareFromUrl()
    if (shared) {
      setCode(shared.code)
      setLanguage(shared.language)
      loadResult(shared.result)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadResult])

  const handleRun = useCallback(async () => {
    const res = await runReview(code, language)
    if (res) addEntry(code, language, res)
  }, [code, language, runReview, addEntry])

  const handleShare = useCallback(async () => {
    if (!result) return
    const url = buildShareUrl({ code, language, result })
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }, [result, code, language])

  const isLoading = status === 'streaming'

  return (
    <div style={S.app}>
      <header style={S.header}>
        <span style={S.logo}>$ ai-code-reviewer</span>
        <nav style={S.tabs}>
          <button style={S.tab(tab === 'editor')} onClick={() => setTab('editor')}>Editor</button>
          <button style={S.tab(tab === 'history')} onClick={() => setTab('history')}>
            History {history.length > 0 && `(${history.length})`}
          </button>
        </nav>
      </header>

      <AnimatePresence mode="wait">
        {tab === 'editor' ? (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={S.main}>
            <div style={{ ...S.panel, borderRight: '1px solid #1E2220' }}>
              <div style={S.panelHeader}>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value as Language)}
                  style={S.select}
                >
                  {LANGUAGES.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                <FileDropZone onLoad={(c, l) => { setCode(c); setLanguage(l) }} />
                <button onClick={handleRun} disabled={isLoading || !code.trim()} style={S.runBtn(isLoading || !code.trim())}>
                  {isLoading ? 'Analyzing...' : '▶ Run Review'}
                </button>
              </div>
              <textarea
                value={code}
                onChange={e => setCode(e.target.value)}
                style={S.textarea}
                spellCheck={false}
                placeholder="Paste your code here..."
              />
            </div>

            <div style={S.panel}>
              <div style={{ ...S.panelHeader, justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8A9E95', letterSpacing: '0.08em' }}>
                  REVIEW OUTPUT
                </span>
                {status === 'done' && result && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88' }}>✓ Complete</span>
                    <button onClick={handleShare} style={{ ...S.copyBtn, borderColor: '#00FF8844', color: shareStatus === 'copied' ? '#00FF88' : '#8A9E95' }}>
                      {shareStatus === 'copied' ? '✓ Link copied' : '⇧ Share'}
                    </button>
                    <EmbedBadge score={result.score} language={language} />
                  </div>
                )}
              </div>

              <div style={S.resultsPanel}>
                {status === 'idle' && (
                  <div style={S.emptyState}>
                    <span style={{ fontSize: '28px' }}>{'{ }'}</span>
                    <span>Run a review to see results</span>
                  </div>
                )}

                {status === 'streaming' && <StreamingDots />}

                {status === 'error' && (
                  <div style={{ background: 'rgba(255,34,68,0.08)', border: '1px solid #FF224433', borderRadius: '8px', padding: '20px', color: '#FF2244', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                    Error: {error}
                  </div>
                )}

                {status === 'done' && result && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ResultPanel result={result} originalCode={code} language={language} />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflow: 'hidden' }}>
            <HistoryPage history={history} onSelect={() => {}} onClear={clearHistory} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
