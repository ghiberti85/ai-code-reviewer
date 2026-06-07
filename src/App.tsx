import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReview } from './hooks/useReview'
import { useHistory } from './hooks/useHistory'
import { useMediaQuery } from './hooks/useMediaQuery'
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

// ── Shared style tokens ────────────────────────────────────────────────────────

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
    padding: '0 24px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#141716',
    flexShrink: 0,
  },
  tab: (active: boolean) => ({
    padding: '8px 18px',
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
  panelHeader: {
    padding: '12px 20px',
    borderBottom: '1px solid #1E2220',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#141716',
    flexShrink: 0,
  },
  select: {
    background: '#0D0F0E',
    color: '#D4E8DC',
    border: '1px solid #2A3530',
    borderRadius: '6px',
    padding: '6px 10px',
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
    whiteSpace: 'nowrap' as const,
  }),
  textarea: {
    flex: 1,
    background: '#0D0F0E',
    color: '#D4E8DC',
    border: 'none',
    outline: 'none',
    resize: 'none' as const,
    padding: '20px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '1.7',
    overflow: 'auto',
    tabSize: 2,
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
    marginBottom: '14px',
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
    whiteSpace: 'nowrap' as const,
  },
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function EditorStatusBar({ code, language }: { code: string; language: Language }) {
  const lines = code ? code.split('\n').length : 0
  const bytes = new TextEncoder().encode(code).length
  const kb = (bytes / 1024).toFixed(1)
  const nearLimit = bytes > 45_000
  const overLimit = bytes > 50_000

  return (
    <div style={{
      padding: '4px 20px',
      borderTop: '1px solid #1E2220',
      background: '#141716',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8A9E95' }}>
        {lines} {lines === 1 ? 'line' : 'lines'}
      </span>
      <span style={{ color: '#2A3530', fontSize: '11px' }}>·</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: overLimit ? '#FF2244' : nearLimit ? '#FFD700' : '#8A9E95' }}>
        {kb} KB{nearLimit ? ' ⚠' : ''}
      </span>
      <span style={{ color: '#2A3530', fontSize: '11px' }}>·</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8A9E95' }}>
        {language}
      </span>
    </div>
  )
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

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 90 ? '#00FF88' : score >= 70 ? '#88FF00' : score >= 50 ? '#FFD700' : score >= 30 ? '#FF8800' : '#FF2244'
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700 }}>{score}</span>
    </div>
  )
}

