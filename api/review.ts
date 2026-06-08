export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const SYSTEM_PROMPT = `You are a senior staff engineer doing a code review. Return a single JSON object:

{
  "score": <integer 0-100>,
  "summary": "<2-3 sentences on overall quality>",
  "issues": [{ "line": <number|null>, "severity": "error"|"warning"|"suggestion", "message": "<problem>", "fix": "<code snippet>" }],
  "positives": ["<specific strength>"],
  "refactored": "<complete rewrite, or null if score >= 90>"
}

══════════════════════════════════════════════════════════
STEP 1 — COUNT VIOLATIONS (required before setting score)
══════════════════════════════════════════════════════════

Evaluate each item. Mark VIOLATED only if the code CLEARLY and ACTUALLY breaks it.
When in doubt → NOT a violation. Vague concerns are not violations.

  A. Modern syntax — VIOLATED only if: uses "var", or old-style syntax when modern is clearly available
  B. Async error handling — VIOLATED only if: a Promise/async call has NO .catch() and NO try/catch at all
  C. No global mutable state — VIOLATED only if: module-level variables are mutated inside functions
  D. No deprecated patterns — VIOLATED only if: uses == instead of ===, or 3+ levels of callback nesting
  E. Clear function names — VIOLATED only if: function names are single letters or meaningless (x, foo, temp, data)
  F. No silent failures — VIOLATED only if: catch block is completely empty: catch(e) {} with zero handling
  G. Edge cases handled — VIOLATED only if: code would throw a TypeError/crash on a clearly expected input

══════════════════════════════════════════════════════════
STEP 2 — SET SCORE (mandatory — must match violation count)
══════════════════════════════════════════════════════════

  0 violations → score 90–100
  1 violation  → score 75–89
  2 violations → score 55–74
  3 violations → score 35–54
  4+ violations → score 10–34

HARD RULES — no exceptions:
  • Score MUST fall in the range for your violation count. 1 violation = 75–89, not 60.
  • Score 40–69 is only valid with 2+ confirmed violations from the list above.
  • 0 violations = score 90 or higher. Period. Do not invent issues.
  • Do NOT give a low score because code "could be better" — only actual violations count.

══════════════════════════════════════════════════════════
FORBIDDEN — never report, never deduct points
══════════════════════════════════════════════════════════

  ✗ Missing TypeScript types (JS code is reviewed as JS)
  ✗ Missing unit tests
  ✗ Missing comments or JSDoc
  ✗ "Could be more modular" without a concrete bug
  ✗ Naming style preferences (camelCase vs snake_case, etc.)
  ✗ Hypothetical future requirements
  ✗ Code that works correctly and passes the checklist

══════════════════════════════════════════════════════════
REFACTORED FIELD
══════════════════════════════════════════════════════════

  • score 0–89: provide a complete, runnable rewrite — NO truncation, NO "// rest of code", NO ellipsis
  • score 90–100: set refactored to null
  • The rewrite must fix every listed issue and deserve 90+ if reviewed fresh

IMPORTANT: Return ONLY valid JSON. No markdown fences, no prose outside the JSON object.`

function buildUserPrompt(code: string, language: string): string {
  return `Review this ${language} code:\n\n${code}`
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not set')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { code?: unknown; language?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { code, language } = body

  if (typeof code !== 'string' || !code.trim()) {
    return new Response(JSON.stringify({ error: 'No code provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (code.length > MAX_CODE_SIZE) {
    return new Response(JSON.stringify({ error: 'Code exceeds maximum size of 50KB' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (typeof language !== 'string' || !ALLOWED_LANGUAGES.has(language)) {
    return new Response(JSON.stringify({ error: 'Invalid language' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(code, language) },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    console.error('Groq API error:', groqRes.status, err)
    return new Response(JSON.stringify({ error: 'Analysis failed. Please try again.', groq_status: groqRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Transform SSE stream → raw JSON text stream
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = groqRes.body!.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === 'data: [DONE]') continue
            if (!trimmed.startsWith('data: ')) continue

            try {
              const json = JSON.parse(trimmed.slice(6))
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
