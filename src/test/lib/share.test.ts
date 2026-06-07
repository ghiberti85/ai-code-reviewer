import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare, buildShareUrl } from '../../lib/share'
import type { ReviewResult, Language } from '../../types/review'

const mockResult: ReviewResult = {
  score: 85,
  summary: 'Good code with minor issues',
  issues: [{ line: 1, severity: 'warning', message: 'Use const', fix: 'const x = 1' }],
  positives: ['Good naming'],
  refactored: null,
}

const mockPayload = {
  code: 'let x = 1',
  language: 'typescript' as Language,
  result: mockResult,
}

describe('encodeShare / decodeShare', () => {
  it('roundtrip preserves data', () => {
    const encoded = encodeShare(mockPayload)
    const decoded = decodeShare(encoded)
    expect(decoded).toEqual(mockPayload)
  })

  it('decodeShare returns null on invalid input', () => {
    expect(decodeShare('!!!not-base64!!!')).toBeNull()
  })

  it('decodeShare returns null on valid base64 but invalid JSON', () => {
    const bad = btoa('this is not json')
    expect(decodeShare(bad)).toBeNull()
  })

  it('buildShareUrl includes ?r= param', () => {
    const url = buildShareUrl(mockPayload)
    expect(url).toContain('?r=')
  })

  it('buildShareUrl encodes payload that decodes correctly', () => {
    const url = buildShareUrl(mockPayload)
    const paramValue = new URL(url).searchParams.get('r')!
    expect(decodeShare(paramValue)).toEqual(mockPayload)
  })
})
