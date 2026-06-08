# AI Code Reviewer — CLAUDE.md

Guia de arquitetura e convenções para o Claude Code. Leia este arquivo antes de qualquer implementação.

---

## Arquitetura

```
Browser → React App (Vite) → POST /api/review  → Vercel Edge Function → Groq API (streaming SSE)
                           → POST /api/refactor → Vercel Edge Function → Groq API (streaming SSE)
                                                                               ↓
                                          /api/review:  meta-llama/llama-4-scout-17b-16e-instruct (max_tokens: 4096, temperature: 0.3)
                                          /api/refactor: llama-3.1-8b-instant (max_tokens: 8192, temperature: 0.2)
```

O Edge Function transforma o stream SSE da Groq em stream de texto puro (JSON acumulado), que o frontend consome linha a linha e exibe em tempo real.

`/api/refactor` é chamado automaticamente pelo `useReview` após o streaming de review terminar, quando `score < 90` e `refactored` é `null`. Isso implementa uma estratégia de **two-pass**: o primeiro passo gera a análise, o segundo gera o código refatorado de forma focada.

---

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React + TypeScript + Vite | 19 / 5.7 / 6 |
| Animações | Framer Motion | 11 |
| Async state | TanStack Query | 5 |
| Syntax highlight | Shiki | 1 |
| LLM (review) | Groq API — `meta-llama/llama-4-scout-17b-16e-instruct` | free tier |
| LLM (refactor) | Groq API — `llama-3.1-8b-instant` | free tier |
| Backend | Vercel Edge Functions | — |
| Storage | localStorage | — |
| Testes | Vitest + React Testing Library | — |

---

## Design System

**Não use Inter, purple gradients nem estilos "AI genéricos".**

| Token | Valor |
|-------|-------|
| bg | `#0D0F0E` |
| surface | `#141716` |
| border | `#1E2220` |
| accent | `#00FF88` |
| text-primary | `#D4E8DC` |
| text-muted | `#8A9E95` |
| error | `#FF2244` |
| warning | `#FFD700` |
| font-code | JetBrains Mono |
| font-ui | Syne |

Escala de cores do score:
- `>= 90` → `#00FF88` (accent)
- `>= 70` → `#88FF00`
- `>= 50` → `#FFD700`
- `>= 30` → `#FF8800`
- `< 30` → `#FF2244`

---

## ReviewResult Schema

```ts
interface ReviewResult {
  score: number          // 0–100
  summary: string        // 2–3 frases
  issues: {
    line: number | null
    severity: 'error' | 'warning' | 'suggestion'
    message: string
    fix: string          // exemplo de código concreto
  }[]
  positives: string[]
  refactored: string | null  // null somente se score >= 90
}
```

**Regra de ouro:** se `score < 90`, `refactored` nunca deve ser `null`. O código refatorado deve corrigir todos os issues listados e pontuar 90+ se revisado independentemente.

---

## Estrutura de pastas

