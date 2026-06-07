import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { createHighlighter, type Highlighter } from 'shiki'
import type { Language } from '../../types/review'
import { LANGUAGES } from '../../lib/groq'

interface Props {
  original: string
  refactored: string
  language: Language
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

const LINE_BG: Record<DiffLine['type'], string> = {
  added: 'rgba(0,255,136,0.08)',
  removed: 'rgba(255,34,68,0.08)',
  unchanged: 'transparent',
}
const LINE_BORDER: Record<DiffLine['type'], string> = {
  added: 'rgba(0,255,136,0.3)',
  removed: 'rgba(255,34,68,0.3)',
  unchanged: 'transparent',
}
const LINE_PREFIX: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
}
const PREFIX_COLOR: Record<DiffLine['type'], string> = {
  added: '#00FF88',
  removed: '#FF2244',
  unchanged: '#2A3530',
}

export function DiffView({ original, refactored, language }: Props) {
  const [mode, setMode] = useState<DiffMode>('split')
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
    await navigator.clipboard.writeText(refactored)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const addedCount = diffLines.filter(l => l.type === 'added').length
  const removedCount = diffLines.filter(l => l.type === 'removed').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0', border: '1px solid #1E2220', borderRadius: '10px', overflow: 'hidden' }}
    >
      {/* toolbar */}
      <div style={{ background: '#141716', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #1E2220' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#00FF88', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Diff
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88' }}>+{addedCount}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#FF2244' }}>−{removedCount}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {(['split', 'unified'] as DiffMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                background: mode === m ? '#00FF881A' : 'transparent',
                color: mode === m ? '#00FF88' : '#8A9E95',
                border: '1px solid ' + (mode === m ? '#00FF8844' : '#2A3530'),
                borderRadius: '4px',
                padding: '3px 10px',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                textTransform: 'capitalize',
              }}
            >
              {m}
            </button>
          ))}
          <button
            onClick={copy}
            style={{ background: 'transparent', border: '1px solid #2A3530', color: '#8A9E95', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', marginLeft: '4px' }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {mode === 'split' ? (
        <SplitView leftHtml={leftHtml} rightHtml={rightHtml} />
      ) : (
        <UnifiedView diffLines={diffLines} />
      )}
    </motion.div>
  )
}

function SplitView({ leftHtml, rightHtml }: { leftHtml: string; rightHtml: string }) {
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
          style={{ overflow: 'auto', maxHeight: '420px', fontSize: '12px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: leftHtml }}
        />
      </div>
      <div>
        <div style={{ padding: '6px 12px', background: 'rgba(0,255,136,0.06)', borderBottom: '1px solid #1E2220' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00FF88' }}>+ refactored</span>
        </div>
        <div
          style={{ overflow: 'auto', maxHeight: '420px', fontSize: '12px', lineHeight: '1.7' }}
          dangerouslySetInnerHTML={{ __html: rightHtml }}
        />
      </div>
    </div>
  )
}

function UnifiedView({ diffLines }: { diffLines: DiffLine[] }) {
  return (
    <div style={{ overflow: 'auto', maxHeight: '480px', background: '#0D0F0E' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: '1.7' }}>
        <tbody>
          {diffLines.map((line, i) => (
            <tr key={i} style={{ background: LINE_BG[line.type], borderLeft: `3px solid ${LINE_BORDER[line.type]}` }}>
              <td style={{ width: 36, textAlign: 'right', padding: '0 8px', color: '#2A3530', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {line.lineNo.left ?? ''}
              </td>
              <td style={{ width: 36, textAlign: 'right', padding: '0 8px', color: '#2A3530', userSelect: 'none', whiteSpace: 'nowrap' }}>
                {line.lineNo.right ?? ''}
              </td>
              <td style={{ width: 16, textAlign: 'center', color: PREFIX_COLOR[line.type], userSelect: 'none' }}>
                {LINE_PREFIX[line.type]}
              </td>
              <td style={{ padding: '0 12px', color: '#D4E8DC', whiteSpace: 'pre' }}>
                {line.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
