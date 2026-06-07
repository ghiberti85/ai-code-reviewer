import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ScoreBadge } from '../../components/Review/ScoreBadge'

vi.mock('framer-motion', () => {
  const controls = { start: vi.fn() }
  return {
    motion: {
      circle: (props: any) => <circle {...props} />,
      text: ({ children, ...props }: any) => <text {...props}>{children}</text>,
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => controls,
  }
})

describe('ScoreBadge', () => {
  it('renders Quality Score label', () => {
    render(<ScoreBadge score={75} />)
    expect(screen.getByText('Quality Score')).toBeInTheDocument()
  })

  it('counts up and eventually shows the final score', async () => {
    vi.useFakeTimers()
    render(<ScoreBadge score={75} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    expect(screen.getByText('75')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('uses green color (#00FF88) for score >= 90 once counted up', async () => {
    vi.useFakeTimers()
    const { container } = render(<ScoreBadge score={95} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#00FF88')
    vi.useRealTimers()
  })

  it('uses yellow color (#FFD700) for score 50-69 once counted up', async () => {
    vi.useFakeTimers()
    const { container } = render(<ScoreBadge score={60} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FFD700')
    vi.useRealTimers()
  })

  it('uses red color (#FF2244) for score < 30 once counted up', async () => {
    vi.useFakeTimers()
    const { container } = render(<ScoreBadge score={20} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FF2244')
    vi.useRealTimers()
  })

  it('uses lime color (#88FF00) for score 70-89 once counted up', async () => {
    vi.useFakeTimers()
    const { container } = render(<ScoreBadge score={80} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#88FF00')
    vi.useRealTimers()
  })

  it('uses orange color (#FF8800) for score 30-49 once counted up', async () => {
    vi.useFakeTimers()
    const { container } = render(<ScoreBadge score={40} />)
    await act(async () => { vi.advanceTimersByTime(1100) })
    const textEl = container.querySelector('text')
    expect(textEl).toHaveAttribute('fill', '#FF8800')
    vi.useRealTimers()
  })
})
