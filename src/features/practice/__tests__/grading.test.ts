import { describe, expect, it } from 'vitest'
import {
  formatSelectedAnswer,
  getBlankCount,
  gradeAnswer,
  isAnswerComplete,
  normalizeAnswerText,
} from '@/features/practice/grading'
import type { Question, QuestionType } from '@/types/quiz'

function question(
  type: QuestionType,
  overrides: Partial<Question> = {},
): Question {
  return {
    id: 'question-1',
    bankId: 'bank-1',
    type,
    stem: '题干',
    options: [],
    answer: [],
    answerGroups: [],
    referenceAnswer: '',
    keywords: [],
    explanation: '',
    chapter: '',
    difficulty: 2,
    tags: [],
    order: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('gradeAnswer', () => {
  it('grades single choice exactly', () => {
    const item = question('single', {
      options: [
        { key: 'A', text: '北京' },
        { key: 'B', text: '上海' },
      ],
      answer: ['A'],
    })
    expect(gradeAnswer(item, ['A']).correct).toBe(true)
    expect(gradeAnswer(item, ['B']).correct).toBe(false)
    expect(gradeAnswer(item, ['A', 'B']).correct).toBe(false)
  })

  it('grades multiple choice as an unordered set', () => {
    const item = question('multiple', {
      options: [
        { key: 'A', text: '甲' },
        { key: 'B', text: '乙' },
        { key: 'C', text: '丙' },
      ],
      answer: ['A', 'C'],
    })
    expect(gradeAnswer(item, ['C', 'A']).correct).toBe(true)
    expect(gradeAnswer(item, ['A']).correct).toBe(false)
    expect(gradeAnswer(item, ['A', 'B', 'C']).correct).toBe(false)
  })

  it('grades judge questions with true and false keys', () => {
    const item = question('judge', { answer: ['true'] })
    expect(gradeAnswer(item, ['true']).correct).toBe(true)
    expect(gradeAnswer(item, ['false']).correct).toBe(false)
    expect(gradeAnswer(item, []).correct).toBe(false)
  })

  it('accepts fill variants and normalizes width, case and whitespace', () => {
    const item = question('fill', {
      answerGroups: [['北京', '首都'], ['CPU']],
    })
    expect(gradeAnswer(item, ['首都', 'cpu']).correct).toBe(true)
    expect(gradeAnswer(item, [' 北京。', 'ＣＰＵ']).correct).toBe(true)
    expect(gradeAnswer(item, ['北京', 'GPU']).correct).toBe(false)

    const result = gradeAnswer(item, ['上海', 'CPU'])
    expect(result.blanks?.map((blank) => blank.correct)).toEqual([
      false,
      true,
    ])
  })

  it('marks fill blanks as incomplete until every blank is filled', () => {
    const item = question('fill', {
      answerGroups: [['北京'], ['上海']],
    })
    expect(getBlankCount(item)).toBe(2)
    expect(isAnswerComplete(item, ['北京', ''])).toBe(false)
    expect(isAnswerComplete(item, ['北京', '上海'])).toBe(true)
  })

  it('grades short answers by keyword coverage', () => {
    const item = question('short', {
      keywords: ['光能', '有机物', '氧气'],
      referenceAnswer: '参考答案',
    })
    const full = gradeAnswer(item, [
      '光合作用把光能转化为化学能，制造有机物，并释放氧气。',
    ])
    expect(full.correct).toBe(true)
    expect(full.keywords?.matched).toHaveLength(3)
    expect(full.keywords?.missing).toHaveLength(0)

    const partial = gradeAnswer(item, ['光合作用能制造有机物。'])
    expect(partial.correct).toBe(false)
    expect(partial.keywords?.missing).toEqual(['光能', '氧气'])
  })

  it('asks for self assessment when a short answer has no keywords', () => {
    const item = question('short', { referenceAnswer: '参考内容' })
    const result = gradeAnswer(item, ['我的回答'])
    expect(result.needsSelfAssessment).toBe(true)
    expect(result.correct).toBe(false)
    expect(result.correctAnswer).toBe('参考内容')
  })
})

describe('answer helpers', () => {
  it('normalizes fill answers without changing symbols', () => {
    expect(normalizeAnswerText(' ＡＢＣ，。 ')).toBe('abc')
    expect(normalizeAnswerText('增长率 5%')).toBe('增长率5%')
  })

  it('formats selected answers for the result page', () => {
    const fill = question('fill', {
      answerGroups: [['北京'], ['上海']],
    })
    expect(formatSelectedAnswer(fill, ['北京', ''])).toBe(
      '第1空：北京；第2空：未填',
    )
    expect(
      formatSelectedAnswer(question('judge'), ['true']),
    ).toBe('对')
  })

  it('checks completeness for choice and short answers', () => {
    expect(isAnswerComplete(question('single'), [])).toBe(false)
    expect(isAnswerComplete(question('single'), ['A'])).toBe(true)
    expect(isAnswerComplete(question('short'), ['   '])).toBe(false)
    expect(isAnswerComplete(question('short'), ['内容'])).toBe(true)
  })
})
