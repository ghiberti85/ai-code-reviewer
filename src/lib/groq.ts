import type { Language } from '../types/review'

export const LANGUAGES: { value: Language; label: string; shiki: string }[] = [
  { value: 'typescript', label: 'TypeScript', shiki: 'typescript' },
  { value: 'javascript', label: 'JavaScript', shiki: 'javascript' },
  { value: 'python', label: 'Python', shiki: 'python' },
  { value: 'go', label: 'Go', shiki: 'go' },
  { value: 'rust', label: 'Rust', shiki: 'rust' },
  { value: 'java', label: 'Java', shiki: 'java' },
  { value: 'csharp', label: 'C#', shiki: 'csharp' },
  { value: 'css', label: 'CSS', shiki: 'css' },
  { value: 'sql', label: 'SQL', shiki: 'sql' },
]

export const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided code and return a JSON object following this exact schema:

{
  "score": <number 0-100 representing overall code quality>,
  "summary": "<2-3 sentence overview of the code quality>",
  "issues": [
    {
      "line": <line number or null if not applicable>,
      "severity": <"error" | "warning" | "suggestion">,
      "message": "<what the issue is>",
      "fix": "<concrete fix with code example>"
    }
  ],
  "positives": ["<thing done well>", ...],
  "refactored": "<complete refactored version of the code, or null if code is already excellent>"
}

Scoring guide:
- 90-100: Excellent, production-ready
- 70-89: Good, minor improvements needed
- 50-69: Average, several issues
- 30-49: Poor, significant problems
- 0-29: Critical issues

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanation outside the JSON.`

export function buildUserPrompt(code: string, language: string): string {
  return `Review this ${language} code:\n\n${code}`
}
