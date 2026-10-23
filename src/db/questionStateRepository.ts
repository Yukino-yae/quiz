import { db } from '@/db/db'
import { MASTERED_STREAK } from '@/features/review/stateFilters'
import type { Question, QuestionState } from '@/types/quiz'

type QuestionKey = Pick<Question, 'id' | 'bankId'>

function initialState(question: QuestionKey): QuestionState {
  return {
    questionId: question.id,
    bankId: question.bankId,
    status: 'new',
    favorite: false,
    wrongCount: 0,
    correctStreak: 0,
  }
}

export async function toggleQuestionFavorite(
  question: QuestionKey,
): Promise<boolean> {
  return db.transaction('rw', db.questionStates, async () => {
    const previous = await db.questionStates.get(question.id)
    const favorite = !(previous?.favorite ?? false)
    const next: QuestionState = {
      ...(previous ?? initialState(question)),
      favorite,
    }
    await db.questionStates.put(next)
    return favorite
  })
}

export async function markQuestionMastered(
  question: QuestionKey,
): Promise<void> {
  await db.transaction('rw', db.questionStates, async () => {
    const previous = await db.questionStates.get(question.id)
    await db.questionStates.put({
      ...(previous ?? initialState(question)),
      status: 'mastered',
      correctStreak: Math.max(
        previous?.correctStreak ?? 0,
        MASTERED_STREAK,
      ),
    })
  })
}

export async function resetQuestionToLearning(
  question: QuestionKey,
): Promise<void> {
  await db.transaction('rw', db.questionStates, async () => {
    const previous = await db.questionStates.get(question.id)
    await db.questionStates.put({
      ...(previous ?? initialState(question)),
      status: 'learning',
      correctStreak: 0,
    })
  })
}

export async function removeQuestionFromWrong(
  question: QuestionKey,
): Promise<void> {
  await db.transaction('rw', db.questionStates, async () => {
    const previous = await db.questionStates.get(question.id)
    await db.questionStates.put({
      ...(previous ?? initialState(question)),
      wrongCount: 0,
    })
  })
}
