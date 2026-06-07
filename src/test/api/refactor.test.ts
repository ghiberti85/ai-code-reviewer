import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

function makeRequest(method: string, body?: object): Request {
  if (method === 'GET') {
    return new Request('http://localhost/api/refactor', { method: 'GET' })
  }
  return new Request('http://localhost/api/refactor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('api/refactor handler', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns 405 for GET requests', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('GET'))
    expect(res.status).toBe(405)
  })

  it('returns 500 when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'typescript' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/misconfigured/i)
  })

  it('returns 400 for missing code', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { language: 'typescript' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No code provided/i)
  })

  it('returns 400 for empty code', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: '   ', language: 'typescript' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No code provided/i)
  })

  it('returns 400 for code exceeding 50KB', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const bigCode = 'x'.repeat(50_001)
    const res = await handler(makeRequest('POST', { code: bigCode, language: 'typescript' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/exceed|50KB|maximum/i)
  })

  it('returns 400 for invalid language', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'brainfuck' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid language/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()
    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const req = new Request('http://localhost/api/refactor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Invalid JSON/i)
  })

  it('happy path: valid request streams response', async () => {
    process.env.GROQ_API_KEY = 'test-key'
    vi.resetModules()

    const sseChunk = 'data: {"choices":[{"delta":{"content":"{\\"refactored\\":\\"const x = 1\\"}"}}]}\n\ndata: [DONE]\n\n'
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

    const mod = await import('../../../api/refactor')
    const handler = mod.default
    const res = await handler(makeRequest('POST', { code: 'const x = 1', language: 'typescript', issues: [] }))
    expect(res.status).toBe(200)
  })
})
