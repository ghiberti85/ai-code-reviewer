import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test validation logic by importing the handler directly.
// The edge runtime 'config' export is just an object — harmless in Node.

async function importHandler() {
  // Reset module cache to allow env changes to take effect
  const mod = await import('../.././../api/review')
  return mod.default
}

function makeRequest(method: string, body?: object): Request {
  if (method === 'GET') {
    return new Request('http://localhost/api/review', { method: 'GET' })
  }
  return new Request('http://localhost/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('api/review handler', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns 405 for GET requests', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    const handler = await importHandler()
    const res = await handler(makeRequest('GET'))
    expect(res.status).toBe(405)
  })

  it('returns 500 if GROQ_API_KEY not set', async () => {
    delete process.env.GROQ_API_KEY
    // Need fresh import without key — use dynamic reimport trick
    vi.resetModules()
    const mod = await import('../../../api/review')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'typescript' }))
    expect(res.status).toBe(500)
  })

  it('returns 400 for empty code', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/review')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: '', language: 'typescript' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No code provided/i)
  })

  it('returns 400 for code > 50KB', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/review')
    const handler = mod.default
    const bigCode = 'x'.repeat(50_001)
    const res = await handler(makeRequest('POST', { code: bigCode, language: 'typescript' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/50KB/i)
  })

  it('returns 400 for invalid language', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/review')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'brainfuck' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid language/i)
  })

  it('proxies to Groq and streams response on valid request', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()

    // Mock fetch for Groq API
    const sseChunk = 'data: {"choices":[{"delta":{"content":"{"}}]}\n\ndata: [DONE]\n\n'
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseChunk))
        controller.close()
      },
    })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockStream,
    }))

    const mod = await import('../../../api/review')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'typescript' }))
    expect(res.status).toBe(200)
  })
})
