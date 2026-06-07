import { useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Language } from '../types/review'

const EXT_TO_LANG: Record<string, Language> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  css: 'css', scss: 'css',
  sql: 'sql',
}

const MAX_FILE_SIZE = 50_000

interface Props {
  onLoad: (code: string, language: Language) => void
}

export function FileDropZone({ onLoad }: Props) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    setError(null)
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large (max 50KB)')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const lang: Language = EXT_TO_LANG[ext] ?? 'javascript'
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result
      if (typeof text === 'string') onLoad(text, lang)
    }
    reader.readAsText(file)
  }, [onLoad])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  return (
    <div style={{ position: 'relative' }}>
      <motion.div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        animate={{ borderColor: dragging ? '#00FF88' : '#2A3530', background: dragging ? 'rgba(0,255,136,0.04)' : 'transparent' }}
        style={{
          border: '1px dashed #2A3530',
          borderRadius: '6px',
          padding: '6px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          color: '#8A9E95',
          userSelect: 'none',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: '13px' }}>↑</span>
        Upload file
      </motion.div>
      <input ref={inputRef} type="file" accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.cs,.css,.scss,.sql" onChange={onFileInput} style={{ display: 'none' }} />
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', background: 'rgba(255,34,68,0.1)', border: '1px solid #FF224433', borderRadius: '4px', padding: '4px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#FF2244', whiteSpace: 'nowrap', zIndex: 10 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
