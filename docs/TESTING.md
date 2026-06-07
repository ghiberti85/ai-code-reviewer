# Testing Guide — AI Code Reviewer

## Stack de testes

| Ferramenta | Função |
|-----------|--------|
| Vitest | Test runner (compatível com Vite, API Jest) |
| @testing-library/react | Render de componentes e hooks |
| @testing-library/user-event | Simulação de interações |
| @testing-library/jest-dom | Matchers de DOM extras |
| jsdom | Ambiente de browser simulado |

## Comandos

```bash
npm test               # roda todos os testes uma vez
npm run test:watch     # modo watch (re-roda ao salvar)
npm run test:coverage  # relatório de cobertura (HTML em coverage/)
```

## Estrutura de testes

```
src/test/
├── setup.ts                    # importa jest-dom matchers
├── lib/
│   ├── share.test.ts           # encode/decode/buildShareUrl
│   └── diff.test.ts            # algoritmo LCS de diff
├── hooks/
│   ├── useHistory.test.ts      # localStorage CRUD
│   └── useReview.test.ts       # streaming state machine
├── components/
│   ├── ScoreBadge.test.tsx     # score + cores
│   ├── IssueCard.test.tsx      # severidades + conteúdo
│   └── EditorStatusBar.test.tsx  # line count, file size, language display
└── api/
    └── review.test.ts          # validação de inputs da Edge Function
```

## Cobertura atual de componentes

Componentes com testes: `ScoreBadge`, `IssueCard`, `EditorStatusBar`

Componentes **sem testes** (pendentes de cobertura): `FileDropZone`, `EmbedBadge`, `DiffView`

## Filosofia

- **Testar comportamento, não implementação** — evite testar detalhes internos como nomes de variáveis privadas
- **Mocks mínimos** — mockar apenas o que ultrapassa a fronteira do sistema (fetch, localStorage, crypto)
- **Casos extremos** — input vazio, tamanho máximo, tipos inválidos
- **Sem testes de snapshot** — frágeis e poucos informativos para este tipo de UI

## Adicionando novos testes

### Para um novo hook
```ts
// src/test/hooks/useMyHook.test.ts
import { renderHook, act } from '@testing-library/react'
import { useMyHook } from '../../hooks/useMyHook'

describe('useMyHook', () => {
  it('initial state', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.value).toBe(null)
  })

  it('updates on action', async () => {
    const { result } = renderHook(() => useMyHook())
    await act(async () => {
      result.current.doSomething()
    })
    expect(result.current.value).toBe('expected')
  })
})
```

### Para um novo componente
```tsx
// src/test/components/MyComponent.test.tsx
import { render, screen } from '@testing-library/react'
import { MyComponent } from '../../components/MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent prop="value" />)
    expect(screen.getByText('expected text')).toBeInTheDocument()
  })
})
```

### Para uma nova função pura
```ts
// src/test/lib/myLib.test.ts
import { myFunction } from '../../lib/myLib'

describe('myFunction', () => {
  it('handles normal input', () => {
    expect(myFunction('input')).toBe('expected')
  })

  it('handles edge case', () => {
    expect(myFunction('')).toBeNull()
  })
})
```

## CI

Os testes rodam automaticamente no GitHub Actions:
- **Todo push** → `ci.yml` (type-check + testes + build)
- **Merge para main** → `deploy.yml` (testes + deploy Vercel prod)

Um PR não deve ser mergeado se o CI falhar.