function ResultPanel({
  result,
  originalCode,
  language,
  onExpandDiff,
  onRetry,
}: {
  result: import('./types/review').ReviewResult
  originalCode?: string
  language?: Language
  onExpandDiff?: () => void
  onRetry?: () => void
}) {
  const refactoredMissing = result.score < 90 && !result.refactored

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ ...S.sectionTitle, marginBottom: 0 }}>Refactored</div>
            {onExpandDiff && (
              <button
                onClick={onExpandDiff}
                className="expand-diff-btn"
                style={{ ...S.copyBtn, borderColor: '#00FF8833', color: '#00FF88', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                ⤢ Expand
              </button>
            )}
          </div>
          <DiffView original={originalCode} refactored={result.refactored} language={language} />
        </div>
      )}

      {result.refactored && (!originalCode || !language) && (
        <div style={S.card}>
          <div style={S.sectionTitle}>Refactored</div>
          <pre style={{ margin: 0, background: '#0D0F0E', borderRadius: '6px', padding: '16px', overflow: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: 1.7, color: '#D4E8DC' }}>
            {result.refactored}
          </pre>
        </div>
      )}

      {refactoredMissing && (
        <div style={{ ...S.card, border: '1px solid #FFD70033', background: 'rgba(255,215,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ ...S.sectionTitle, marginBottom: '4px', color: '#FFD700' }}>Refactored</div>
            <p style={{ margin: 0, color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
              The model skipped the refactored code (score {result.score}/100 should require it).
            </p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{ ...S.copyBtn, borderColor: '#FFD70033', color: '#FFD700', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              ↺ Retry
            </button>
          )}
        </div>
      )}
    </>
  )
}

function HistoryPage({
  history,
  onClear,
  isMobile,
}: {
  history: HistoryEntry[]
  onClear: () => void
  isMobile: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const entry = history.find(h => h.id === selected)

  if (history.length === 0) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <div style={S.emptyState}>
          <span style={{ fontSize: '32px' }}>[ ]</span>
          <span>No reviews yet</span>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {mobileView === 'list' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...S.sectionTitle, marginBottom: 0 }}>History ({history.length})</span>
              <button onClick={onClear} style={{ ...S.copyBtn, color: '#FF2244', borderColor: '#FF224422' }}>Clear</button>
            </div>
            {history.map(h => (
              <button
                key={h.id}
                onClick={() => { setSelected(h.id); setMobileView('detail') }}
                style={{ background: '#141716', border: '1px solid #1E2220', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left' }}
              >
                <ScoreCircle score={h.result.score} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88', marginBottom: '4px' }}>{h.language}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '12px', color: '#8A9E95', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </div>
                </div>
                <span style={{ color: '#2A3530', fontSize: '16px' }}>›</span>
              </button>
            ))}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              onClick={() => setMobileView('list')}
              style={{ background: 'transparent', border: '1px solid #2A3530', color: '#8A9E95', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ← Back
            </button>
            {entry && <ResultPanel result={entry.result} />}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '32px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ ...S.sectionTitle, marginBottom: 0 }}>History ({history.length})</span>
          <button onClick={onClear} style={{ ...S.copyBtn, color: '#FF2244', borderColor: '#FF224422' }}>Clear</button>
        </div>
        {history.map(h => (
          <button
            key={h.id}
            onClick={() => setSelected(h.id)}
            style={{ background: h.id === selected ? '#141716' : '#0D0F0E', border: '1px solid #1E2220', borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left', transition: 'all 0.15s' }}
          >
            <ScoreCircle score={h.result.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88', marginBottom: '4px' }}>{h.language}</div>
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

// ── Fullscreen Diff Overlay ────────────────────────────────────────────────────

function DiffFullscreen({
  original,
  refactored,
  language,
  onClose,
}: {
  original: string
  refactored: string
  language: Language
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <motion.div
      className="diff-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div style={{ ...S.panelHeader, justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8A9E95', letterSpacing: '0.08em' }}>
          DIFF — ORIGINAL vs REFACTORED
        </span>
        <button onClick={onClose} className="diff-close-btn" style={{ ...S.copyBtn, display: 'flex', alignItems: 'center', gap: '6px' }}>
          ✕ Close <span className="diff-esc-hint" style={{ color: '#2A3530', fontSize: '10px' }}>Esc</span>
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        <DiffView original={original} refactored={refactored} language={language} fullscreen />
      </div>
      {/* Mobile sticky close bar */}
      <button onClick={onClose} className="diff-close-mobile-bar">
        ✕ Fechar diff
      </button>
    </motion.div>
  )
}

// ── Root App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<'editor' | 'history'>('editor')
  const [mobilePanel, setMobilePanel] = useState<'code' | 'results'>('code')
  const [code, setCode] = useState(SAMPLE_CODE)
  const [language, setLanguage] = useState<Language>('javascript')
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle')
  const [diffExpanded, setDiffExpanded] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { status, result, error, runReview, loadResult } = useReview()
  const { history, addEntry, clearHistory } = useHistory()
  const isMobile = useMediaQuery('(max-width: 768px)')

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
    if (isMobile) setMobilePanel('results')
    const res = await runReview(code, language)
    if (res) addEntry(code, language, res)
  }, [code, language, runReview, addEntry, isMobile])

  const handleCopyAll = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }, [code])

  const handleShare = useCallback(async () => {
    if (!result) return
    const url = buildShareUrl({ code, language, result })
    await navigator.clipboard.writeText(url)
    setShareStatus('copied')
    setTimeout(() => setShareStatus('idle'), 2000)
  }, [result, code, language])

  const isLoading = status === 'streaming' || status === 'refactoring'

  return (
    <div style={S.app}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={S.header}>
        <span className="app-header-logo" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 700, color: '#00FF88', letterSpacing: '0.05em' }}>
          $ ai-code-reviewer
        </span>
        <nav className="app-header-nav" style={{ display: 'flex', gap: '2px' }}>
          <button style={S.tab(tab === 'editor')} onClick={() => setTab('editor')}>Editor</button>
          <button style={S.tab(tab === 'history')} onClick={() => setTab('history')}>
            History {history.length > 0 && `(${history.length})`}
          </button>
        </nav>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === 'editor' ? (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="app-main">

            {/* Left — Code Editor */}
            <div className={`panel-left${isMobile && mobilePanel === 'results' ? ' mobile-hidden' : ''}`}>
              <div className="panel-header-scroll" style={S.panelHeader}>
                <select value={language} onChange={e => setLanguage(e.target.value as Language)} style={S.select}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <FileDropZone onLoad={(c, l) => { setCode(c); setLanguage(l) }} />
                {isMobile && (
                  <button
                    onClick={handleCopyAll}
                    className="copy-all-btn"
                    style={{ ...S.copyBtn, color: codeCopied ? '#00FF88' : '#8A9E95', borderColor: codeCopied ? '#00FF8844' : '#2A3530' }}
                  >
                    {codeCopied ? '✓ Copied' : '⊡ Copy All'}
                  </button>
                )}
                <button
                  onClick={handleRun}
                  disabled={isLoading || !code.trim()}
                  style={S.runBtn(isLoading || !code.trim())}
                  className="run-btn-mobile"
                >
                  {isLoading ? 'Analyzing...' : '▶ Run Review'}
                </button>
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                style={S.textarea}
                spellCheck={false}
                placeholder="Paste your code here..."
              />
              <EditorStatusBar code={code} language={language} />
            </div>

            {/* Right — Results */}
            <div className={`panel-right${isMobile && mobilePanel === 'code' ? ' mobile-hidden' : ''}`}>
              <div style={{ ...S.panelHeader, justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {isMobile && (
                    <button
                      onClick={() => setMobilePanel('code')}
                      style={{ ...S.copyBtn, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '6px 12px' }}
                    >
                      ← Code
                    </button>
                  )}
                  {!isMobile && (
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#8A9E95', letterSpacing: '0.08em' }}>
                      REVIEW OUTPUT
                    </span>
                  )}
                </div>
                {status === 'done' && result && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88' }}>✓</span>
                    <button onClick={handleShare} style={{ ...S.copyBtn, borderColor: '#00FF8833', color: shareStatus === 'copied' ? '#00FF88' : '#8A9E95' }}>
                      {shareStatus === 'copied' ? '✓ Copied' : '⇧ Share'}
                    </button>
                    {!isMobile && <EmbedBadge score={result.score} language={language} />}
                  </div>
                )}
              </div>

              <div className="results-panel" style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                {(status === 'refactoring' || status === 'done') && result && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <ResultPanel
                      result={result}
                      originalCode={code}
                      language={language}
                      onExpandDiff={status === 'done' ? () => setDiffExpanded(true) : undefined}
                      onRetry={status === 'done' ? handleRun : undefined}
                    />
                    {status === 'refactoring' && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                          <motion.span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#FFD700', display: 'block' }} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                        ))}
                        <span style={{ color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', marginLeft: '6px' }}>Generating refactored code...</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <HistoryPage history={history} onClear={clearHistory} isMobile={isMobile} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav className="mobile-tabs">
        <button
          className={`mobile-tab${tab === 'editor' && mobilePanel === 'code' ? ' active' : ''}`}
          onClick={() => { setTab('editor'); setMobilePanel('code') }}
        >
          <div className="mobile-tab-dot" />
          Code
        </button>
        <button
          className={`mobile-tab${tab === 'editor' && mobilePanel === 'results' ? ' active' : ''}`}
          onClick={() => {
            setTab('editor')
            if (!code.trim()) return
            if (status === 'idle') handleRun()
            else setMobilePanel('results')
          }}
        >
          <div className="mobile-tab-dot" />
          {isLoading ? 'Analyzing...' : 'Results'}
        </button>
        <button
          className={`mobile-tab${tab === 'history' ? ' active' : ''}`}
          onClick={() => setTab('history')}
        >
          <div className="mobile-tab-dot" />
          History
        </button>
      </nav>

      {/* ── Fullscreen Diff Overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {diffExpanded && result?.refactored && (
          <DiffFullscreen
            original={code}
            refactored={result.refactored}
            language={language}
            onClose={() => setDiffExpanded(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
