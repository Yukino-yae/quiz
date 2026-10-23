import type { Question, SessionConfig } from '@/types/quiz'

export function questionMatchesConfig(
  question: Question,
  config: SessionConfig = {},
): boolean {
  if (config.types?.length && !config.types.includes(question.type)) {
    return false
  }
  if (
    config.difficulties?.length &&
    !config.difficulties.includes(question.difficulty)
  ) {
    return false
  }
  if (
    config.chapters?.length &&
    !config.chapters.includes(question.chapter)
  ) {
    return false
  }
  return true
}
