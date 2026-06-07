# Security Model — AI Code Reviewer

## Modelo de ameaças

### Ativos a proteger
1. `GROQ_API_KEY` — chave de API paga, jamais pode vazar ao cliente
2. Quota da Groq API — abuso pode esgotar o limite gratuito
3. Integridade do output — resultado manipulado poderia induzir decisões erradas

### Superfície de ataque
- `POST /api/review` — endpoint público, aceita código arbitrário
- `POST /api/refactor` — endpoint público, aceita código + array de issues
- Frontend — XSS via conteúdo exibido (Shiki, share URL)
- localStorage — dados do usuário persistidos no browser

---

## Controles implementados

### 1. Segredo da API Key
- `GROQ_API_KEY` nunca é incluída no bundle do frontend (Vite não expõe variáveis sem prefixo `VITE_`)
- A chave só existe no ambiente da Vercel Edge Function em runtime
- Guard explícito: se `process.env.GROQ_API_KEY` for `undefined`, o endpoint retorna 500 sem revelar detalhes

### 2. Validação de input (`api/review.ts` e `api/refactor.ts`)
```
POST /api/review
  ├── Método ≠ POST → 405
  ├── Body não é JSON válido → 400
  ├── code ausente ou vazio → 400
  ├── code.length > 50.000 bytes → 400 (previne DoS e token abuse)
  ├── language não está na allowlist → 400
  └── GROQ_API_KEY ausente → 500 (sem detalhes ao cliente)
```

### 3. Sanitização de erros
- Erros da Groq API são logados via `console.error` server-side
- O cliente recebe apenas `"Analysis failed. Please try again."` — nenhum detalhe interno é exposto

### 4. Validação de schema no cliente
`useReview.ts` valida o JSON recebido antes de aceitar:
```ts
if (typeof parsed.score !== 'number' ||
    typeof parsed.summary !== 'string' ||
    !Array.isArray(parsed.issues) ||
    !Array.isArray(parsed.positives)) {
  throw new Error('Invalid response schema')
}
```

### 5. XSS Prevention
- Todo conteúdo dinâmico é renderizado via React (escaping automático)
- O bloco Shiki usa `dangerouslySetInnerHTML` mas o HTML é gerado localmente pela lib, nunca de input do usuário ou da API
- O código do usuário é exibido em `<textarea>` e `<pre>` — sem `innerHTML`

### 6. Security Headers (vercel.json)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.groq.com; frame-ancestors 'none'; ...
```

### 7. localStorage
- Dados armazenados são gerados pelo usuário e pela Groq — não por terceiros
- Não há dados sensíveis como tokens ou senhas no localStorage
- O histórico contém código do usuário: alertar usuários para não colar dados sensíveis (senhas, API keys) no editor

---

## Riscos residuais e mitigações recomendadas

| Risco | Probabilidade | Impacto | Mitigação recomendada |
|-------|-------------|---------|----------------------|
| Abuso de quota (bot) | Média | Alto | Rate limiting por IP (Vercel Edge Config ou middleware) |
| Prompt injection via código | Baixa | Médio | SYSTEM_PROMPT não pode ser sobrescrito; a Groq API não executa código |
| Dados sensíveis no código enviado | Média | Médio | Aviso na UI "não cole credenciais" |
| localStorage comprometido por XSS | Muito baixa | Médio | CSP estrita já mitiga XSS |
| Dependency supply chain | Baixa | Alto | `npm audit` no CI, Dependabot |

---

## Rate Limiting (a implementar)

O endpoint `/api/review` não tem rate limiting atualmente. Para projetos em produção com tráfego público, implementar:

```ts
// Opção A: Vercel Edge Middleware (middleware.ts na raiz)
import { NextRequest, NextResponse } from 'next/server'

const rateLimit = new Map<string, { count: number; reset: number }>()

export function middleware(req: NextRequest) {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  const window = 60_000 // 1 minuto
  const limit = 10      // 10 requests/min por IP

  const entry = rateLimit.get(ip)
  if (!entry || now > entry.reset) {
    rateLimit.set(ip, { count: 1, reset: now + window })
  } else if (entry.count >= limit) {
    return new Response('Too Many Requests', { status: 429 })
  } else {
    entry.count++
  }
  return NextResponse.next()
}
```

---

## Checklist de deploy seguro

- [ ] `GROQ_API_KEY` configurada nas env vars da Vercel (não no código)
- [ ] `.env.local` no `.gitignore` ✓
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] Security headers ativos via `vercel.json` ✓
- [ ] Testes de validação da API passando ✓
- [ ] CSP sem `unsafe-inline` em `script-src` (ideal — atualmente necessário para Vite dev)
