# AI Code Reviewer

AI-powered code review tool. Paste your code, get an instant quality score, issues list, and a refactored version — all streamed in real time.

[![CI](https://github.com/ghiberti85/ai-code-reviewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ghiberti85/ai-code-reviewer/actions/workflows/ci.yml)

---

## Features

- **Score 0–100** — animated circular gauge with color by range; counter animates from 0 to final score; particles burst for scores ≥ 90, shake animation for scores < 30
- **Issues** — error / warning / suggestion with line numbers and concrete fixes; click any fix to copy it to clipboard
- **Positives** — what the code already does well
- **Refactored code** — complete rewrite that fixes every listed issue; fetched automatically via `/api/refactor` when the review skips it
- **Diff view** — split (Shiki-highlighted) and unified (GitHub-style hunks) modes
- **Fullscreen diff** — expand the diff to full screen, close with Esc
- **Streaming** — results appear as they are generated (~3s first token)
- **Editor status bar** — live line count, file size in KB, and selected language shown below the editor
- **Share link** — encode the full review in a URL, no backend needed
- **File upload** — drag & drop or click to upload, language auto-detected from extension
- **Embed badge** — HTML/Markdown snippets to add a score badge to your README
- **History** — last 20 reviews saved in localStorage, accessible in a History tab
- **Responsive** — full desktop layout, tablet grid, mobile bottom tab bar

---

## Languages supported

TypeScript · JavaScript · Python · Go · Rust · Java · C# · CSS · SQL

---

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
| Tests | Vitest + React Testing Library (45 tests) |

---

## Architecture

```
Browser → React App → POST /api/review  → Vercel Edge Function → Groq API (streaming)
                    → POST /api/refactor → Vercel Edge Function → Groq API (streaming)
```

Both Edge Functions proxy requests to Groq, keeping the API key server-side only.
The SSE stream from Groq is transformed into a plain-text stream that the browser reads chunk by chunk.
`/api/refactor` is called automatically by `useReview` when a review completes with `score < 90` and `refactored` is `null`.

---

## Getting started

### Prerequisites

- Node.js 20+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- [Groq API key](https://console.groq.com/keys) (free)

### Local development

```bash
git clone https://github.com/ghiberti85/ai-code-reviewer.git
cd ai-code-reviewer
npm install
cp .env.example .env.local
# paste your GROQ_API_KEY into .env.local
vercel dev
```

Open [http://localhost:3000](http://localhost:3000).  
`vercel dev` runs both Vite (frontend) and the Edge Functions (`/api/review`, `/api/refactor`) together.

### Running tests

```bash
npm test               # run all tests once
npm run test:watch     # watch mode
npm run test:coverage  # HTML coverage report in coverage/
```

### Deploy to Vercel

#### Option A — Dashboard (no CLI needed)
1. Import the repo at **vercel.com → Add New → Project**
2. Add `GROQ_API_KEY` in **Settings → Environment Variables** before the first deploy
3. Click **Deploy**

#### Option B — CLI
```bash
vercel --prod
vercel env add GROQ_API_KEY production
vercel --prod   # redeploy to apply the env var
```

#### Option C — GitHub Actions (recommended)
Add these secrets to your GitHub repo (**Settings → Secrets → Actions**):

| Secret | Where to find it |
|--------|-----------------|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` → `orgId` after first `vercel` run |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` → `projectId` |

After that, every merge to `main` triggers an automatic production deploy. CI runs on every push.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key — [console.groq.com](https://console.groq.com/keys) |

**Never commit `.env.local`** — it is already in `.gitignore`.

---

## Security

- `GROQ_API_KEY` never reaches the browser — all LLM calls go through the Edge Function
- Input validated and limited to 50 KB per request
- Language parameter validated against an allowlist
- Groq API errors logged server-side, generic message returned to client
- Security headers on all responses: CSP, HSTS, X-Frame-Options, nosniff, Permissions-Policy
- User code stored only in the browser's localStorage, never in a database

See [docs/SECURITY.md](docs/SECURITY.md) for the full threat model.

---

## Project structure

```
ai-code-reviewer/
├── api/
│   ├── review.ts              # Vercel Edge Function — Groq review proxy (streaming)
│   └── refactor.ts            # Vercel Edge Function — Groq refactor proxy (streaming)
├── src/
│   ├── App.tsx                # Main layout, tabs, editor, results; EditorStatusBar component
│   ├── index.css              # Global styles + responsive media queries
│   ├── types/review.ts        # ReviewResult, Issue, HistoryEntry types
│   ├── lib/
│   │   ├── groq.ts            # System prompt + language config
│   │   └── share.ts           # URL-based review sharing (base64)
│   ├── hooks/
│   │   ├── useReview.ts       # State machine: idle→streaming→refactoring→done|error
│   │   ├── useHistory.ts      # localStorage CRUD (20-entry cap)
│   │   └── useMediaQuery.ts   # Responsive breakpoint hook
│   ├── components/
│   │   ├── FileDropZone.tsx   # File upload + drag & drop
│   │   ├── EmbedBadge.tsx     # Portfolio badge generator
│   │   └── Review/
│   │       ├── ScoreBadge.tsx # Animated SVG score gauge (counter, particles, shake)
│   │       ├── IssueCard.tsx  # Severity-coded issue card with click-to-copy fix
│   │       └── DiffView.tsx   # Split + Unified diff
│   └── test/                  # 45 tests across 7 files
├── .github/workflows/
│   ├── ci.yml                 # Type-check + tests on every push
│   └── deploy.yml             # Production deploy on merge to main
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   └── TESTING.md
├── CLAUDE.md                  # Architecture guide for Claude Code
├── ROADMAP.md                 # Feature roadmap
└── vercel.json                # Security headers + CSP
```

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Roadmap](ROADMAP.md)

---

## License

MIT
