export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const REFACTOR_SYSTEM_PROMPT = `You are a senior staff engineer. Your ONLY task is to rewrite the provided code so that every listed ERROR and WARNING is fixed.

The score of the refactored code is calculated automatically using this formula:
  score = 95 - (13 × number_of_errors) - (7 × number_of_warnings) - (2 × number_of_suggestions)

This means: to raise the score, you MUST eliminate all errors and warnings. Every error you leave in costs 13 points. Every warning costs 7 points.

Your rewrite MUST:
1. Fix EVERY item marked as [ERROR] or [WARNING] — these are the ones that lower the score
2. Be complete and immediately runnable — NO truncation, NO "// rest of code", NO ellipsis, NO placeholders
3. Preserve the original functionality and public API exactly
4. Use modern idiomatic patterns for the language:
   - const/let, never var
   - async/await with try/catch for every async operation
   - no empty catch blocks
   - no global mutable state
   - clear, descriptive function names
5. Review the language as submitted — do NOT add TypeScript types to JavaScript, do NOT add unit tests

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

  let body: { code?: unknown; language?: unknown; issues?: unknown; summary?: unknown; score?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { code, language, issues, summary, score } = body

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

  // Sanitize issues — cap at 20 items, 500 chars per field (prompt injection prevention)
  const MAX_ISSUE_FIELD_LEN = 500
  const MAX_ISSUES = 20

  type SanitizedIssue = { severity: string; message: string; fix: string }
  const sanitizedIssues: SanitizedIssue[] = []
  if (Array.isArray(issues)) {
    for (const item of issues.slice(0, MAX_ISSUES)) {
      if (item === null || typeof item !== 'object') continue
      const severity = typeof item.severity === 'string' ? item.severity : 'suggestion'
      const message = typeof item.message === 'string' ? item.message.slice(0, MAX_ISSUE_FIELD_LEN) : ''
      const fix = typeof item.fix === 'string' ? item.fix.slice(0, MAX_ISSUE_FIELD_LEN) : ''
      if (message) sanitizedIssues.push({ severity, message, fix })
    }
  }

  const errors = sanitizedIssues.filter(i => i.severity === 'error')
  const warnings = sanitizedIssues.filter(i => i.severity === 'warning')
  const suggestions = sanitizedIssues.filter(i => i.severity === 'suggestion')

  const formatIssues = (label: string, list: SanitizedIssue[]) =>
    list.length === 0 ? '' : `\n${label}:\n${list.map((iss, i) =>
      `  ${i + 1}. ${iss.message}${iss.fix ? `\n     Fix: ${iss.fix}` : ''}`
    ).join('\n')}`

  const currentScore = typeof score === 'number' ? score : '?'
  const summaryText = typeof summary === 'string' ? `\nReview summary: ${summary.slice(0, 300)}` : ''

  const issuesBlock = [
    formatIssues('[ERROR] — must fix (costs 13 points each)', errors),
    formatIssues('[WARNING] — must fix (costs 7 points each)', warnings),
    formatIssues('[SUGGESTION] — optional improvement (costs 2 points each)', suggestions),
  ].filter(Boolean).join('\n')

  const userPrompt = `This ${language} code currently scores ${currentScore}/100.${summaryText}

Fix all errors and warnings to raise the score:
${issuesBlock || '\n(No issues listed — but refactored code was requested)'}

Original code:
${code}`

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
