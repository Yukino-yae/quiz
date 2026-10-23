import writeXlsxFile from 'write-excel-file/browser'
import { downloadBlob } from '@/lib/download'
import { QUESTION_TYPE_LABELS } from '@/lib/labels'
import type { ParseIssue, DraftQuestion } from '@/features/import/types'
import type { QuestionInput } from '@/types/quiz'

export const TEMPLATE_HEADERS = [
  '题型',
  '题干',
  '选项A',
  '选项B',
  '选项C',
  '选项D',
  '选项E',
  '选项F',
  '选项G',
  '选项H',
  '答案',
  '解析',
  '章节',
  '难度',
  '标签',
  '关键词',
]

export const TEMPLATE_EXAMPLES: string[][] = [
  [
    '单选',
    '中国的首都是哪座城市？',
    '北京',
    '上海',
    '广州',
    '深圳',
    '',
    '',
    '',
    '',
    'A',
    '北京是中华人民共和国的首都。',
    '地理',
    '易',
    '常识',
    '',
  ],
  [
    '多选',
    '以下哪些属于编程语言？',
    'JavaScript',
    'Python',
    'HTML',
    'TypeScript',
    '',
    '',
    '',
    '',
    'ABD',
    'HTML 是标记语言，不是编程语言。',
    '计算机',
    '中',
    '基础',
    '',
  ],
  [
    '判断',
    '标准大气压下，水的沸点是 100°C。',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '对',
    '',
    '物理',
    '易',
    '常识',
    '',
  ],
  [
    '填空',
    '中国的首都是____，人口最多的城市是____。',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '北京|首都；上海',
    '第一个空接受“北京”或“首都”两种写法。',
    '地理',
    '中',
    '',
    '',
  ],
  [
    '简答',
    '简述光合作用对地球生命的意义。',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '光合作用把光能转化为化学能，制造有机物，并释放氧气，是生态系统能量的起点。',
    '',
    '生物',
    '难',
    '重点',
    '光能|有机物|氧气',
  ],
]

export const TXT_TEMPLATE = `# 刷题题库 TXT 模板
# 以“1.”、“2、”这样的编号分隔题目；选项写成 A. / B. / C.；答案、解析等字段可选。
# 空行、以 # 或 // 开头的行会被忽略。

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
解析：HTML 是标记语言，不是编程语言。

3. 【判断】标准大气压下，水的沸点是 100°C。
答案：对

4. 【填空】中国的首都是____，人口最多的城市是____。
答案：北京|首都；上海

5. 【简答】简述光合作用对地球生命的意义。
答案：光合作用把光能转化为化学能，制造有机物，并释放氧气。
关键词：光能|有机物|氧气
`

function formatAnswer(question: QuestionInput): string {
  if (question.type === 'single' || question.type === 'multiple') {
    return question.answer.join('')
  }
  if (question.type === 'judge') {
    return question.answer[0] === 'true' ? '对' : '错'
  }
  if (question.type === 'fill') {
    return question.answerGroups.map((group) => group.join('|')).join('；')
  }
  return question.referenceAnswer
}

export function questionsToRows(questions: QuestionInput[]): string[][] {
  return questions.map((question) => {
    const optionText = new Map(
      question.options.map((option) => [option.key, option.text]),
    )
    return [
      QUESTION_TYPE_LABELS[question.type],
      question.stem,
      ...'ABCDEFGH'.split('').map((key) => optionText.get(key) ?? ''),
      formatAnswer(question),
      question.explanation,
      question.chapter,
      question.difficulty === 1 ? '易' : question.difficulty === 3 ? '难' : '中',
      question.tags.join(','),
      question.type === 'short' ? question.keywords.join('|') : '',
    ]
  })
}

export function toCsv(rows: string[][]): string {
  return (
    rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '')
            return /[",\n\r]/.test(value)
              ? `"${value.replace(/"/g, '""')}"`
              : value
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  )
}

export { downloadBlob } from '@/lib/download'

export function downloadCsv(rows: string[][], fileName: string) {
  downloadBlob(
    new Blob(['﻿', toCsv(rows)], {
      type: 'text/csv;charset=utf-8',
    }),
    fileName,
  )
}

export async function downloadXlsx(rows: string[][], fileName: string) {
  const sheetData = rows.map((row, rowIndex) =>
    row.map((value) => ({
      value,
      ...(rowIndex === 0
        ? { fontWeight: 'bold' as const, backgroundColor: '#EEF2FF' }
        : {}),
      wrap: true,
    })),
  )

  await writeXlsxFile(sheetData, {
    sheet: '题目',
    columns: [
      { width: 7 },
      { width: 42 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 36 },
      { width: 12 },
      { width: 7 },
      { width: 14 },
      { width: 16 },
    ],
  }).toFile(fileName)
}

export function downloadTemplateCsv() {
  downloadCsv(
    [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES],
    '刷题题库导入模板.csv',
  )
}

export async function downloadTemplateXlsx() {
  await downloadXlsx(
    [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES],
    '刷题题库导入模板.xlsx',
  )
}

export function downloadTemplateTxt() {
  downloadBlob(
    new Blob([TXT_TEMPLATE], { type: 'text/plain;charset=utf-8' }),
    '刷题题库导入模板.txt',
  )
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || '题目'
}

export function downloadParsedCsv(questions: DraftQuestion[], fileName: string) {
  downloadCsv(
    [TEMPLATE_HEADERS, ...questionsToRows(questions)],
    `${baseName(fileName)}-已解析.csv`,
  )
}

export async function downloadParsedXlsx(
  questions: DraftQuestion[],
  fileName: string,
) {
  await downloadXlsx(
    [TEMPLATE_HEADERS, ...questionsToRows(questions)],
    `${baseName(fileName)}-已解析.xlsx`,
  )
}

export function downloadIssuesCsv(issues: ParseIssue[], fileName: string) {
  downloadCsv(
    [
      ['行号', '级别', '说明', '原内容'],
      ...issues.map((issue) => [
        issue.row > 0 ? String(issue.row) : '文件',
        issue.level === 'error' ? '错误' : '警告',
        issue.message,
        issue.raw ?? '',
      ]),
    ],
    `${baseName(fileName)}-校验结果.csv`,
  )
}
