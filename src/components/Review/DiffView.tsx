import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { createHighlighter, type Highlighter } from 'shiki'
import type { Language } from '../../types/review'
import { LANGUAGES } from '../../lib/groq'

interface Props {
  original: string
  refactored: string
  language: Language
  fullscreen?: boolean
  forceMobile?: boolean
}

type DiffMode = 'split' | 'unified'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNo: { left: number | null; right: number | null }
}

function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')

  // Simple LCS-based diff
  const m = leftLines.length
  const n = rightLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = leftLines[i - 1] === rightLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      result.push({ type: 'unchanged', content: leftLines[i - 1], lineNo: { left: i, right: j } })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', content: rightLines[j - 1], lineNo: { left: null, right: j } })
      j--
    } else {
      result.push({ type: 'removed', content: leftLines[i - 1], lineNo: { left: i, right: null } })
      i--
    }
  }
  return result.reverse()
}

let highlighterPromise: Promise<Highlighter> | null = null
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql'],
    })
  }
  return highlighterPromise
}


export function DiffView({ original, refactored, language, fullscreen, forceMobile }: Props) {
  // On mobile, split view is unusable — default to unified and hide the split toggle
  const isMobile = forceMobile ?? (typeof window !== 'undefined' && window.innerWidth <= 768)
  const [mode, setMode] = useState<DiffMode>(isMobile ? 'unified' : 'split')
  const [leftHtml, setLeftHtml] = useState('')
  const [rightHtml, setRightHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const shikiLang = LANGUAGES.find(l => l.value === language)?.shiki ?? 'typescript'
  const diffLines = useRef(computeDiff(original, refactored)).current

  useEffect(() => {
    getHighlighter().then(hl => {
      setLeftHtml(hl.codeToHtml(original, { lang: shikiLang, theme: 'github-dark' }))
      setRightHtml(hl.codeToHtml(refactored, { lang: shikiLang, theme: 'github-dark' }))
    })
  }, [original, refactored, shikiLang])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(refactored)
    } catch {
      // Fallback for iOS Safari which blocks clipboard API without user gesture context
      const ta = document.createElement('textarea')
      ta.value = refactored
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const addedCount = diffLines.filter(l => l.type === 'added').length
  const removedCount = diffLines.filter(l => l.type === 'removed').length

  const btnStyle = (active: boolean) => ({
    background: active ? '#00FF881A' : 'transparent',
    color: active ? '#00FF88' : '#8A9E95',
    border: '1px solid ' + (active ? '#00FF8844' : '#2A3530'),
    borderRadius: '4px',
    padding: isMobile ? '6px 14px' : '3px 10px',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    textTransform: 'capitalize' as const,
    minHeight: isMobile ? '36px' : 'auto',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', border: '1px solid #1E2220', borderRadius: '10px', overflow: 'hidden', minWidth: 0 }}
    >
      {/* toolbar */}
      <div style={{ background: '#141716', padding: isMobile ? '10px 12px' : '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1E2220', flexShrink: 0 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#00FF88', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Diff
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88' }}>+{addedCount}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#FF2244' }}>−{removedCount}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {!isMobile && (
            <>
              <button key="split" onClick={() => setMode('split')} style={btnStyle(mode === 'split')}>split</button>
              <button key="unified" onClick={() => setMode('unified')} style={btnStyle(mode === 'unified')}>unified</button>
            </>
          )}
          <button
            onClick={copy}
            style={{ ...btnStyle(false), marginLeft: isMobile ? 0 : '4px' }}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {mode === 'split' && !isMobile ? (
        <SplitView leftHtml={leftHtml} rightHtml={rightHtml} fullscreen={fullscreen} />
      ) : (
        <UnifiedView diffLines={diffLines} fullscreen={fullscreen} isMobile={isMobile} />
      )}
    </motion.div>
  )
}

function SplitView({ leftHtml, rightHtml, fullscreen }: { leftHtml: string; rightHtml: string; fullscreen?: boolean }) {
  const maxH = fullscreen ? 'calc(100vh - 100px)' : '420px'
  if (!leftHtml || !rightHtml) {
    return (
      <div style={{ padding: '24px', color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', textAlign: 'center' }}>
        Loading highlight...
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ borderRight: '1px solid #1E2220' }}>
        <div style={{ padding: '6px 12px', background: 'rgba(255,34,68,0.06)', borderBottom: '1px solid #1E2220' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#FF2244' }}>− original</span>
        </div>
        <div
          style={{ overflow: 'auto', maxHeight: maxH, fontSize: '12px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: leftHtml }}
        />
      </div>
      <div>
        <div style={{ padding: '6px 12px', background: 'rgba(0,255,136,0.06)', borderBottom: '1px solid #1E2220' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00FF88' }}>+ refactored</span>
        </div>
        <div
          style={{ overflow: 'auto', maxHeight: maxH, fontSize: '12px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: rightHtml }}
        />
      </div>
    </div>
  )
}

interface Hunk {
  lines: DiffLine[]
}

function groupIntoHunks(lines: DiffLine[], context = 3): Hunk[] {
  const changedIdx = new Set<number>()
  lines.forEach((l, i) => { if (l.type !== 'unchanged') changedIdx.add(i) })
  if (changedIdx.size === 0) return [{ lines }]

  const shown = new Set<number>()
  changedIdx.forEach(i => {
    for (let d = -context; d <= context; d++) {
      const idx = i + d
      if (idx >= 0 && idx < lines.length) shown.add(idx)
    }
  })

  const hunks: Hunk[] = []
  let current: DiffLine[] = []
  let prevIdx = -1

  Array.from(shown).sort((a, b) => a - b).forEach(idx => {
    if (prevIdx !== -1 && idx > prevIdx + 1) {
      hunks.push({ lines: current })
      current = []
    }
    current.push(lines[idx])
    prevIdx = idx
  })
  if (current.length) hunks.push({ lines: current })
  return hunks
}

function UnifiedView({ diffLines, fullscreen, isMobile }: { diffLines: DiffLine[]; fullscreen?: boolean; isMobile?: boolean }) {
  const hunks = groupIntoHunks(diffLines)
  const maxH = fullscreen ? 'calc(100vh - 100px)' : isMobile ? '60vh' : '520px'
  // Gutter width: narrower on mobile to give more space to code
  const gutterW = isMobile ? 24 : 38

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: maxH, background: '#0D0F0E', WebkitOverflowScrolling: 'touch' as any }}>
      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {hi > 0 && (
            <div style={{
              background: '#0A1520',
              borderTop: '1px solid #1E2220',
              borderBottom: '1px solid #1E2220',
              padding: '2px 12px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              color: '#2A5070',
              userSelect: 'none',
            }}>
              @@ ···
            </div>
          )}
          <table style={{ borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: isMobile ? '11px' : '12px', lineHeight: '1.8', minWidth: '100%' }}>
            <tbody>
              {hunk.lines.map((line, li) => {
                const isAdded = line.type === 'added'
                const isRemoved = line.type === 'removed'
                return (
                  <tr key={li} style={{ background: isAdded ? 'rgba(0,255,136,0.07)' : isRemoved ? 'rgba(255,34,68,0.07)' : 'transparent' }}>
                    {/* line numbers gutter — single column on mobile */}
                    {!isMobile && (
                      <td style={{
                        width: gutterW, minWidth: gutterW, textAlign: 'right',
                        padding: '0 6px', color: '#2A3530', userSelect: 'none',
                        background: isAdded ? 'rgba(0,255,136,0.04)' : isRemoved ? 'rgba(255,34,68,0.04)' : '#0A0C0B',
                        borderRight: '1px solid #1A2020',
                        fontSize: '10px',
                      }}>
                        {line.lineNo.left ?? ''}
                      </td>
                    )}
                    <td style={{
                      width: gutterW, minWidth: gutterW, textAlign: 'right',
                      padding: '0 6px', color: '#2A3530', userSelect: 'none',
                      background: isAdded ? 'rgba(0,255,136,0.04)' : isRemoved ? 'rgba(255,34,68,0.04)' : '#0A0C0B',
                      borderRight: '1px solid #1A2020',
                      fontSize: '10px',
                    }}>
                      {line.lineNo.right ?? line.lineNo.left ?? ''}
                    </td>
                    {/* +/- prefix */}
                    <td style={{
                      width: 18, minWidth: 18, textAlign: 'center',
                      fontWeight: 700, fontSize: '12px',
                      color: isAdded ? '#00FF88' : isRemoved ? '#FF2244' : 'transparent',
                      userSelect: 'none',
                      borderRight: `2px solid ${isAdded ? '#00FF8828' : isRemoved ? '#FF224428' : 'transparent'}`,
                    }}>
                      {isAdded ? '+' : isRemoved ? '−' : ''}
                    </td>
                    {/* code content — pre for horizontal scroll within the table */}
                    <td style={{
                      padding: '0 12px',
                      color: isAdded ? '#CCFFE8' : isRemoved ? '#FFCCD6' : '#5A7A6A',
                      whiteSpace: 'pre',
                      fontWeight: isAdded || isRemoved ? 500 : 400,
                    }}>
                      {line.content || ' '}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
