import { describe, expect, it } from 'vitest'
import { rowsToRawQuestions } from '@/features/import/tableParser'

describe('rowsToRawQuestions', () => {
  it('maps headers and option columns', () => {
    const rows = [
      ['题型', '题干', '选项A', '选项B', '选项C', '答案', '解析', '章节', '难度', '标签', '关键词'],
      ['单选', '首都是？', '北京', '上海', '广州', 'A', '解析', '地理', '易', '常识', ''],
    ]

    const raws = rowsToRawQuestions(rows)

    expect(raws).toHaveLength(1)
    expect(raws[0]).toMatchObject({
      sourceRow: 2,
      typeText: '单选',
      stem: '首都是？',
      options: { A: '北京', B: '上海', C: '广州' },
      answerText: 'A',
      explanation: '解析',
      chapter: '地理',
      difficultyText: '易',
      tagsText: '常识',
    })
  })

  it('tolerates header spacing, case and option prefixes', () => {
    const rows = [
      [' question ', '题目', '选项 A', ' 选项b ', 'ANSWER'],
      ['单选', '题目内容', '甲', '乙', 'B'],
    ]

    const raws = rowsToRawQuestions(rows)
    expect(raws).toHaveLength(1)
    expect(raws[0].options).toEqual({ A: '甲', B: '乙' })
    expect(raws[0].answerText).toBe('B')
  })

  it('finds a header row below a title row', () => {
    const rows = [
      ['2025 年题库'],
      [],
      ['题型', '题干', '答案'],
      ['判断', '地球是圆的', '对'],
    ]

    const raws = rowsToRawQuestions(rows)
    expect(raws).toHaveLength(1)
    expect(raws[0].answerText).toBe('对')
  })

  it('skips empty rows and keeps source row numbers', () => {
    const rows = [
      ['题干', '答案'],
      ['第一题', 'A'],
      ['', ''],
      ['第二题', 'B'],
    ]

    const raws = rowsToRawQuestions(rows)
    expect(raws.map((raw) => raw.sourceRow)).toEqual([2, 4])
  })

  it('throws when no header is found', () => {
    expect(() => rowsToRawQuestions([['a', 'b']])).toThrow('未找到表头')
  })
})
