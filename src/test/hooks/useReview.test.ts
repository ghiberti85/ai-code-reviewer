import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReview } from '../../hooks/useReview'
import type { ReviewResult } from '../../types/review'

const validResult: ReviewResult = {
  score: 80,
  summary: 'Good code',
  issues: [],
  positives: ['Clean'],
  refactored: null,
}

function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useReview', () => {
  it('initial state is idle', () => {
    const { result } = renderHook(() => useReview())
    expect(result.current.status).toBe('idle')
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('runReview sets status to streaming immediately', async () => {
    let resolveStream!: () => void
    const streamPromise = new Promise<void>(res => { resolveStream = res })

    const mockStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamPromise.then(() => {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(validResult)))
          controller.close()
        })
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    }))

    const { result } = renderHook(() => useReview())
    act(() => {
      result.current.runReview('const x = 1', 'typescript')
    })
    expect(result.current.status).toBe('streaming')
    resolveStream()
  })

  it('on successful fetch → status becomes done and result is parsed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: makeStream(JSON.stringify(validResult)),
    }))

    const { result } = renderHook(() => useReview())
    await act(async () => {
      await result.current.runReview('const x = 1', 'typescript')
    })
    expect(result.current.status).toBe('done')
    expect(result.current.result?.score).toBe(80)
  })

  it('on fetch error → status becomes error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
    }))

    const { result } = renderHook(() => useReview())
    await act(async () => {
      await result.current.runReview('bad code', 'python')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()
  })

  it('on fetch rejection → status becomes error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { result } = renderHook(() => useReview())
    await act(async () => {
      await result.current.runReview('code', 'javascript')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('Network error')
  })

  it('loadResult sets status to done', () => {
    const { result } = renderHook(() => useReview())
    act(() => {
      result.current.loadResult(validResult)
    })
    expect(result.current.status).toBe('done')
    expect(result.current.result).toEqual(validResult)
  })

  it('reset sets status back to idle', () => {
    const { result } = renderHook(() => useReview())
    act(() => {
      result.current.loadResult(validResult)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.result).toBeNull()
  })
})
