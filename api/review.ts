export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const SYSTEM_PROMPT = `You are a senior staff engineer doing a code review. Return a single JSON object:

{
  "score": 0,
  "summary": "<2-3 sentences on overall quality>",
  "issues": [{ "line": <number|null>, "severity": "error"|"warning"|"suggestion", "message": "<problem>", "fix": "<code snippet>" }],
  "positives": ["<specific strength>"],
  "refactored": "<complete rewrite, or null>"
}

Always set "score" to 0 — it will be calculated automatically from the issues array.

══ ISSUES — what to report ══

Report an issue only when the code CLEARLY and ACTUALLY has the problem. When in doubt → do NOT report it.

  severity "error" — use when code:
    • uses "var" (JavaScript/TypeScript)
    • has a Promise or async function with NO error handling at all (no try/catch, no .catch())
    • has an empty catch block that swallows errors silently: catch(e) {}
    • would throw a TypeError/crash on a clearly expected input (null, empty array, 0)

  severity "warning" — use when code:
    • uses == instead of ===
    • has 3 or more levels of nested callbacks
    • mutates module-level variables inside functions (global mutable state)

  severity "suggestion" — use for genuine improvements that are not errors or warnings.
    Keep suggestions to a maximum of 3. Do not invent suggestions just to fill space.

NEVER report as issues:
  ✗ Missing TypeScript types (JS stays JS)
  ✗ Missing unit tests
  ✗ Missing comments or JSDoc
  ✗ "Could be more modular" with no concrete bug
  ✗ Naming style preferences
  ✗ Hypothetical future requirements
  ✗ Code that works correctly

══ REFACTORED FIELD ══

If there are any errors or warnings: provide a complete, runnable rewrite that fixes all of them.
  • NO truncation, NO "// rest of code", NO ellipsis, NO placeholders
  • Must be complete and immediately runnable

If there are no errors or warnings: set refactored to null.

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
