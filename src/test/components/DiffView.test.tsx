import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffView } from '../../components/Review/DiffView'

// Shiki uses dynamic imports and WASM — stub it out entirely
vi.mock('shiki', () => ({
  createHighlighter: vi.fn().mockResolvedValue({
    codeToHtml: (code: string) => `<pre>${code}</pre>`,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const original = 'const x = 1\nconst y = 2'
const refactored = 'const x = 1\nconst y = 3'

describe('DiffView', () => {
  it('renders diff toolbar with added/removed counts', () => {
    render(
      <DiffView original={original} refactored={refactored} language="javascript" forceMobile={false} />
    )
    expect(screen.getByText(/Diff/i)).toBeInTheDocument()
    expect(screen.getByText(/\+1/)).toBeInTheDocument()
    expect(screen.getByText(/−1/)).toBeInTheDocument()
  })

  it('renders split and unified toggle buttons on desktop', () => {
    render(
      <DiffView original={original} refactored={refactored} language="javascript" forceMobile={false} />
    )
    expect(screen.getByText('split')).toBeInTheDocument()
    expect(screen.getByText('unified')).toBeInTheDocument()
  })

  it('does not render split/unified buttons on mobile', () => {
    render(
      <DiffView original={original} refactored={refactored} language="javascript" forceMobile />
    )
    expect(screen.queryByText('split')).not.toBeInTheDocument()
    expect(screen.queryByText('unified')).not.toBeInTheDocument()
  })

  it('shows 0 added and 0 removed for identical code', () => {
    render(
      <DiffView original="const x = 1" refactored="const x = 1" language="typescript" forceMobile={false} />
    )
    expect(screen.getByText('+0')).toBeInTheDocument()
    expect(screen.getByText('−0')).toBeInTheDocument()
  })

  it('renders Copy button on desktop', () => {
    render(
      <DiffView original={original} refactored={refactored} language="python" forceMobile={false} />
    )
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })
})
