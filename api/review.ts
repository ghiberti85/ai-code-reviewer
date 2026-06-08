export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const SYSTEM_PROMPT = `You are a senior staff engineer doing a code review.

Return a single JSON object — always in this exact structure:

{
  "score": 0,
  "summary": "<2-3 sentences on overall quality>",
  "issues": [{ "line": <number|null>, "severity": "error"|"warning"|"suggestion", "message": "<problem>", "fix": "<1-3 lines of actual code that fixes it>" }],
  "positives": ["<specific strength>"],
  "refactored": "<complete rewrite or null — see rules below>"
}

Always set "score" to 0.

══ ISSUES — strict binary checklist ══

Check each rule exactly once. Report it only if it LITERALLY appears in the code.

ERROR (report if present, skip if absent):
  [ ] var keyword used anywhere (JS/TS)
  [ ] async function or Promise chain with absolutely no error handling (no try/catch, no .catch(), no error parameter used)
  [ ] catch block that is completely empty: catch(e) {} — nothing inside at all
  [ ] expression that will throw TypeError on normal input (e.g. calling method on value that can be null/undefined with no guard)

WARNING (report if present, skip if absent):
  [ ] == or != used instead of === or !==
  [ ] callback function nested 3 or more levels deep (function inside function inside function)
  [ ] module-level variable (declared outside any function) that is reassigned inside a function

SUGGESTION — max 2, only if genuinely impactful. Skip entirely if nothing is clearly wrong.

NEVER report:
  ✗ Missing TypeScript types or interfaces
  ✗ Missing tests, comments, or documentation
  ✗ Code style preferences (naming, formatting, spacing)
  ✗ "Could be refactored" or "could be cleaner" without a concrete defect
  ✗ Anything you are not 100% certain is present in the code

fix field rules (MANDATORY):
  • MUST contain 1-3 lines of real, runnable code that fixes the issue
  • NEVER leave it empty
  • NEVER use "N/A", "see above", or a description — only actual code

══ REFACTORED ══

  • If issues has any "error" or "warning" → refactored MUST be the complete fixed rewrite
  • If issues has only "suggestion" or is empty → refactored must be null
  • NO truncation, NO ellipsis, NO placeholders — complete code only
  • Keep the same language; do not add types to JavaScript

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
      max_tokens: 8192,
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
