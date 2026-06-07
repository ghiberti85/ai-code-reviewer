import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '../../hooks/useHistory'
import type { ReviewResult, Language } from '../../types/review'

const STORAGE_KEY = 'ai-code-reviewer-history'

const mockResult: ReviewResult = {
  score: 75,
  summary: 'Test summary',
  issues: [],
  positives: ['Clean code'],
  refactored: null,
}

function makeResult(score = 75): ReviewResult {
  return { ...mockResult, score }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useHistory', () => {
  it('starts empty when localStorage is empty', () => {
    const { result } = renderHook(() => useHistory())
    expect(result.current.history).toEqual([])
  })

  it('addEntry adds an entry', () => {
    const { result } = renderHook(() => useHistory())
    act(() => {
      result.current.addEntry('const x = 1', 'typescript', makeResult())
    })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].code).toBe('const x = 1')
  })

  it('addEntry returns the entry', () => {
    const { result } = renderHook(() => useHistory())
    let returned: any
    act(() => {
      returned = result.current.addEntry('const x = 1', 'typescript', makeResult())
    })
    expect(returned).toBeDefined()
    expect(returned.code).toBe('const x = 1')
    expect(returned.language).toBe('typescript')
    expect(returned.id).toBeDefined()
    expect(returned.timestamp).toBeDefined()
  })

  it('clearHistory empties the list and localStorage', () => {
    const { result } = renderHook(() => useHistory())
    act(() => {
      result.current.addEntry('code', 'python', makeResult())
    })
    act(() => {
      result.current.clearHistory()
    })
    expect(result.current.history).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('caps at 20 entries (add 21, check length is 20)', () => {
    const { result } = renderHook(() => useHistory())
    act(() => {
      for (let i = 0; i < 21; i++) {
        result.current.addEntry(`code_${i}`, 'javascript', makeResult(i))
      }
    })
    expect(result.current.history).toHaveLength(20)
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useHistory())
    act(() => {
      result.current.addEntry('stored code', 'go', makeResult())
    })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored).toHaveLength(1)
    expect(stored[0].code).toBe('stored code')
  })

  it('loads from localStorage on init', () => {
    const existing = [{
      id: 'test-id',
      timestamp: Date.now(),
      language: 'rust' as Language,
      code: 'fn main() {}',
      result: makeResult(),
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

    const { result } = renderHook(() => useHistory())
    expect(result.current.history).toHaveLength(1)
    expect(result.current.history[0].code).toBe('fn main() {}')
  })
})
