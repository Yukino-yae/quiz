import { formatAnswerSummary } from '@/lib/questionText'
import type { Question } from '@/types/quiz'

export interface BlankGrade {
  index: number
  answer: string
  accepted: string[]
  correct: boolean
}

export interface KeywordGrade {
  matched: string[]
  missing: string[]
}

export interface GradeResult {
  correct: boolean
  correctAnswer: string
  blanks?: BlankGrade[]
  keywords?: KeywordGrade
  /** Short answers without keywords are graded by the learner. */
  needsSelfAssessment?: boolean
}

export function normalizeAnswerText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s。．.，,；;：:、"“”‘’（）()【】]/g, '')
}

export function getBlankCount(question: Question): number {
  return Math.max(1, question.answerGroups.length)
}

export function isAnswerComplete(
  question: Question,
  selected: string[],
): boolean {
  if (question.type === 'short') return Boolean(selected[0]?.trim())
  if (question.type === 'fill') {
    const count = getBlankCount(question)
    return Array.from(
      { length: count },
      (_, index) => selected[index]?.trim(),
    ).every(Boolean)
  }
  return selected.length > 0
}

function gradeFill(question: Question, selected: string[]): GradeResult {
  const blanks = Array.from({ length: getBlankCount(question) }, (_, index) => {
    const accepted = question.answerGroups[index] ?? []
    const answer = selected[index] ?? ''
    const normalized = normalizeAnswerText(answer)
    return {
      index,
      answer,
      accepted,
      correct:
        normalized.length > 0 &&
        accepted.some(
          (candidate) => normalizeAnswerText(candidate) === normalized,
        ),
    }
  })

  return {
    correct: blanks.every((blank) => blank.correct),
    correctAnswer: formatAnswerSummary(question),
    blanks,
  }
}

function gradeShort(question: Question, selected: string[]): GradeResult {
  const answer = selected[0] ?? ''
  const keywords = question.keywords.filter((keyword) => keyword.trim())

  if (keywords.length === 0) {
    return {
      correct: false,
      correctAnswer: formatAnswerSummary(question),
      needsSelfAssessment: true,
    }
  }

  const normalizedAnswer = normalizeAnswerText(answer)
  const matched: string[] = []
  const missing: string[] = []

  for (const keyword of keywords) {
    if (normalizedAnswer.includes(normalizeAnswerText(keyword))) {
      matched.push(keyword)
    } else {
      missing.push(keyword)
    }
  }

  return {
    correct: missing.length === 0,
    correctAnswer: formatAnswerSummary(question),
    keywords: { matched, missing },
  }
}

export function gradeAnswer(
  question: Question,
  selected: string[],
): GradeResult {
  const correctAnswer = formatAnswerSummary(question) || '未设置参考答案'

  if (question.type === 'fill') return gradeFill(question, selected)
  if (question.type === 'short') return gradeShort(question, selected)

  if (question.type === 'single' || question.type === 'judge') {
    return {
      correct:
        selected.length === 1 && selected[0] === question.answer[0],
      correctAnswer,
    }
  }

  const expected = new Set(question.answer)
  const actual = new Set(selected)
  return {
    correct:
      actual.size === expected.size &&
      [...actual].every((key) => expected.has(key)),
    correctAnswer,
  }
}

export function formatSelectedAnswer(
  question: Question,
  selected: string[],
): string {
  if (question.type === 'single' || question.type === 'multiple') {
    return selected.join('') || '未作答'
  }
  if (question.type === 'judge') {
    if (selected[0] === 'true') return '对'
    if (selected[0] === 'false') return '错'
    return '未作答'
  }
  if (question.type === 'fill') {
    return Array.from({ length: getBlankCount(question) }, (_, index) => {
      const value = selected[index]?.trim()
      return `第${index + 1}空：${value || '未填'}`
    }).join('；')
  }
  return selected[0]?.trim() || '未作答'
}
