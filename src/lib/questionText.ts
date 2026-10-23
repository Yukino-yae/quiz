import type { QuestionInput } from '@/types/quiz'

export const OPTION_KEYS = 'ABCDEFGH'.split('')

export function formatAnswerSummary(question: QuestionInput): string {
  if (question.type === 'single' || question.type === 'multiple') {
    return question.answer.join('')
  }
  if (question.type === 'judge') {
    return question.answer[0] === 'true' ? '对' : '错'
  }
  if (question.type === 'fill') {
    return question.answerGroups.map((group) => group.join(' / ')).join('；')
  }
  return question.referenceAnswer
}

export function splitKeywords(text: string): string[] {
  return text
    .split(/[|｜,，、;；]/)
    .map((value) => value.trim())
    .filter(Boolean)
}
