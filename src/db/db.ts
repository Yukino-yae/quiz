import Dexie, { type Table } from 'dexie'
import type {
  AnswerRecord,
  AppSetting,
  Bank,
  Question,
  QuestionState,
  Session,
} from '@/types/quiz'

export class QuizDatabase extends Dexie {
  banks!: Table<Bank, string>
  questions!: Table<Question, string>
  questionStates!: Table<QuestionState, string>
  sessions!: Table<Session, string>
  answers!: Table<AnswerRecord, string>
  settings!: Table<AppSetting, string>

  constructor() {
    super('quiz-db')

    this.version(1).stores({
      banks: 'id, name, createdAt, updatedAt',
      questions: 'id, bankId, type, chapter, difficulty, order, createdAt',
      questionStates: 'questionId, bankId, status, lastAnsweredAt',
      sessions: 'id, bankId, mode, startedAt, finishedAt',
      answers: 'id, sessionId, questionId, bankId, answeredAt',
      settings: 'key',
    })
  }
}

export const db = new QuizDatabase()
