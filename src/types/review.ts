export type Severity = 'error' | 'warning' | 'suggestion'

export interface Issue {
  line: number | null
  severity: Severity
  message: string
  fix: string
}

export interface ReviewResult {
  score: number
  summary: string
  issues: Issue[]
  positives: string[]
  refactored: string | null
}

export interface HistoryEntry {
  id: string
  timestamp: number
  language: string
  code: string
  result: ReviewResult
}

export type Language = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'csharp' | 'css' | 'sql'
