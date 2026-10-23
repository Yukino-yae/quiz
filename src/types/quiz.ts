export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'short'

export type Difficulty = 1 | 2 | 3

export interface QuestionOption {
  key: string
  text: string
}

export interface Bank {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface QuestionInput {
  type: QuestionType
  stem: string
  /** Choice questions only. */
  options: QuestionOption[]
  /** Choice keys; judge questions use ['true'] or ['false']. */
  answer: string[]
  /** Fill-in-the-blank questions: accepted variants for each blank. */
  answerGroups: string[][]
  /** Reference answer for short-answer questions. */
  referenceAnswer: string
  /** Short-answer grading keywords. Empty means self-assessment. */
  keywords: string[]
  explanation: string
  chapter: string
  difficulty: Difficulty
  tags: string[]
}

export interface Question extends QuestionInput {
  id: string
  bankId: string
  order: number
  createdAt: number
  updatedAt: number
}

export type QuestionStatus = 'new' | 'learning' | 'mastered'

export interface QuestionState {
  questionId: string
  bankId: string
  status: QuestionStatus
  favorite: boolean
  wrongCount: number
  correctStreak: number
  lastResult?: boolean
  lastAnsweredAt?: number
}

export type PracticeMode =
  | 'sequence'
  | 'random'
  | 'wrong'
  | 'favorite'
  | 'exam'
  | 'review'

export interface SessionConfig {
  count?: number
  chapters?: string[]
  types?: QuestionType[]
  difficulties?: Difficulty[]
  durationSec?: number
  passScore?: number
}

export interface Session {
  id: string
  bankId: string
  mode: PracticeMode
  config: SessionConfig
  questionIds: string[]
  cursor: number
  startedAt: number
  finishedAt?: number
  score?: number
  elapsedSec?: number
}

export interface AnswerRecord {
  id: string
  sessionId: string
  questionId: string
  bankId: string
  /** Selected option keys; fill answers in order; short answer text at [0]. */
  selected: string[]
  correct: boolean
  timeSpentMs: number
  answeredAt: number
}

export interface AppSetting {
  key: string
  value: unknown
}
