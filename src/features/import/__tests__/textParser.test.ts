import { describe, expect, it } from 'vitest'
import { parseTextQuestions } from '@/features/import/textParser'

describe('parseTextQuestions', () => {
  it('splits numbered questions and reads fields', () => {
    const result = parseTextQuestions(`
1. 【单选】中国的首都是哪座城市？
A. 北京
B. 上海
C. 广州
D. 深圳
答案：A
解析：北京是中华人民共和国的首都。
章节：地理
难度：易
标签：常识

2. 【多选】以下哪些属于编程语言？
A. JavaScript
B. Python
C. HTML
D. TypeScript
答案：ABD
解析：HTML 是标记语言。
`)

    expect(result.raws).toHaveLength(2)

    expect(result.raws[0]).toMatchObject({
      typeText: '单选',
      stem: '中国的首都是哪座城市？',
      options: { A: '北京', B: '上海', C: '广州', D: '深圳' },
      answerText: 'A',
      explanation: '北京是中华人民共和国的首都。',
      chapter: '地理',
      difficultyText: '易',
      tagsText: '常识',
    })

    expect(result.raws[1].typeText).toBe('多选')
    expect(result.raws[1].options.B).toBe('Python')
    expect(result.raws[1].answerText).toBe('ABD')
  })

  it('parses inline options on one line', () => {
    const result = parseTextQuestions(`1. 首都是哪里？
A. 北京 B. 上海 C. 广州
答案：A`)

    expect(result.raws).toHaveLength(1)
    expect(result.raws[0].options).toEqual({
      A: '北京',
      B: '上海',
      C: '广州',
    })
    expect(result.raws[0].answerText).toBe('A')
  })

  it('supports bracketed and spaced fields', () => {
    const result = parseTextQuestions(`1、判断题
【答案】对
解析 这是解析
章节 第一章`)

    expect(result.raws[0].answerText).toBe('对')
    expect(result.raws[0].explanation).toBe('这是解析')
    expect(result.raws[0].chapter).toBe('第一章')
  })

  it('warns about ignored preamble text', () => {
    const result = parseTextQuestions(`下面是题库说明，会被忽略。

1. 【判断】地球是圆的。
答案：对`)

    expect(result.raws).toHaveLength(1)
    expect(
      result.issues.some((issue) => issue.message.includes('说明文字')),
    ).toBe(true)
  })

  it('parses a single unnumbered question', () => {
    const result = parseTextQuestions(`【填空】中国的首都是____。
答案：北京`)

    expect(result.raws).toHaveLength(1)
    expect(result.raws[0].typeText).toBe('填空')
    expect(result.raws[0].stem).toBe('中国的首都是____。')
    expect(result.raws[0].answerText).toBe('北京')
  })

  it('supports multi-line answers and explanations', () => {
    const result = parseTextQuestions(`1. 简答题
答案：第一行
第二行
解析：解析第一行
解析第二行`)

    expect(result.raws[0].answerText).toBe('第一行\n第二行')
    expect(result.raws[0].explanation).toBe('解析第一行\n解析第二行')
  })

  it('warns when several answer fields appear in one block', () => {
    const result = parseTextQuestions(`1. 题目
答案：A
答案：B`)

    expect(
      result.issues.some((issue) => issue.message.includes('多个“答案”')),
    ).toBe(true)
  })

  it('reports empty input', () => {
    const result = parseTextQuestions('   \n\n')
    expect(result.raws).toHaveLength(0)
    expect(result.issues[0].message).toBe('文件中没有可解析的内容')
  })
})
