import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  score: number
  language: string
}

function getColor(score: number) {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#88FF00'
  if (score >= 50) return '#FFD700'
  if (score >= 30) return '#FF8800'
  return '#FF2244'
}

export function EmbedBadge({ score, language }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const color = getColor(score)

  const svgBadge = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28" viewBox="0 0 160 28">
  <rect width="160" height="28" rx="6" fill="#141716"/>
  <rect width="80" height="28" rx="6" fill="#1E2220"/>
  <text x="8" y="18" font-family="monospace" font-size="11" fill="#8A9E95">AI Review</text>
  <text x="88" y="18" font-family="monospace" font-size="11" font-weight="bold" fill="${color}">${score}/100 ${language}</text>
</svg>`

  const markdownSnippet = `![AI Code Review Score](https://img.shields.io/badge/AI%20Review-${score}%2F100-${color.replace('#', '')}?style=flat&logo=data:image/svg+xml;base64,${btoa(svgBadge)})`

  const htmlSnippet = `<img src="data:image/svg+xml;base64,${btoa(svgBadge)}" alt="AI Code Review: ${score}/100" />`

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent',
          border: '1px solid #2A3530',
          color: '#8A9E95',
          borderRadius: '4px',
          padding: '4px 10px',
          cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          transition: 'all 0.15s',
        }}
      >
        {'<>'} Embed
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: '#141716',
              border: '1px solid #1E2220',
              borderRadius: '8px',
              padding: '16px',
              width: '340px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#00FF88', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Embed Badge
            </div>

            {/* Preview */}
            <div style={{ background: '#0D0F0E', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#141716', border: `1px solid ${color}33`, borderRadius: '6px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color }}>⬡ {score}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#8A9E95' }}>{language}</span>
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '11px', color: '#8A9E95' }}>AI Code Review</span>
            </div>

            {/* HTML */}
            <SnippetRow label="HTML" code={htmlSnippet} onCopy={() => copy(htmlSnippet)} copied={copied} />

            {/* Markdown */}
            <SnippetRow label="Markdown" code={markdownSnippet} onCopy={() => copy(markdownSnippet)} copied={copied} />

            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: '#8A9E95', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', textAlign: 'right' }}>
              close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SnippetRow({ label, code, onCopy, copied }: { label: string; code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#8A9E95' }}>{label}</span>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
        <pre style={{ margin: 0, flex: 1, background: '#0D0F0E', borderRadius: '4px', padding: '6px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#D4E8DC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code}
        </pre>
        <button onClick={onCopy} style={{ background: 'transparent', border: '1px solid #2A3530', color: copied ? '#00FF88' : '#8A9E95', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', flexShrink: 0 }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
