import type { QuestionState } from '@/types/quiz'

export type ReviewTab = 'wrong' | 'favorite' | 'mastered'

/** Consecutive correct answers required for automatic mastery. */
export const MASTERED_STREAK = 3

/** Wrong questions remain in the wrong book until mastered or removed. */
export function isWrongState(state: QuestionState): boolean {
  return state.wrongCount > 0 && state.status !== 'mastered'
}

export function isFavoriteState(state: QuestionState): boolean {
  return state.favorite
}

export function isMasteredState(state: QuestionState): boolean {
  return state.status === 'mastered'
}
