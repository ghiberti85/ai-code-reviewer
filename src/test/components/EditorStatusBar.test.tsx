import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Language } from '../../types/review'

// Local replica of the EditorStatusBar component from App.tsx for isolated testing.
// Keep in sync with src/App.tsx if the component's logic changes.
function EditorStatusBar({ code, language }: { code: string; language: Language }) {
  const lines = code ? code.split('\n').length : 0
  const bytes = new TextEncoder().encode(code).length
  const kb = (bytes / 1024).toFixed(1)
  const nearLimit = bytes > 45_000
  const overLimit = bytes > 50_000

  return (
    <div>
      <span data-testid="lines">
        {lines} {lines === 1 ? 'line' : 'lines'}
      </span>
      <span
        data-testid="kb"
        style={{ color: overLimit ? '#FF2244' : nearLimit ? '#FFD700' : '#8A9E95' }}
      >
        {kb} KB{nearLimit ? ' ⚠' : ''}
      </span>
      <span data-testid="language">{language}</span>
    </div>
  )
}

describe('EditorStatusBar', () => {
  it('shows 0 lines for empty string', () => {
    render(<EditorStatusBar code="" language="javascript" />)
    expect(screen.getByTestId('lines').textContent).toBe('0 lines')
  })

  it('shows singular "line" for single-line code', () => {
    render(<EditorStatusBar code="const x = 1" language="javascript" />)
    expect(screen.getByTestId('lines').textContent).toBe('1 line')
  })

  it('shows correct line count for multi-line code', () => {
    const code = 'line1\nline2\nline3'
    render(<EditorStatusBar code={code} language="javascript" />)
    expect(screen.getByTestId('lines').textContent).toBe('3 lines')
  })

  it('shows KB size', () => {
    const code = 'hello'
    render(<EditorStatusBar code={code} language="python" />)
    const kb = (new TextEncoder().encode(code).length / 1024).toFixed(1)
    expect(screen.getByTestId('kb').textContent).toContain(`${kb} KB`)
  })

  it('shows the language', () => {
    render(<EditorStatusBar code="x = 1" language="python" />)
    expect(screen.getByTestId('language').textContent).toBe('python')
  })

  it('uses muted color when under 45KB', () => {
    render(<EditorStatusBar code="short code" language="javascript" />)
    const el = screen.getByTestId('kb')
    expect(el).toHaveStyle({ color: '#8A9E95' })
  })

  it('shows warning ⚠ and yellow color when code is between 45KB and 50KB', () => {
    // ~46KB of ASCII chars
    const code = 'a'.repeat(46_000)
    render(<EditorStatusBar code={code} language="typescript" />)
    const el = screen.getByTestId('kb')
    expect(el.textContent).toContain('⚠')
    expect(el).toHaveStyle({ color: '#FFD700' })
  })

  it('uses red color when code exceeds 50KB', () => {
    const code = 'a'.repeat(51_000)
    render(<EditorStatusBar code={code} language="typescript" />)
    const el = screen.getByTestId('kb')
    expect(el).toHaveStyle({ color: '#FF2244' })
  })
})
