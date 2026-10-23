import type { QuestionInput } from '@/types/quiz'

export interface RawQuestion {
  sourceRow: number
  typeText: string
  stem: string
  options: Record<string, string>
  answerText: string
  explanation: string
  chapter: string
  difficultyText: string
  tagsText: string
  keywordsText: string
  raw: string
}

export interface DraftQuestion extends QuestionInput {
  sourceRow: number
  duplicate: boolean
}

export type IssueLevel = 'error' | 'warning'

export interface ParseIssue {
  /** 1-based source row; 0 means a file-level issue. */
  row: number
  level: IssueLevel
  message: string
  raw?: string
}

export type ImportFileType = 'xlsx' | 'csv' | 'txt' | 'docx'

export interface ParseResult {
  fileName: string
  fileType: ImportFileType
  /** Number of recognized question blocks / spreadsheet rows. */
  rows: number
  questions: DraftQuestion[]
  issues: ParseIssue[]
  duplicateCount: number
  errorCount: number
  warningCount: number
}
