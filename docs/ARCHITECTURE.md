# Architecture — AI Code Reviewer

## Visão geral

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│                                                         │
│  ┌──────────────┐    POST /api/review    ┌───────────┐  │
│  │  React App   │ ──────────────────────▶│  Vercel   │  │
│  │  (Vite SPA)  │                        │  Edge Fn  │  │
│  │              │ ◀──── text/plain ───── │           │  │
│  └──────────────┘   streaming chunks     └─────┬─────┘  │
│         │                                      │        │
│   localStorage                         GROQ_API_KEY     │
│   (history)                                    │        │
└───────────────────────────────────────────────┼────────┘
                                                │
                                    ┌───────────▼──────────┐
                                    │  Groq API            │
                                    │  llama-4-scout       │
                                    │  (SSE streaming)     │
                                    └──────────────────────┘
```

## Fluxo de uma review

1. Usuário cola código no editor e clica **Run Review**
2. `useReview.ts` faz `POST /api/review` com `{ code, language }`
3. A Edge Function valida o input, chama a Groq com streaming SSE
4. A Edge Function transforma o stream SSE em chunks de texto puro e os repassa ao browser
5. `useReview.ts` acumula os chunks em `raw` e atualiza o estado `streaming`
6. Quando o stream termina, o JSON acumulado é parseado e validado
7. O estado passa para `done` e o `ResultPanel` renderiza o resultado
8. `useHistory.ts` salva a entry no localStorage

## Decisões de design

### Por que Edge Function e não API Route Next.js?
O projeto é um SPA puro (Vite), não Next.js. A Vercel detecta arquivos em `api/` e os serve como funções serverless. O Edge runtime foi escolhido por suportar a Web Streams API nativamente, necessária para o streaming de resposta.

### Por que o SYSTEM_PROMPT está duplicado?
A Edge Function (`api/review.ts`) não pode importar de `src/` — a Vercel bundla cada função isoladamente. A solução foi inlinar as constantes diretamente no arquivo da função. Se o prompt mudar, **ambos os lugares devem ser atualizados**.

### Por que localStorage e não banco de dados?
Projeto de portfólio focado em demonstrar integração com LLM. Zero backend complexity. O histórico é por definição local — cada usuário vê apenas seus próprios reviews.

### Por que Shiki e não Prism/highlight.js?
Shiki usa a mesma engine de tokenização do VS Code (TextMate grammars), produzindo highlight de mais alta qualidade. O lado negativo é o bundle maior — mitigado pelo `optimizeDeps.exclude` no vite.config.

### Por que streaming ao invés de esperar o JSON completo?
Melhora a percepção de performance. O usuário vê feedback imediato ao invés de aguardar 3–5 segundos sem resposta. O tradeoff é a complexidade do state machine em `useReview.ts`.

## State machine do useReview

```
idle
  └─[runReview]─▶ streaming
                    ├─[stream ends + valid JSON]─▶ done
                    ├─[stream ends + invalid JSON]─▶ error
                    └─[fetch error]─▶ error

done / error
  └─[reset]─▶ idle

(any state)
  └─[loadResult]─▶ done   (usado ao carregar share link)
```

## Responsividade

| Breakpoint | Layout |
|-----------|--------|
| `> 1024px` | Grid 2 colunas: editor | resultados |
| `769–1024px` | Grid 2 colunas: 45% / 55% |
| `≤ 768px` | Single column + bottom tab bar |

No mobile, a barra de abas inferior substitui a navegação do header e permite alternar entre Code, Results e History.

## Share Link

O review completo (código + linguagem + resultado) é serializado como JSON, encodado em base64 e adicionado como query param `?r=`. Ao carregar a página com esse parâmetro, o estado é restaurado e a URL é limpa com `history.replaceState`. Sem banco de dados, sem servidor.

Limitação: URLs muito longas podem ser cortadas por alguns clientes. Para código > ~3KB o link pode não funcionar em todos os contextos.

## Diff View

Usa um algoritmo LCS (Longest Common Subsequence) implementado localmente para calcular as diferenças entre o código original e o refatorado. As linhas são agrupadas em "hunks" (blocos de mudança) com 3 linhas de contexto ao redor — igual ao comportamento do `git diff`.

O modo Split usa o Shiki para highlight sintático de cada lado. O modo Unified exibe a tabela de diff com números de linha duplos (original | refatorado).
