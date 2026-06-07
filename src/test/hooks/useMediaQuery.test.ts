import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

function makeMockMQ(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mq = {
    matches,
    addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.push(handler)
    }),
    removeEventListener: vi.fn(),
    _trigger(newMatches: boolean) {
      for (const fn of listeners) {
        fn({ matches: newMatches } as MediaQueryListEvent)
      }
    },
  }
  return mq
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns true when media query matches', () => {
    const mq = makeMockMQ(true)
    vi.stubGlobal('window', { ...window, matchMedia: vi.fn().mockReturnValue(mq) })

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('returns false when media query does not match', () => {
    const mq = makeMockMQ(false)
    vi.stubGlobal('window', { ...window, matchMedia: vi.fn().mockReturnValue(mq) })

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when media query match changes', () => {
    const mq = makeMockMQ(false)
    vi.stubGlobal('window', { ...window, matchMedia: vi.fn().mockReturnValue(mq) })

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => {
      mq._trigger(true)
    })
    expect(result.current).toBe(true)
  })
})
