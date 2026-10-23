import { db } from '@/db/db'
import { questionMatchesConfig } from '@/features/practice/filters'
import {
  isFavoriteState,
  isWrongState,
  MASTERED_STREAK,
} from '@/features/review/stateFilters'
import type {
  AnswerRecord,
  Question,
  QuestionState,
  Session,
  SessionConfig,
} from '@/types/quiz'

export type PracticeRunMode = 'sequence' | 'random' | 'wrong' | 'favorite'

interface CreatePracticeSessionOptions {
  bankId: string
  mode: PracticeRunMode
  config?: SessionConfig
  /** Limit the session to an already filtered set of questions. */
  questionIds?: string[]
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export async function createPracticeSession({
  bankId,
  mode,
  config = {},
  questionIds,
}: CreatePracticeSessionOptions): Promise<Session> {
  const [bank, allQuestions, states] = await Promise.all([
    db.banks.get(bankId),
    db.questions.where('bankId').equals(bankId).toArray(),
    db.questionStates.where('bankId').equals(bankId).toArray(),
  ])

  if (!bank) throw new Error('题库不存在')
  if (allQuestions.length === 0) {
    throw new Error('这个题库还没有题目，请先导入或添加题目。')
  }

  const stateMap = new Map(
    states.map((state) => [state.questionId, state] as const),
  )
  const wrongIds = new Set(
    states.filter(isWrongState).map((state) => state.questionId),
  )
  const favoriteIds = new Set(
    states.filter(isFavoriteState).map((state) => state.questionId),
  )
  const restrictedIds = questionIds ? new Set(questionIds) : null

  let questions = allQuestions.filter(
    (question) =>
      (!restrictedIds || restrictedIds.has(question.id)) &&
      questionMatchesConfig(question, config),
  )

  if (mode === 'wrong') {
    questions = questions.filter((question) => wrongIds.has(question.id))
    if (questions.length === 0) {
      throw new Error('没有符合条件的错题，先去练习积累错题吧。')
    }
  } else if (mode === 'favorite') {
    questions = questions.filter((question) => favoriteIds.has(question.id))
    if (questions.length === 0) {
      throw new Error('没有符合条件的收藏题目，先去收藏几道题吧。')
    }
  } else if (questions.length === 0) {
    throw new Error('没有符合筛选条件的题目，请调整筛选后重试。')
  }

  if (mode === 'random') {
    questions = shuffle(questions)
  } else if (mode === 'wrong' || mode === 'favorite') {
    questions.sort((left, right) => {
      const leftTime = stateMap.get(left.id)?.lastAnsweredAt ?? 0
      const rightTime = stateMap.get(right.id)?.lastAnsweredAt ?? 0
      return rightTime - leftTime || left.order - right.order
    })
  } else {
    questions.sort((left, right) => left.order - right.order)
  }

  const count = config.count
  if (count && count > 0) questions = questions.slice(0, count)

  const session: Session = {
    id: crypto.randomUUID(),
    bankId,
    mode,
    config,
    questionIds: questions.map((question) => question.id),
    cursor: 0,
    startedAt: Date.now(),
  }

  await db.sessions.add(session)
  return session
}

interface RecordAnswerOptions {
  sessionId: string
  question: Question
  selected: string[]
  correct: boolean
  timeSpentMs: number
}

export async function recordAnswer({
  sessionId,
  question,
  selected,
  correct,
  timeSpentMs,
}: RecordAnswerOptions): Promise<AnswerRecord> {
  return db.transaction(
    'rw',
    db.answers,
    db.questionStates,
    db.sessions,
    async () => {
      const session = await db.sessions.get(sessionId)
      if (!session) throw new Error('练习记录不存在')

      const existing = await db.answers
        .where('sessionId')
        .equals(sessionId)
        .filter((answer) => answer.questionId === question.id)
        .first()
      if (existing) return existing

      const now = Date.now()
      const answer: AnswerRecord = {
        id: crypto.randomUUID(),
        sessionId,
        questionId: question.id,
        bankId: session.bankId,
        selected: [...selected],
        correct,
        timeSpentMs: Math.max(0, Math.round(timeSpentMs)),
        answeredAt: now,
      }
      await db.answers.add(answer)

      const previous = await db.questionStates.get(question.id)
      const correctStreak = correct
        ? (previous?.correctStreak ?? 0) + 1
        : 0
      const status: QuestionState['status'] =
        correct &&
        (correctStreak >= MASTERED_STREAK ||
          previous?.status === 'mastered')
          ? 'mastered'
          : 'learning'

      const nextState: QuestionState = {
        questionId: question.id,
        bankId: session.bankId,
        status,
        favorite: previous?.favorite ?? false,
        wrongCount: (previous?.wrongCount ?? 0) + (correct ? 0 : 1),
        correctStreak,
        lastResult: correct,
        lastAnsweredAt: now,
      }
      await db.questionStates.put(nextState)

      return answer
    },
  )
}

export async function advanceSession(
  sessionId: string,
  cursor: number,
): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.finishedAt) return
  const nextCursor = Math.max(
    0,
    Math.min(cursor, session.questionIds.length),
  )
  await db.sessions.update(sessionId, { cursor: nextCursor })
}

export async function completeSession(
  sessionId: string,
): Promise<Session> {
  return db.transaction('rw', db.sessions, db.answers, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) throw new Error('练习记录不存在')
    if (session.finishedAt) return session

    const records = await db.answers
      .where('sessionId')
      .equals(sessionId)
      .toArray()
    const uniqueAnswers = new Map<string, AnswerRecord>()
    for (const record of records) {
      if (!uniqueAnswers.has(record.questionId)) {
        uniqueAnswers.set(record.questionId, record)
      }
    }

    const answered = uniqueAnswers.size
    const correct = [...uniqueAnswers.values()].filter(
      (record) => record.correct,
    ).length
    const finishedAt = Date.now()
    const updated: Session = {
      ...session,
      cursor: session.questionIds.length,
      finishedAt,
      score: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      elapsedSec: Math.max(
        1,
        Math.round((finishedAt - session.startedAt) / 1000),
      ),
    }

    await db.sessions.put(updated)
    return updated
  })
}
