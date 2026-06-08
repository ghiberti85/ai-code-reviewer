# Roadmap de Impressão — AI Code Reviewer

> Objetivo: transformar este projeto de "mais um AI tool" para um portfólio que recrutadores abrem, ficam 5 minutos usando, e mandam para o hiring manager.

---

## O que recrutadores técnicos realmente observam

| Sinal | O que demonstra |
|-------|----------------|
| Produto polido e funcional | Você entrega, não só codifica |
| Detalhes de UX sofisticados | Você pensa no usuário |
| Performance perceptível | Você se importa com qualidade |
| Features inesperadas | Criatividade + iniciativa |
| Código limpo e testado | Maturidade de engenharia |
| Documentação viva | Comunicação e organização |

---

## Fase WOW-1 — Primeiro impacto visual (1–2 semanas)

> O recrutador abre, fica impressionado nos primeiros 10 segundos.

### 1.1 Landing page animada antes do editor
- Tela inicial com o logo terminal pulsando
- Texto que "digita" sozinho: `$ analyzing your code...`
- CTA "Start Review" que dissolve e abre o editor
- Uso estratégico de Framer Motion com `AnimatePresence`
- **Por que impressiona:** mostra domínio de animação e cuidado com first impression

### 1.2 Skeleton loading sofisticado
- Ao invés dos dots animados, exibir cards fantasmas pulsando (shimmer effect)
- O score aparece com o círculo preenchendo progressivamente enquanto o stream chega
- Issues surgem um a um com delay escalonado ao invés de todos juntos
- **Por que impressiona:** nível de atenção ao detalhe que separa sênior de júnior

### 1.3 Score com contador animado
- O número do score não aparece de uma vez — ele conta de 0 até o valor final
- Velocidade proporcional ao score: score alto = contador mais rápido
- Cor transiciona suavemente (vermelho → amarelo → verde) enquanto conta
- **Por que impressiona:** microinteração que todo mundo nota e ninguém esquece

### 1.4 Partículas ou glow no score alto
- Score ≥ 90: partículas verdes estouram ao redor do badge (confetti minimalista terminal-style)
- Score < 30: leve tremor (shake animation) no badge
- **Por que impressiona:** feedback emocional — a ferramenta "comemora" código bom

