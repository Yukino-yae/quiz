import { describe, expect, it } from 'vitest'
import { normalizeQuestion, questionKey } from '@/features/import/normalize'
import type { RawQuestion } from '@/features/import/types'

function raw(overrides: Partial<RawQuestion>): RawQuestion {
  return {
    sourceRow: 1,
    typeText: '',
    stem: '',
    options: {},
    answerText: '',
    explanation: '',
    chapter: '',
    difficultyText: '',
    tagsText: '',
    keywordsText: '',
    raw: '',
    ...overrides,
  }
}

describe('normalizeQuestion', () => {
  it('parses a single-choice question', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '单选',
        stem: '中国的首都是？',
        options: { A: '北京', B: '上海', C: '广州' },
        answerText: 'A',
      }),
    )

    expect(result.issues.filter((issue) => issue.level === 'error')).toEqual([])
    expect(result.question).toMatchObject({
      type: 'single',
      answer: ['A'],
      options: [
        { key: 'A', text: '北京' },
        { key: 'B', text: '上海' },
        { key: 'C', text: '广州' },
      ],
    })
  })

  it('parses multiple-choice answers with separators and full-width letters', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '多选题',
        stem: '以下哪些是编程语言？',
        options: { A: 'JS', B: 'HTML', C: 'Python' },
        answerText: 'Ａ、C',
      }),
    )

    expect(result.question?.type).toBe('multiple')
    expect(result.question?.answer).toEqual(['A', 'C'])
  })

  it('normalizes judge answers', () => {
    const yes = normalizeQuestion(
      raw({
        typeText: '判断',
        stem: '太阳从东边升起。',
        answerText: '√',
      }),
    )
    const no = normalizeQuestion(
      raw({
        typeText: '判断',
        stem: '太阳从西边升起。',
        answerText: '错误',
      }),
    )

    expect(yes.question?.answer).toEqual(['true'])
    expect(no.question?.answer).toEqual(['false'])
  })

  it('parses fill answers and variants', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '填空',
        stem: '中国的首都是____，最大城市是____。',
        answerText: '北京|首都；上海',
      }),
    )

    expect(result.question?.type).toBe('fill')
    expect(result.question?.answerGroups).toEqual([
      ['北京', '首都'],
      ['上海'],
    ])
  })

  it('keeps short-answer reference and keywords', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '简答',
        stem: '简述光合作用的意义。',
        answerText: '制造有机物并释放氧气。',
        keywordsText: '光能，有机物|氧气',
        tagsText: '重点、生物',
        difficultyText: '难',
        chapter: '第三章',
      }),
    )

    expect(result.question).toMatchObject({
      type: 'short',
      referenceAnswer: '制造有机物并释放氧气。',
      keywords: ['光能', '有机物', '氧气'],
      tags: ['重点', '生物'],
      difficulty: 3,
      chapter: '第三章',
    })
  })

  it('rejects a choice answer outside the options', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '单选',
        stem: '题目',
        options: { A: '甲', B: '乙' },
        answerText: 'C',
      }),
    )

    expect(result.question).toBeNull()
    expect(result.issues.some((issue) => issue.message.includes('不在选项'))).toBe(
      true,
    )
  })

  it('rejects a single-choice question with two answers', () => {
    const result = normalizeQuestion(
      raw({
        typeText: '单选',
        stem: '题目',
        options: { A: '甲', B: '乙' },
        answerText: 'AB',
      }),
    )

    expect(result.question).toBeNull()
    expect(
      result.issues.some((issue) => issue.message.includes('只能有一个答案')),
    ).toBe(true)
  })

  it('requires an answer', () => {
    const result = normalizeQuestion(
      raw({ typeText: '判断', stem: '题目' }),
    )

    expect(result.question).toBeNull()
    expect(result.issues.some((issue) => issue.message === '缺少答案')).toBe(
      true,
    )
  })

  it('infers the type from options when no type is given', () => {
    const result = normalizeQuestion(
      raw({
        stem: '题目',
        options: { A: '甲', B: '乙' },
        answerText: 'B',
      }),
    )

    expect(result.question?.type).toBe('single')
  })

  it('builds a duplicate key ignoring whitespace and case', () => {
    expect(
      questionKey({ type: 'single', stem: 'Hello  World' }),
    ).toBe(questionKey({ type: 'single', stem: 'hello world' }))
  })
})