```
ai-code-reviewer/
├── api/
│   ├── review.ts              # Edge Function — análise de código (streaming) — sem imports de src/
│   └── refactor.ts            # Edge Function — refatoração focada (streaming) — sem imports de src/
├── src/
│   ├── App.tsx                # Layout, tabs, editor, resultados; sub-componentes inline: StreamingDots, ScoreCircle, ResultPanel, HistoryPage, DiffFullscreen
│   ├── main.tsx               # Entry point + QueryClient
│   ├── index.css              # Estilos globais + media queries responsivas
│   ├── types/
│   │   └── review.ts          # ReviewResult, Issue, HistoryEntry, Language
│   ├── lib/
│   │   ├── groq.ts            # SYSTEM_PROMPT, LANGUAGES, buildUserPrompt
│   │   └── share.ts           # encode/decode review em URL base64
│   ├── hooks/
│   │   ├── useReview.ts       # Máquina de estados: idle→streaming→done|error
│   │   ├── useHistory.ts      # localStorage CRUD, cap 20 entradas
│   │   └── useMediaQuery.ts   # Hook para breakpoints responsivos
│   ├── components/
│   │   ├── FileDropZone.tsx   # Upload + drag & drop de arquivo
│   │   ├── EmbedBadge.tsx     # Snippets HTML/Markdown para portfólio
│   │   └── Review/
│   │       ├── ScoreBadge.tsx # SVG circular animado; contador 0→score; partículas ≥90; shake <30
│   │       ├── IssueCard.tsx  # Card de issue com severidade e fix; click-to-copy no fix
│   │       └── DiffView.tsx   # Split + Unified diff com Shiki highlight
│   └── test/
│       ├── setup.ts           # jest-dom matchers
│       ├── lib/               # Testes de funções puras
│       ├── hooks/             # Testes de hooks
│       ├── components/        # Testes de componentes
│       └── api/               # Testes da Edge Function
├── .github/
│   └── workflows/
│       ├── ci.yml             # Type-check + testes em todo push
│       └── deploy.yml         # Deploy prod no merge para main
├── public/
│   └── favicon.svg
├── docs/
│   ├── ARCHITECTURE.md        # Decisões arquiteturais detalhadas
│   ├── SECURITY.md            # Modelo de ameaças e controles
│   └── TESTING.md             # Estratégia e guia de testes
├── CLAUDE.md                  # Este arquivo
├── README.md
├── vercel.json                # Security headers + CSP
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## Regras de implementação para Claude

### api/review.ts e api/refactor.ts
- **Nunca importar de `../src/`** — cada Edge Function é bundlada isoladamente pela Vercel. Toda lógica compartilhada deve estar inline no arquivo correspondente.
- Validar todos os inputs antes de chamar a Groq API
- Logar erros da Groq server-side via `console.error`, nunca repassar payload raw ao cliente
- Manter `export const config = { runtime: 'edge' }` — remove essa linha e o runtime quebra
- `api/review.ts` usa `model: 'meta-llama/llama-4-scout-17b-16e-instruct'`, `max_tokens: 4096`, `temperature: 0.3`
- `api/refactor.ts` usa `model: 'llama-3.1-8b-instant'`, `max_tokens: 8192`, `temperature: 0.2`
- `api/refactor.ts` recebe `{ code, language, issues, summary }` e retorna stream de texto com o código refatorado

### Estratégia two-pass (refactored automático)
- `useReview.ts` tem os estados: `idle → streaming → done | error` (sem estado `refactoring` separado)
- A chamada a `/api/refactor` é feita externamente (ex: em `App.tsx` ou hook de orquestração) quando o review termina com `score < 90` e `refactored === null`
- O output de `/api/refactor` é acumulado em streaming e injetado em `result.refactored`
- Saídas de `\n` e `\t` literais (escaped) são normalizadas para quebras de linha e tabs reais

### src/lib/groq.ts
- `SYSTEM_PROMPT` e `LANGUAGES` são a única fonte de verdade do frontend
- O prompt usa checklist binário de 7 pontos, lista `FORBIDDEN` e bloco `SELF-CHECK`
- Quando alterar o prompt, **também atualizar** a cópia inline em `api/review.ts`

### Responsividade
- Mobile-first via classes CSS em `src/index.css`
- Breakpoints: `≤ 768px` (mobile), `769–1024px` (tablet), `> 1024px` (desktop)
- Usar `useMediaQuery` hook para lógica condicional em JS

### Testes
- Todo novo hook deve ter teste em `src/test/hooks/`
- Todo novo componente deve ter teste básico em `src/test/components/`
- Funções puras em `src/lib/` devem ter cobertura de casos extremos
- Rodar `npm test` antes de commitar

### Git & Deploy
- Branch de feature → PR → merge em `main` → deploy automático via GitHub Actions
- CI roda type-check + testes em todo push
- Deploy de produção só ocorre no merge para `main` (workflow `deploy.yml`)

---

## Variáveis de ambiente

| Variável | Onde configurar | Obrigatória |
|----------|----------------|-------------|
| `GROQ_API_KEY` | `.env.local` (local) / Vercel dashboard (prod) | Sim |
| `VERCEL_TOKEN` | GitHub Secrets | Para CI/CD |
| `VERCEL_ORG_ID` | GitHub Secrets | Para CI/CD |
| `VERCEL_PROJECT_ID` | GitHub Secrets | Para CI/CD |

**Nunca commitar** arquivos `.env*` (exceto `.env.example`).

---

## Regra de documentação viva

**A cada implementação concluída, atualizar obrigatoriamente:**

| O que mudou | Arquivo(s) a atualizar |
|-------------|----------------------|
| Nova feature | `README.md` (Features), `ROADMAP.md` (mover para ✅), `CLAUDE.md` (se mudar arquitetura) |
| Nova rota / endpoint | `docs/ARCHITECTURE.md`, `CLAUDE.md` (Estrutura de pastas) |
| Novo hook ou componente | `CLAUDE.md` (Estrutura de pastas + regras) |
| Mudança de segurança | `docs/SECURITY.md`, `vercel.json` |
| Novos testes | `docs/TESTING.md` (se mudar estratégia) |
| Nova env var | `CLAUDE.md` (tabela de env vars), `README.md`, `.env.example` |
| Nova dependência | `README.md` (tabela de stack) |

Não fechar um PR sem verificar se a documentação está sincronizada com o código.

---

## Comandos

```bash
npm install          # instalar dependências
vercel dev           # desenvolvimento local (Vite + Edge Function)
npm run build        # build de produção
npm test             # rodar testes (Vitest)
npm run test:watch   # testes em modo watch
npm run test:coverage # relatório de cobertura
```
