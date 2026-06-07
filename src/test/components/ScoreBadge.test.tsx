import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreBadge } from '../../components/Review/ScoreBadge'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    circle: (props: any) => <circle {...props} />,
    text: ({ children, ...props }: any) => <text {...props}>{children}</text>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}))

describe('ScoreBadge', () => {
  it('renders score number', () => {
    render(<ScoreBadge score={75} />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('uses green color (#00FF88) for score >= 90', () => {
    const { container } = render(<ScoreBadge score={95} />)
    // The score text element should have green fill
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#00FF88')
  })

  it('uses yellow color (#FFD700) for score 50-69', () => {
    const { container } = render(<ScoreBadge score={60} />)
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FFD700')
  })

  it('uses red color (#FF2244) for score < 30', () => {
    const { container } = render(<ScoreBadge score={20} />)
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FF2244')
  })

  it('renders Quality Score label', () => {
    render(<ScoreBadge score={50} />)
    expect(screen.getByText('Quality Score')).toBeInTheDocument()
  })

  it('uses lime color (#88FF00) for score 70-89', () => {
    const { container } = render(<ScoreBadge score={80} />)
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#88FF00')
  })

  it('uses orange color (#FF8800) for score 30-49', () => {
    const { container } = render(<ScoreBadge score={40} />)
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FF8800')
  })
})
