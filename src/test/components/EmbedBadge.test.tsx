import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EmbedBadge } from '../../components/EmbedBadge'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  writeText.mockClear()
  ;(navigator.clipboard as any).writeText = writeText
})

describe('EmbedBadge', () => {
  it('renders the embed button', () => {
    render(<EmbedBadge score={85} language="typescript" />)
    expect(screen.getByRole('button', { name: /<> Embed/i })).toBeInTheDocument()
  })

  it('panel is hidden by default', () => {
    render(<EmbedBadge score={85} language="typescript" />)
    expect(screen.queryByText('Embed Badge')).toBeNull()
  })

  it('opens panel when embed button is clicked', () => {
    render(<EmbedBadge score={85} language="typescript" />)
    fireEvent.click(screen.getByRole('button', { name: /<> Embed/i }))
    expect(screen.getByText('Embed Badge')).toBeInTheDocument()
  })

  it('shows HTML and Markdown labels when open', () => {
    render(<EmbedBadge score={85} language="typescript" />)
    fireEvent.click(screen.getByRole('button', { name: /<> Embed/i }))
    expect(screen.getByText('HTML')).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
  })

  it('closes panel when close button is clicked', () => {
    render(<EmbedBadge score={85} language="typescript" />)
    fireEvent.click(screen.getByRole('button', { name: /<> Embed/i }))
    expect(screen.getByText('Embed Badge')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Embed Badge')).toBeNull()
  })

  it('copies HTML snippet and shows checkmark on copy click', async () => {
    render(<EmbedBadge score={85} language="typescript" />)
    fireEvent.click(screen.getByRole('button', { name: /<> Embed/i }))

    const copyButtons = screen.getAllByRole('button', { name: /^Copy$/ })
    await act(async () => { fireEvent.click(copyButtons[0]) })

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
  })

  it('displays score in the preview panel', () => {
    render(<EmbedBadge score={75} language="python" />)
    fireEvent.click(screen.getByRole('button', { name: /<> Embed/i }))
    expect(screen.getByText(/⬡ 75/)).toBeInTheDocument()
  })
})
