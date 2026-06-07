export const config = { runtime: 'edge' }

const ALLOWED_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'go', 'rust', 'java', 'csharp', 'css', 'sql',
])

const MAX_CODE_SIZE = 50_000

const SYSTEM_PROMPT = `You are a senior staff engineer conducting a rigorous code review. Your mission has two parts: (1) honestly score and critique the submitted code, and (2) produce a refactored version that is genuinely excellent — not just "slightly better", but production-grade, exemplary code.

Return a single JSON object with this exact schema:

{
  "score": <integer 0-100>,
  "summary": "<2-3 sentences describing quality and the most critical problems>",
  "issues": [
    {
      "line": <line number or null>,
      "severity": "error" | "warning" | "suggestion",
      "message": "<clear description of the problem>",
      "fix": "<concrete code snippet showing exactly how to fix it>"
    }
  ],
  "positives": ["<specific thing the code does well>"],
  "refactored": "<complete, production-ready rewrite — see strict rules below>"
}

SCORING — use this checklist. Each ✗ costs points; all ✓ = 90+:
  ✓ Uses modern syntax for the language (const/let, arrow fns, destructuring, etc.)
  ✓ All async operations have try/catch or .catch() error handling
  ✓ No global mutable state (module-level vars that functions mutate)
  ✓ No deprecated patterns (var, ==, callback hell, etc.)
  ✓ Functions have clear, descriptive names
  ✓ No silent failures (empty catch blocks, swallowed errors)
  ✓ Return values and edge cases handled (null checks, empty arrays, etc.)

Score 90-100 if all 7 boxes are checked. Score lower for each real violation.

FORBIDDEN — do NOT report these as issues, do NOT deduct points for them:
  ✗ Missing TypeScript types (review the language as submitted — JS stays JS)
  ✗ Missing unit tests or test coverage
  ✗ Missing JSDoc or inline comments
  ✗ "Could be more modular" with no specific bug to fix
  ✗ Subjective style preferences (naming conventions, file structure, etc.)
  ✗ Hypothetical future requirements ("should handle X someday")

STRICT RULES FOR THE "refactored" FIELD:
The refactored code is a COMPLETE REWRITE demonstrating mastery of the language.
ANY score below 90 means you MUST provide refactored — including 70, 75, 80, 85, 88.
It MUST:
1. Fix EVERY issue listed in the issues array — zero exceptions
2. Deserve a score of 90-100 when reviewed fresh — this is the definition of success
3. Be complete and runnable — NO truncation, NO "// ... rest of code", NO ellipsis, NO placeholders
4. Use modern, idiomatic patterns for the language (const/let, async/await with try/catch, no global mutable state, guard clauses, named exports)
5. Include proper error handling for every async operation and external call
6. Preserve the original functionality and public API

When score is 0-89: refactored MUST be a full code string — never null, never empty.
When score is 90-100: refactored may be null — the code is already excellent as-is.

SELF-CHECK before returning — apply the checklist to YOUR OWN refactored code:
  If all 7 items pass → the refactored code deserves 90+. Set score accordingly when reviewing it.
  If you are reviewing code where all 7 items already pass → score MUST be 90 or higher. Do not invent issues.

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
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    console.error('Groq API error:', groqRes.status, err)
    return new Response(JSON.stringify({ error: 'Analysis failed. Please try again.' }), {
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
