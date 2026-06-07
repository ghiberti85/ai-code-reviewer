import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Issue } from '../../types/review'

const SEVERITY_CONFIG = {
  error: { color: '#FF2244', bg: 'rgba(255,34,68,0.08)', label: 'ERROR', icon: '✕' },
  warning: { color: '#FFD700', bg: 'rgba(255,215,0,0.08)', label: 'WARN', icon: '⚠' },
  suggestion: { color: '#00FF88', bg: 'rgba(0,255,136,0.08)', label: 'HINT', icon: '→' },
}

interface Props {
  issue: Issue
  index: number
}

export function IssueCard({ issue, index }: Props) {
  const cfg = SEVERITY_CONFIG[issue.severity]
  const [copied, setCopied] = useState(false)

  async function handleCopyFix() {
    await navigator.clipboard.writeText(issue.fix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.color}22`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '6px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: cfg.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700 }}>
          {cfg.icon} {cfg.label}
        </span>
        {issue.line !== null && (
          <span style={{ color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' }}>
            line {issue.line}
          </span>
        )}
      </div>
      <p style={{ margin: 0, color: '#D4E8DC', fontFamily: 'Syne, sans-serif', fontSize: '14px' }}>
        {issue.message}
      </p>
      <button
        onClick={handleCopyFix}
        title="Click to copy fix"
        style={{
          background: copied ? 'rgba(0,255,136,0.08)' : '#0D0F0E',
          border: copied ? '1px solid #00FF8844' : '1px solid transparent',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          width: '100%',
        }}
      >
        <span style={{ color: '#8A9E95', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', flexShrink: 0, paddingTop: '1px' }}>
          {copied ? '✓ copied' : 'fix →'}
        </span>
        <span style={{ color: copied ? '#00FF88' : '#00FF88', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', whiteSpace: 'pre-wrap', flex: 1 }}>
          {issue.fix}
        </span>
      </button>
    </motion.div>
  )
}
