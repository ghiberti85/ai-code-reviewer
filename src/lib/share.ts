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
    return JSON.parse(json) as SharePayload
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
