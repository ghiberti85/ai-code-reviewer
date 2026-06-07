import { useState, useCallback } from 'react'
import type { ReviewResult, Language } from '../types/review'

interface ReviewState {
  status: 'idle' | 'streaming' | 'done' | 'error'
  result: ReviewResult | null
  raw: string
  error: string | null
}

export function useReview() {
  const [state, setState] = useState<ReviewState>({
    status: 'idle',
    result: null,
    raw: '',
    error: null,
  })

  const runReview = useCallback(async (code: string, language: Language) => {
    setState({ status: 'streaming', result: null, raw: '', error: null })

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setState(prev => ({ ...prev, raw: accumulated }))
      }

      let result: ReviewResult
      try {
        const parsed = JSON.parse(accumulated)
        if (
          typeof parsed.score !== 'number' ||
          typeof parsed.summary !== 'string' ||
          !Array.isArray(parsed.issues) ||
          !Array.isArray(parsed.positives)
        ) {
          throw new Error('Invalid response schema')
        }
        result = parsed as ReviewResult
      } catch {
        throw new Error('Failed to parse review response')
      }
      setState({ status: 'done', result, raw: accumulated, error: null })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState(prev => ({ ...prev, status: 'error', error: message }))
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, raw: '', error: null })
  }, [])

  const loadResult = useCallback((result: ReviewResult) => {
    setState({ status: 'done', result, raw: JSON.stringify(result), error: null })
  }, [])

  return { ...state, runReview, reset, loadResult }
}
