import { describe, expect, it } from 'vitest'
import {
  isFavoriteState,
  isMasteredState,
  isWrongState,
} from '@/features/review/stateFilters'
import type { QuestionState } from '@/types/quiz'

function state(overrides: Partial<QuestionState> = {}): QuestionState {
  return {
    questionId: 'question-1',
    bankId: 'bank-1',
    status: 'new',
    favorite: false,
    wrongCount: 0,
    correctStreak: 0,
    ...overrides,
  }
}

describe('review state filters', () => {
  it('treats answered-wrong questions as wrong-book entries', () => {
    expect(isWrongState(state({ wrongCount: 1 }))).toBe(true)
    expect(isWrongState(state({ wrongCount: 1, favorite: true }))).toBe(true)
  })

  it('keeps mastered questions out of the wrong book', () => {
    expect(
      isWrongState(state({ wrongCount: 2, status: 'mastered' })),
    ).toBe(false)
  })

  it('does not mark questions without wrong answers as wrong', () => {
    expect(isWrongState(state({ status: 'learning' }))).toBe(false)
    expect(isWrongState(state({ favorite: true }))).toBe(false)
  })

  it('tracks favorite independently of mastery', () => {
    expect(isFavoriteState(state({ favorite: true }))).toBe(true)
    expect(
      isFavoriteState(
        state({ favorite: true, status: 'mastered', wrongCount: 3 }),
      ),
    ).toBe(true)
    expect(isFavoriteState(state({ status: 'learning' }))).toBe(false)
  })

  it('only reports explicitly mastered questions as mastered', () => {
    expect(isMasteredState(state({ status: 'mastered' }))).toBe(true)
    expect(
      isMasteredState(state({ status: 'learning', correctStreak: 5 })),
    ).toBe(false)
  })
})
