import { QUESTION_TYPE_LABELS } from '@/lib/labels'
import type {
  Difficulty,
  QuestionInput,
  QuestionOption,
  QuestionType,
} from '@/types/quiz'
import type { ParseIssue, RawQuestion } from '@/features/import/types'

const TYPE_PATTERNS: Array<[RegExp, QuestionType]> = [
  [/多选|多项|不定项/, 'multiple'],
  [/单选|单项|选择/, 'single'],
  [/判断|是非/, 'judge'],
  [/填空/, 'fill'],
  [/简答|问答|论述|名词解释/, 'short'],
]

function normalizeAsciiLetter(text: string): string {
  return text.replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  )
}

function uniqueLetters(text: string): string[] {
  const letters = normalizeAsciiLetter(text).toUpperCase().match(/[A-H]/g) ?? []
  return Array.from(new Set(letters)).sort()
}

function parseJudgeAnswer(text: string): 'true' | 'false' | null {
  const normalized = text
    .normalize('NFKC')
    .replace(/[\s。.．,，、:：;；'"“”‘’]/g, '')
    .toLowerCase()

  if (['对', '正确', '是', '√', '✓', 'true', 't', '1', 'yes', 'y'].includes(normalized)) {
    return 'true'
  }
  if (['错', '错误', '否', '×', '✗', 'false', 'f', '0', 'no', 'n'].includes(normalized)) {
    return 'false'
  }
  return null
}

function parseFillAnswer(text: string): string[][] {
  return text
    .split(/[；;]/)
    .map((group) =>
      group
        .split(/[|｜]/)
        .map((value) => value.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length > 0)
}

function countBlanks(stem: string): number {
  return (stem.match(/_{2,}|＿{2,}/g) ?? []).length
}

function splitList(text: string): string[] {
  return text
    .split(/[|｜,，、;；]/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function inferType(raw: RawQuestion): QuestionType {
  const optionCount = Object.values(raw.options).filter((text) =>
    text.trim(),
  ).length

  if (optionCount >= 2) {
    return uniqueLetters(raw.answerText).length > 1 ? 'multiple' : 'single'
  }
  if (parseJudgeAnswer(raw.answerText) !== null) return 'judge'
  if (countBlanks(raw.stem) > 0) return 'fill'
  return 'short'
}

function resolveType(raw: RawQuestion): {
  type: QuestionType
  warning?: string
} {
  const typeText = raw.typeText
    .replace(/【|】|\[|\]|（|）|\(|\)/g, '')
    .trim()

  if (!typeText) {
    return { type: inferType(raw) }
  }

  for (const [pattern, type] of TYPE_PATTERNS) {
    if (pattern.test(typeText)) return { type }
  }

  const inferred = inferType(raw)
  return {
    type: inferred,
    warning: `无法识别题型“${raw.typeText}”，已推断为${QUESTION_TYPE_LABELS[inferred]}`,
  }
}

function parseDifficulty(text: string): {
  value: Difficulty
  warning?: string
} {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return { value: 2 }

  if (/^(易|简单|低|easy|1)$/.test(normalized)) return { value: 1 }
  if (/^(中|中等|一般|medium|2)$/.test(normalized)) return { value: 2 }
  if (/^(难|困难|高|hard|3)$/.test(normalized)) return { value: 3 }

  return {
    value: 2,
    warning: `无法识别难度“${text}”，已按“中”处理`,
  }
}

export function normalizeQuestion(raw: RawQuestion): {
  question: QuestionInput | null
  issues: ParseIssue[]
} {
  const issues: ParseIssue[] = []
  const addIssue = (level: ParseIssue['level'], message: string) => {
    issues.push({ row: raw.sourceRow, level, message, raw: raw.raw })
  }

  const stem = raw.stem.replace(/ /g, ' ').trim()
  if (!stem) addIssue('error', '题干为空')

  const typeResult = resolveType(raw)
  if (typeResult.warning) addIssue('warning', typeResult.warning)
  const type = typeResult.type

  const options: QuestionOption[] = Object.entries(raw.options)
    .map(([key, text]) => ({ key: key.toUpperCase(), text: text.trim() }))
    .filter((option) => option.text)
    .sort((a, b) => a.key.localeCompare(b.key))

  const answerText = raw.answerText.replace(/\r/g, '').trim()
  if (!answerText) addIssue('error', '缺少答案')

  let answer: string[] = []
  let answerGroups: string[][] = []
  let referenceAnswer = ''
  let keywords: string[] = []

  if (type === 'single' || type === 'multiple') {
    if (options.length < 2) {
      addIssue('error', '选择题至少需要两个选项')
    }

    const optionKeys = new Set(options.map((option) => option.key))
    const source =
      type === 'single'
        ? (answerText.split('\n').find((line) => line.trim()) ?? '')
        : answerText
    const letters = uniqueLetters(source)

    if (letters.length === 0) {
      addIssue(
        'error',
        type === 'single'
          ? '无法识别单选答案，请填写选项字母（如 A）'
          : '无法识别多选答案，请填写选项字母（如 ABC）',
      )
    }
    if (type === 'single' && letters.length > 1) {
      addIssue('error', '单选题只能有一个答案')
    }
    for (const key of letters) {
      if (!optionKeys.has(key)) {
        addIssue('error', `答案 ${key} 不在选项 A–${[...optionKeys].sort().at(-1) ?? '?'} 中`)
      }
    }
    if (type === 'multiple' && letters.length === 1) {
      addIssue('warning', '多选题只有一个答案')
    }

    answer = letters
  } else if (type === 'judge') {
    if (options.length > 0) addIssue('warning', '判断题的选项列会被忽略')
    const value = parseJudgeAnswer(answerText)
    if (!value) {
      addIssue('error', '判断题答案请填写“对”或“错”')
    } else {
      answer = [value]
    }
  } else if (type === 'fill') {
    if (options.length > 0) addIssue('warning', '填空题的选项列会被忽略')
    answerGroups = parseFillAnswer(answerText)
    if (answerGroups.length === 0) addIssue('error', '填空题答案为空')

    const blankCount = countBlanks(stem)
    if (blankCount === 0) {
      addIssue('warning', '题干中没有找到 ____ 空位标记')
    } else if (blankCount !== answerGroups.length) {
      addIssue(
        'warning',
        `题干有 ${blankCount} 个空，答案分成了 ${answerGroups.length} 组`,
      )
    }
  } else {
    if (options.length > 0) addIssue('warning', '简答题的选项列会被忽略')
    referenceAnswer = answerText
    keywords = splitList(raw.keywordsText)
  }

  const difficultyResult = parseDifficulty(raw.difficultyText)
  if (difficultyResult.warning) addIssue('warning', difficultyResult.warning)
  const tags = splitList(raw.tagsText)

  if (issues.some((issue) => issue.level === 'error')) {
    return { question: null, issues }
  }

  return {
    question: {
      type,
      stem,
      options: type === 'single' || type === 'multiple' ? options : [],
      answer,
      answerGroups,
      referenceAnswer,
      keywords,
      explanation: raw.explanation.trim(),
      chapter: raw.chapter.trim(),
      difficulty: difficultyResult.value,
      tags,
    },
    issues,
  }
}

export function questionKey(question: Pick<QuestionInput, 'type' | 'stem'>): string {
  return `${question.type}|${question.stem.replace(/\s+/g, '').toLowerCase()}`
}
