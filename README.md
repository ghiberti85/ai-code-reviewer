# AI Code Reviewer

AI-powered code review tool. Paste your code, get an instant quality score, issues list, and a refactored version — all streamed in real time.

**Live demo:** [ai-code-reviewer on Vercel](https://ai-code-reviewer.vercel.app)

## Features

- Quality score (0–100) with animated circular gauge
- Issues list with severity: `error` / `warning` / `suggestion`
- Positives — what the code already does well
- Refactored version with one-click copy
- Streaming output — results appear as they are generated
- Review history — last 20 entries saved in localStorage
- 9 languages: TypeScript, JavaScript, Python, Go, Rust, Java, C#, CSS, SQL

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Animations | Framer Motion |
| Async state | TanStack Query |
| Syntax highlight | Shiki |
| LLM | Groq API — `llama-4-scout-17b-16e-instruct` (free tier) |
| Backend | Vercel Edge Functions |
| Storage | localStorage (no database) |

## Architecture

```
Browser → React App → POST /api/review → Vercel Edge Function → Groq API (streaming)
```

The Edge Function proxies the request to Groq, keeping the API key server-side only.

## Getting Started

### Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- [Groq API key](https://console.groq.com/keys) (free)

### Local development

```bash
git clone https://github.com/ghiberti85/ai-code-reviewer.git
cd ai-code-reviewer
npm install
cp .env.example .env.local
# Add your GROQ_API_KEY to .env.local
vercel dev
```

Open [http://localhost:3000](http://localhost:3000).

`vercel dev` runs both Vite (frontend) and the Edge Function (`/api/review`) together.

### Deploy to Vercel

```bash
vercel --prod
vercel env add GROQ_API_KEY production
vercel --prod  # redeploy to apply the env var
```

Or set `GROQ_API_KEY` via the Vercel dashboard: **Project → Settings → Environment Variables**.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key. Get one at [console.groq.com](https://console.groq.com/keys) |

**Never commit `.env.local` to git.** It is already in `.gitignore`.

## Security

- `GROQ_API_KEY` is never exposed to the browser — all LLM calls go through the Edge Function
- Code input is validated and limited to 50KB per request
- Language parameter is validated against an allowlist
- Groq API errors are logged server-side but not forwarded to the client
- User code is stored only in the browser's localStorage, never in a database

## ReviewResult Schema

```ts
{
  score: number           // 0–100
  summary: string
  issues: {
    line: number | null
    severity: 'error' | 'warning' | 'suggestion'
    message: string
    fix: string
  }[]
  positives: string[]
  refactored: string | null
}
```

## Project Structure

```
ai-code-reviewer/
├── api/
│   └── review.ts          # Vercel Edge Function — Groq proxy
├── src/
│   ├── App.tsx            # Main layout, tabs, editor, results
│   ├── main.tsx
│   ├── types/review.ts    # ReviewResult, Issue, HistoryEntry types
│   ├── lib/groq.ts        # System prompt + language config
│   ├── hooks/
│   │   ├── useReview.ts   # Streaming state machine
│   │   └── useHistory.ts  # localStorage CRUD
│   └── components/Review/
│       ├── ScoreBadge.tsx # Animated SVG circular score
│       └── IssueCard.tsx  # Severity-coded issue card
├── index.html
├── vite.config.ts
├── vercel.json
└── .env.example
```

## License

MIT
