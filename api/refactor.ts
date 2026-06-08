export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const REFACTOR_SYSTEM_PROMPT = `You are a senior staff engineer. Your ONLY task is to produce a complete, production-grade refactored version of the provided code.

The code has already been reviewed and has issues. Your refactored version MUST:
1. Fix every listed issue — zero exceptions
2. Deserve a score of 90-100 when evaluated as the SAME language — do NOT add TypeScript types to JavaScript, do NOT add unit tests; just make the code exemplary for its language
3. Be complete and runnable — NO truncation, NO placeholders, NO "// rest of code", NO ellipsis
4. Use modern idiomatic patterns: const/let (never var), async/await with try/catch for every async call, proper error handling, no global mutable state, guard clauses, clear naming
5. Preserve the original functionality and public API

CALIBRATION: A JavaScript snippet with proper error handling, const/let, arrow functions, and clear naming scores 90+. You do NOT need TypeScript types or unit tests to reach 90.

Return a JSON object with a SINGLE field:
{ "refactored": "<the complete refactored code>" }

IMPORTANT: Return ONLY valid JSON. The refactored field must never be null or empty.`

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

  let body: { code?: unknown; language?: unknown; issues?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { code, language, issues } = body

  if (typeof code !== 'string' || !code.trim()) {
    return new Response(JSON.stringify({ error: 'No code provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (code.length > MAX_CODE_SIZE) {
    return new Response(JSON.stringify({ error: 'Code exceeds maximum size' }), {
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

  // Validate and sanitize the issues array before interpolating into the prompt.
  // Each item must have string message/fix fields, capped at 500 chars each, and
  // the array is limited to 20 entries — preventing prompt injection via crafted payloads.
  const MAX_ISSUE_FIELD_LEN = 500
  const MAX_ISSUES = 20

  let sanitizedIssues: Array<{ message: string; fix: string }> = []
  if (Array.isArray(issues)) {
    for (const item of issues.slice(0, MAX_ISSUES)) {
      if (item === null || typeof item !== 'object') continue
      const message = typeof item.message === 'string' ? item.message.slice(0, MAX_ISSUE_FIELD_LEN) : ''
      const fix = typeof item.fix === 'string' ? item.fix.slice(0, MAX_ISSUE_FIELD_LEN) : ''
      if (message) sanitizedIssues.push({ message, fix })
    }
  }

  const issuesSummary = sanitizedIssues.length > 0
    ? `\n\nKnown issues to fix:\n${sanitizedIssues
        .map((iss, i) => `${i + 1}. ${iss.message}${iss.fix ? ` → Fix: ${iss.fix}` : ''}`)
        .join('\n')}`
    : ''

  const userPrompt = `Refactor this ${language} code into a production-ready, 90+ quality version:${issuesSummary}\n\n${code}`

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: REFACTOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    console.error('Groq API error:', groqRes.status, err)
    return new Response(JSON.stringify({ error: 'Refactor failed. Please try again.', groq_status: groqRes.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