### 1.5 Tema claro opcional
- Toggle dark/light no header com transição suave
- Light: fundo off-white (#F5F7F5), accent mantém #00FF88 mas com contraste ajustado
- Persistido em localStorage
- **Por que impressiona:** mostra que você pensa em acessibilidade e preferências do usuário

---

## Fase WOW-2 — Features que ninguém espera (2–3 semanas)

> O recrutador usa por 5 minutos e manda o link para alguém.

### 2.1 Histórico com gráfico de evolução
- Na aba History: sparkline mostrando a curva de scores ao longo do tempo
- Tooltip ao hover mostra data, linguagem e score
- Se o score está melhorando: linha verde ascendente
- Mensagem motivacional: "Your code quality improved 23 points this week"
- **Por que impressiona:** transforma dados em narrativa — habilidade de produto

### 2.2 Comparação de dois reviews lado a lado
- Selecionar 2 entradas do histórico → "Compare"
- Grid 2 colunas: score, issues, positives de cada uma
- Destacar o que melhorou (verde) e o que piorou (vermelho) entre os dois
- **Por que impressiona:** feature de produto não óbvia que mostra pensamento sistêmico

### 2.3 Copy inteligente de issues
- Ao clicar em um issue, copiar automaticamente o fix para o clipboard
- Toast notification: "Fix copied — paste it in your editor"
- **Por que impressiona:** small UX win que usuários notam imediatamente

### 2.4 Keyboard shortcuts
- `Cmd/Ctrl + Enter` → rodar review
- `Cmd/Ctrl + K` → limpar editor
- `Escape` → fechar fullscreen diff
- `H` → abrir histórico
- Modal de atalhos com `?`
- **Por que impressiona:** demonstra que você pensa em power users e acessibilidade

### 2.5 Exportar review como PDF / imagem
- Botão "Export" no painel de resultado
- Gera um card PNG/SVG com: score, linguagem, summary e top 3 issues
- Ideal para anexar em relatórios de code review
- **Por que impressiona:** feature de produto real com uso prático imediato

### 2.6 Contador de caracteres e linhas no editor
- Status bar no rodapé do editor: `42 lines · 1.2KB · JavaScript`
- Aviso visual quando se aproxima do limite de 50KB
- **Por que impressiona:** detalhe de IDE que mostra atenção à experiência do desenvolvedor

---

## Fase WOW-3 — Profundidade técnica visível (3–4 semanas)

> O recrutador técnico clica em "ver código" e fica impressionado.

### 3.1 Highlight sintático no editor
- Substituir o `<textarea>` por um editor com highlight em tempo real
- Usar CodeMirror 6 ou Monaco Editor (modo leve)
- Manter números de linha, indentação automática, bracket matching
- **Por que impressiona:** elimina o maior ponto fraco visual do MVP — textarea sem highlight

### 3.2 Issues clicáveis que navegam para a linha
- Clicar em um issue com `line: 12` → editor scrolla e destaca a linha 12
- Highlight temporário (2s) com cor da severidade
- **Por que impressiona:** integração entre output da IA e editor = feature de IDE real

### 3.3 Streaming com progresso visual real
- Ao invés de dots, mostrar uma progress bar que avança conforme os tokens chegam
- Estimativa de tempo restante baseada na velocidade dos chunks
- "Analyzing... score ready in ~2s"
- **Por que impressiona:** transforma latência em experiência controlada

### 3.4 Rate de qualidade por sessão
- No header: contador silencioso "Session: 3 reviews · avg score 71"
- Reseta ao fechar o browser (sessionStorage, não localStorage)
- **Por que impressiona:** dados contextuais que aparecem sem ser pedidos

### 3.5 Permalink com OG image dinâmica
- Share link gera uma URL com preview rico (Open Graph)
- OG image: card com score, linguagem e summary — gerado via Vercel OG
- Quando colado no Slack/Twitter: preview bonito aparece
- **Por que impressiona:** integração com ecossistema web real, não só link cru

---

## Fase WOW-4 — Wow factor de portfólio (1 semana, alto impacto)

> Estas são as features que você menciona na entrevista e o recrutador anota.

### 4.1 Página /about com case study
- Rota `/about` no SPA
- Conta a história do projeto: problema, decisões técnicas, métricas
- Inclui: "Por que Edge Functions?", "Por que streaming?", "Por que sem banco?"
- Screenshots de antes/depois de decisões de design
- **Por que impressiona:** você sabe explicar suas escolhas — habilidade rara

### 4.2 README com demo GIF / video
- GIF animado de 15s mostrando um review completo
- Badge de CI verde no topo
- Seção "Technical decisions" com 3–5 bullets explicando trade-offs
- **Por que impressiona:** README é o cartão de visita do GitHub — a maioria é medíocre

### 4.3 Modo "demo" com código pré-carregado por linguagem
- URL `/?demo=python` carrega um snippet Python com problemas conhecidos
- URL `/?demo=rust` carrega Rust, etc.
- Links diretos para demo no README e na landing page
- **Por que impressiona:** recrutador testa sem precisar inventar código — elimina fricção

### 4.4 Testimonial / review do próprio código do projeto
- Na landing page: "Este projeto foi revisado pela própria ferramenta. Score: 87/100."
- Link para o review real
- **Por que impressiona:** dogfooding + transparência + senso de humor técnico

---

## Ordem de implementação recomendada

```
Semana 1:  1.3 (contador animado) + 1.4 (partículas) + 2.3 (copy de issues) + 2.6 (status bar)
Semana 2:  1.1 (landing page) + 1.2 (skeleton) + 2.4 (shortcuts) + 4.3 (modo demo)
Semana 3:  3.1 (highlight no editor) + 3.2 (issues navegáveis) + 2.1 (gráfico histórico)
Semana 4:  1.5 (tema claro) + 3.5 (OG image) + 4.1 (página about) + 4.2 (README com GIF)
Opcional:  2.2 (comparação) + 2.5 (export PDF) + 3.3 (progress bar streaming)
```

---

## Métricas de sucesso

| Meta | Indicador |
|------|-----------|
| Recrutador fica > 3 minutos | Bounce rate < 40% (Vercel Analytics) |
| Feature mencionada em entrevista | "Achei interessante o diff view..." |
| Compartilhamento orgânico | Share link usado sem você pedir |
| Repositório estrelado | Stars no GitHub após enviar o link |

---

## O que NÃO fazer

- ❌ Auth desnecessária — adiciona fricção, não valor
- ❌ Dashboard com métricas vazias — parece feature inacabada
- ❌ Dark patterns de "sign up to see more" — afasta recrutadores técnicos
- ❌ Adicionar features sem polir as existentes — 10 features mediocres < 5 excelentes
- ❌ Texto de marketing genérico ("AI-powered revolutionary tool") — soa falso
