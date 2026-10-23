import type { RawQuestion } from '@/features/import/types'

type FieldKey =
  | 'type'
  | 'stem'
  | 'answer'
  | 'explanation'
  | 'chapter'
  | 'difficulty'
  | 'tags'
  | 'keywords'

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  type: ['题型', '类型', '题目类型', 'questiontype', 'type'],
  stem: ['题干', '题目', '问题', '题目内容', 'stem', 'question'],
  answer: ['答案', '正确答案', '参考答案', '标准答案', 'answer'],
  explanation: ['解析', '答案解析', '解释', '题目解析', 'explanation'],
  chapter: ['章节', '分类', '知识点', '模块', '所属章节', 'chapter'],
  difficulty: ['难度', '难易度', 'difficulty'],
  tags: ['标签', 'tag', 'tags'],
  keywords: ['关键词', '关键字', 'keywords'],
}

const FIELD_BY_ALIAS = new Map<string, FieldKey>()
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
  [FieldKey, string[]]
>) {
  for (const alias of aliases) {
    FIELD_BY_ALIAS.set(alias, field)
  }
}

interface ColumnMap {
  type?: number
  stem?: number
  answer?: number
  explanation?: number
  chapter?: number
  difficulty?: number
  tags?: number
  keywords?: number
  options: Record<string, number>
}

export function toCellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function normalizeHeader(value: unknown): string {
  return toCellText(value)
    .replace(/[\s *＊]/g, '')
    .replace(/[（(]/g, '')
    .replace(/[）)]/g, '')
    .toLowerCase()
}

function buildColumnMap(row: unknown[]): ColumnMap {
  const map: ColumnMap = { options: {} }

  row.forEach((cell, index) => {
    const header = normalizeHeader(cell)
    if (!header) return

    const field = FIELD_BY_ALIAS.get(header)
    if (field && map[field] === undefined) {
      map[field] = index
      return
    }

    const option = /^(?:选项)?([a-h])$/.exec(header)
    if (option && map.options[option[1].toUpperCase()] === undefined) {
      map.options[option[1].toUpperCase()] = index
    }
  })

  return map
}

export function rowsToRawQuestions(rows: unknown[][]): RawQuestion[] {
  let headerRowIndex = -1
  let columns: ColumnMap | null = null

  for (let index = 0; index < Math.min(rows.length, 15); index += 1) {
    const candidate = buildColumnMap(rows[index])
    if (candidate.stem !== undefined && candidate.answer !== undefined) {
      headerRowIndex = index
      columns = candidate
      break
    }
  }

  if (!columns || headerRowIndex === -1) {
    throw new Error(
      '未找到表头：第一行需要包含“题干”和“答案”列，可以直接下载模板填写。',
    )
  }

  const raws: RawQuestion[] = []

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    if (row.every((cell) => !toCellText(cell))) continue

    const get = (column?: number) =>
      column === undefined ? '' : toCellText(row[column])

    const options: Record<string, string> = {}
    for (const [key, column] of Object.entries(columns.options)) {
      const text = get(column)
      if (text) options[key] = text
    }

    const stem = get(columns.stem)
    const answerText = get(columns.answer)
    if (!stem.trim() && !answerText.trim()) continue

    raws.push({
      sourceRow: index + 1,
      typeText: get(columns.type),
      stem,
      options,
      answerText,
      explanation: get(columns.explanation),
      chapter: get(columns.chapter),
      difficultyText: get(columns.difficulty),
      tagsText: get(columns.tags),
      keywordsText: get(columns.keywords),
      raw: row
        .map(toCellText)
        .filter(Boolean)
        .join(' | ')
        .slice(0, 600),
    })
  }

  return raws
}
