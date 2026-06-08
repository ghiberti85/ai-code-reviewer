import { useState, useCallback } from 'react'
import type { ReviewResult, Issue, Language } from '../types/review'

interface ReviewState {
  status: 'idle' | 'streaming' | 'refactoring' | 're-reviewing' | 'done' | 'error'
  result: ReviewResult | null
  raw: string
  error: string | null
}

async function streamToString(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const decoder = new TextDecoder()
  let accumulated = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    accumulated += decoder.decode(value, { stream: true })
  }
  return accumulated
}

function calcScore(issues: Array<{ severity: string }>): number {
  const penalty = issues.reduce((sum, i) => {
    if (i.severity === 'error') return sum + 13
    if (i.severity === 'warning') return sum + 7
    return sum + 2
  }, 0)
  return Math.max(10, 95 - penalty)
}

async function fetchReview(code: string, language: string): Promise<{ raw: string; result: ReviewResult } | null> {
  let res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language }),
  })
  if (res.status === 502) {
    await new Promise(r => setTimeout(r, 2500))
    res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language }),
    })
  }
  if (!res.ok) return null

  const raw = await streamToString(res)
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.issues) || !Array.isArray(parsed.positives)) {
      return null
    }
    if (typeof parsed.refactored === 'string') {
      parsed.refactored = parsed.refactored.replace(/\\n/g, '\n').replace(/\\t/g, '  ')
    }
    parsed.score = calcScore(parsed.issues as Array<{ severity: string }>)
    return { raw, result: parsed as ReviewResult }
  } catch {
    return null
  }
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
      // ── Step 1: stream the review of the original code ──────────────────
      let res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })
      if (res.status === 502) {
        await new Promise(r => setTimeout(r, 2500))
        res = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        const groqStatus = body.groq_status as number | undefined
        if (groqStatus === 429) throw new Error('Rate limit reached — wait a few seconds and try again')
        throw new Error('Analysis failed — please try again')
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
        if (typeof parsed.summary !== 'string' || !Array.isArray(parsed.issues) || !Array.isArray(parsed.positives)) {
          throw new Error('Invalid response schema')
        }
        if (typeof parsed.refactored === 'string') {
          parsed.refactored = parsed.refactored.replace(/\\n/g, '\n').replace(/\\t/g, '  ')
        }
        parsed.score = calcScore(parsed.issues as Array<{ severity: string }>)
        result = parsed as ReviewResult
      } catch {
        throw new Error('Failed to parse review response')
      }

      // ── Step 2: generate refactored code if score < 90 ──────────────────
      if (result.score < 90 && !result.refactored) {
        setState({ status: 'refactoring', result, raw: accumulated, error: null })

        try {
          let refactorRes = await fetch('/api/refactor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language, issues: result.issues, summary: result.summary, score: result.score }),
          })
          if (refactorRes.status === 502) {
            await new Promise(r => setTimeout(r, 2500))
            refactorRes = await fetch('/api/refactor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code, language, issues: result.issues, summary: result.summary, score: result.score }),
            })
          }

          if (refactorRes.ok) {
            const refactorRaw = await streamToString(refactorRes)
            const parsed = JSON.parse(refactorRaw)
            if (typeof parsed.refactored === 'string' && parsed.refactored.trim()) {
              const normalized = parsed.refactored.replace(/\\n/g, '\n').replace(/\\t/g, '  ')
              result = { ...result, refactored: normalized }
            }
          }
        } catch {
          // refactor failed — show result without refactored code
        }
      }

      // ── Step 3: re-review the refactored code to get its real score ──────
      if (result.refactored) {
        setState({ status: 're-reviewing', result, raw: accumulated, error: null })

        try {
          const reReview = await fetchReview(result.refactored, language)
          if (reReview) {
            result = {
              ...result,
              refactoredScore: reReview.result.score,
              refactoredIssues: reReview.result.issues as Issue[],
            }
          }
        } catch {
          // re-review failed — show result without refactoredScore
        }
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
