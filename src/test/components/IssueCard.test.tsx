import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IssueCard } from '../../components/Review/IssueCard'
import type { Issue } from '../../types/review'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

const baseIssue: Issue = {
  line: null,
  severity: 'warning',
  message: 'Use strict equality',
  fix: 'Replace == with ===',
}

describe('IssueCard', () => {
  it('renders message', () => {
    render(<IssueCard issue={baseIssue} index={0} />)
    expect(screen.getByText('Use strict equality')).toBeInTheDocument()
  })

  it('renders ERROR label for severity error', () => {
    render(<IssueCard issue={{ ...baseIssue, severity: 'error' }} index={0} />)
    expect(screen.getByText(/ERROR/)).toBeInTheDocument()
  })

  it('renders WARN label for severity warning', () => {
    render(<IssueCard issue={{ ...baseIssue, severity: 'warning' }} index={0} />)
    expect(screen.getByText(/WARN/)).toBeInTheDocument()
  })

  it('renders HINT label for suggestion', () => {
    render(<IssueCard issue={{ ...baseIssue, severity: 'suggestion' }} index={0} />)
    expect(screen.getByText(/HINT/)).toBeInTheDocument()
  })

  it('renders line number when present', () => {
    render(<IssueCard issue={{ ...baseIssue, line: 42 }} index={0} />)
    expect(screen.getByText('line 42')).toBeInTheDocument()
  })

  it('does not render line number when null', () => {
    render(<IssueCard issue={{ ...baseIssue, line: null }} index={0} />)
    expect(screen.queryByText(/^line /)).toBeNull()
  })

  it('renders fix text', () => {
    render(<IssueCard issue={baseIssue} index={0} />)
    expect(screen.getByText('Replace == with ===')).toBeInTheDocument()
  })
})
