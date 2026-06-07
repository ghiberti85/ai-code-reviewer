import type { ReviewResult, Language } from '../types/review'

interface SharePayload {
  code: string
  language: Language
  result: ReviewResult
}

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
  return btoa(binary)
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)
    // Runtime schema validation — reject malformed share payloads that could
    // cause rendering errors or pass unexpected values to child components.
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.code !== 'string' ||
      typeof parsed.language !== 'string' ||
      parsed.result === null ||
      typeof parsed.result !== 'object' ||
      typeof parsed.result.score !== 'number' ||
      typeof parsed.result.summary !== 'string' ||
      !Array.isArray(parsed.result.issues) ||
      !Array.isArray(parsed.result.positives)
    ) {
      return null
    }
    return parsed as SharePayload
  } catch {
    return null
  }
}

export function buildShareUrl(payload: SharePayload): string {
  const encoded = encodeShare(payload)
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('r', encoded)
  return url.toString()
}

export function readShareFromUrl(): SharePayload | null {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('r')
  if (!encoded) return null
  return decodeShare(encoded)
}
