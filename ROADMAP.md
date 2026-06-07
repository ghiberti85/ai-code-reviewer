# Roadmap — AI Code Reviewer

Status atual: **MVP completo, em produção**.

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluído |
| 🚧 | Em progresso |
| 🔜 | Próximo (alta prioridade) |
| 💡 | Planejado (média prioridade) |
| 🔭 | Futuro (baixa prioridade / exploratório) |

---

## Fase 1 — MVP ✅ Concluído

- ✅ Editor de código com seletor de linguagem (9 linguagens)
- ✅ Edge Function proxy para Groq API com streaming
- ✅ Score circular animado (Framer Motion)
- ✅ Lista de issues com severidade (error / warning / suggestion)
- ✅ Lista de pontos positivos
- ✅ Código refatorado em tempo real
- ✅ Histórico em localStorage (últimas 20 entradas)

---

## Fase 2 — Qualidade e UX ✅ Concluído

- ✅ Diff view split (original vs refatorado com Shiki highlight)
- ✅ Diff view unified (hunks com contexto, estilo GitHub)
- ✅ Fullscreen diff overlay (atalho Esc)
- ✅ Share link (review encodado em URL base64)
- ✅ Upload de arquivo + drag & drop (detecção automática de linguagem)
- ✅ Embed badge (snippets HTML/Markdown para portfólio)
- ✅ Design responsivo (mobile + tablet + desktop)
- ✅ Bottom tab bar no mobile
- ✅ Favicon SVG terminal

---

## Fase 3 — Robustez ✅ Concluído

- ✅ Validação de input no Edge Function (tipo, tamanho, allowlist)
- ✅ Guard de GROQ_API_KEY ausente
- ✅ Sanitização de erros (sem leakage de internals)
- ✅ Validação de schema no cliente
- ✅ Security headers via vercel.json (CSP, HSTS, X-Frame-Options, etc.)
- ✅ 45 testes (Vitest + RTL): hooks, componentes, funções puras, API
- ✅ CI/CD: type-check + testes em todo push, deploy automático no merge para main
- ✅ Documentação completa (CLAUDE.md, ARCHITECTURE, SECURITY, TESTING)

---

## Fase 4 — Experiência avançada 🔜 Próxima

### 4.1 Multi-linguagem no mesmo review
- Suporte a revisão de múltiplos arquivos relacionados (ex: componente + hook + teste)
- Interface de tabs para múltiplos arquivos no editor
- O prompt passa o contexto de todos os arquivos juntos

### 4.2 Comparação de reviews
- Side-by-side de dois reviews do histórico
- Visualizar evolução do score ao longo do tempo
- Gráfico sparkline no histórico

### 4.3 Comentários inline
- Issues exibidos diretamente no editor ao lado da linha correspondente
- Clicar na issue navega para a linha no editor
- Estilo similar ao feedback do IDE

### 4.4 Configuração de review
- Opções: "foco em performance", "foco em segurança", "foco em legibilidade"
- Nível de detalhe: resumido / padrão / detalhado
- Ignorar tipos de issue (ex: ignorar suggestions)

### 4.5 Rate limiting
- Middleware Vercel com limite por IP (ex: 10 reviews/min)
- Resposta 429 com tempo de retry no header
- Feedback visual no frontend quando rate limited

---

## Fase 5 — Colaboração e portfólio 💡 Planejado

### 5.1 Reviews públicos
- Galeria de reviews públicos (opt-in)
- Cada review tem URL permanente
- Backend mínimo: Vercel KV ou Supabase para persistência

### 5.2 Autenticação leve
- Login com GitHub OAuth
- Histórico sincronizado entre dispositivos
- Badge de portfólio associada ao perfil

### 5.3 GitHub App / Bot
- Instalar o bot em um repositório
- Review automático em pull requests
- Comentários inline no diff do PR

### 5.4 VS Code Extension
- Sidebar com review do arquivo aberto
- Highlight de issues diretamente no editor
- Atalho para refatorar seleção

### 5.5 API pública
- Endpoint documentado para integração externa
- Autenticação por API key do usuário
- Casos de uso: CI pipelines, pre-commit hooks

---

## Fase 6 — Inteligência avançada 🔭 Futuro

### 6.1 Modelos múltiplos
- Seletor de modelo: Llama 4 Scout / Llama 4 Maverick / GPT-4o / Claude
- Comparação de reviews entre modelos
- Custo estimado por review

### 6.2 Review incremental
- Ao invés de rever o arquivo inteiro, revisar apenas o diff de um commit ou PR
- Integração com `git diff`
- Contexto de arquivos relacionados

### 6.3 Aprendizado de preferências
- O usuário pode marcar sugestões como "irrelevante para meu projeto"
- O sistema adapta o prompt com base no feedback
- Persistência via Vercel KV

### 6.4 Métricas de projeto
- Dashboard com histórico de scores ao longo do tempo
- Tendências: tipos de issues mais comuns, evolução da qualidade
- Export em CSV / JSON

---

## Débito técnico a endereçar

| Item | Prioridade | Esforço |
|------|-----------|---------|
| `unsafe-inline` no CSP (necessário pelo Vite) | Alta | Médio — migrar para nonce-based CSP no build |
| SYSTEM_PROMPT duplicado (frontend + Edge Function) | Média | Baixo — criar script de sync ou monorepo |
| Shiki bundle grande (~800KB algumas línguas) | Baixa | Médio — lazy load por linguagem |
| Share link quebra para código > 3KB | Média | Médio — comprimir com LZ-string ou usar Vercel KV |
| Sem rate limiting no endpoint | Alta | Médio — Vercel Edge Middleware |

---

## Como contribuir com o roadmap

1. Abrir uma issue no GitHub descrevendo a feature
2. Discutir o escopo e critérios de aceitação
3. Criar branch `feature/nome-da-feature` a partir de `main`
4. Implementar com testes
5. Abrir PR — CI deve estar verde antes do merge
