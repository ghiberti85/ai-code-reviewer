import { describe, it, expect } from 'vitest'
import { LANGUAGES, SYSTEM_PROMPT, buildUserPrompt } from '../../lib/groq'

describe('LANGUAGES', () => {
  it('includes all 9 supported languages', () => {
    expect(LANGUAGES).toHaveLength(9)
    const values = LANGUAGES.map(l => l.value)
    expect(values).toContain('typescript')
    expect(values).toContain('javascript')
    expect(values).toContain('python')
    expect(values).toContain('go')
    expect(values).toContain('rust')
    expect(values).toContain('java')
    expect(values).toContain('csharp')
    expect(values).toContain('css')
    expect(values).toContain('sql')
  })

  it('every language has value, label, and shiki fields', () => {
    for (const lang of LANGUAGES) {
      expect(lang.value).toBeTruthy()
      expect(lang.label).toBeTruthy()
      expect(lang.shiki).toBeTruthy()
    }
  })
})

describe('buildUserPrompt', () => {
  it('includes the language and code in the output', () => {
    const prompt = buildUserPrompt('const x = 1', 'typescript')
    expect(prompt).toContain('typescript')
    expect(prompt).toContain('const x = 1')
  })

  it('works with empty code string', () => {
    const prompt = buildUserPrompt('', 'python')
    expect(prompt).toContain('python')
  })
})

describe('SYSTEM_PROMPT', () => {
  it('always sets score to 0', () => {
    expect(SYSTEM_PROMPT).toContain('score": 0')
  })

  it('requires non-empty fix field', () => {
    expect(SYSTEM_PROMPT).toContain('NEVER leave it empty')
  })

  it('instructs model to return only valid JSON', () => {
    expect(SYSTEM_PROMPT).toContain('Return ONLY valid JSON')
  })
})
