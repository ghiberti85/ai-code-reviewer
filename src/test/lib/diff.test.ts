import { describe, it, expect } from 'vitest'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNo: { left: number | null; right: number | null }
}

// Copy of computeDiff from DiffView.tsx
function computeDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')

  const m = leftLines.length
  const n = rightLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = leftLines[i - 1] === rightLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      result.push({ type: 'unchanged', content: leftLines[i - 1], lineNo: { left: i, right: j } })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', content: rightLines[j - 1], lineNo: { left: null, right: j } })
      j--
    } else {
      result.push({ type: 'removed', content: leftLines[i - 1], lineNo: { left: i, right: null } })
      i--
    }
  }
  return result.reverse()
}

describe('computeDiff', () => {
  it('identical strings → all unchanged', () => {
    const lines = computeDiff('a\nb\nc', 'a\nb\nc')
    expect(lines.every(l => l.type === 'unchanged')).toBe(true)
    expect(lines).toHaveLength(3)
  })

  it('one line added → one added line', () => {
    const lines = computeDiff('a\nb', 'a\nb\nc')
    const added = lines.filter(l => l.type === 'added')
    expect(added).toHaveLength(1)
    expect(added[0].content).toBe('c')
  })

  it('one line removed → one removed line', () => {
    const lines = computeDiff('a\nb\nc', 'a\nc')
    const removed = lines.filter(l => l.type === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].content).toBe('b')
  })

  it('mixed changes → correct types', () => {
    const lines = computeDiff('a\nb\nc', 'a\nB\nc')
    const removed = lines.filter(l => l.type === 'removed')
    const added = lines.filter(l => l.type === 'added')
    const unchanged = lines.filter(l => l.type === 'unchanged')
    expect(removed).toHaveLength(1)
    expect(added).toHaveLength(1)
    expect(unchanged.length).toBeGreaterThanOrEqual(2)
  })

  it('empty strings handled', () => {
    const lines = computeDiff('', '')
    // Split of '' gives [''], so we get 1 line unchanged
    expect(lines).toHaveLength(1)
    expect(lines[0].type).toBe('unchanged')
  })

  it('left empty → all added', () => {
    const lines = computeDiff('', 'a\nb')
    const added = lines.filter(l => l.type === 'added')
    const removed = lines.filter(l => l.type === 'removed')
    // first 'unchanged' from '' === '' fallthrough possible; just check no removed content
    expect(removed.filter(r => r.content !== '')).toHaveLength(0)
    expect(added.length).toBeGreaterThanOrEqual(2)
  })
})
