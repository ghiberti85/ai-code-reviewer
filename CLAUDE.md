# AI Code Reviewer

Portfolio project: AI-powered code review tool using Groq API (Llama 4 Scout).

## Architecture

Browser → React App → POST /api/review → Vercel Edge Function → Groq API (streaming)

## Stack

- React 19 + TypeScript + Vite
- Framer Motion — animations
- TanStack Query — async state
- Shiki — syntax highlighting
- Groq API (meta-llama/llama-4-scout-17b-16e-instruct) — LLM, free tier
- Vercel Edge Functions — proxy to hide GROQ_API_KEY
- localStorage — review history (last 20 entries, no DB)

## Design System

- Theme: dark terminal with neon green accent
- bg: #0D0F0E, surface: #141716, accent: #00FF88
- Fonts: JetBrains Mono (code) + Syne (UI)

## ReviewResult Schema

```json
{
  "score": 0-100,
  "summary": "string",
  "issues": [{ "line": "number|null", "severity": "error|warning|suggestion", "message": "string", "fix": "string" }],
  "positives": ["string"],
  "refactored": "string|null"
}
```

## Environment Variables

- `GROQ_API_KEY` — set in `.env.local` for local dev, Vercel env vars for production

## Running Locally

```bash
npm install
vercel dev   # runs Vite + Edge Functions together on localhost:3000
```

## Deploy

```bash
vercel --prod
```

Set `GROQ_API_KEY` in Vercel project settings.

## Key Files

- `api/review.ts` — Edge Function, proxies Groq streaming
- `src/lib/groq.ts` — system prompt + prompt engineering
- `src/hooks/useReview.ts` — streaming state machine
- `src/hooks/useHistory.ts` — localStorage CRUD
- `src/components/Review/ScoreBadge.tsx` — animated circular score
- `src/components/Review/IssueCard.tsx` — issue card with severity
