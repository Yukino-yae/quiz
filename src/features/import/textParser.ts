import type { ParseIssue, RawQuestion } from '@/features/import/types'

type Field =
  | 'answer'
  | 'explanation'
  | 'chapter'
  | 'difficulty'
  | 'tags'
  | 'keywords'

const FIELD_ALIASES: Record<string, Field> = {
  答案: 'answer',
  正确答案: 'answer',
  参考答案: 'answer',
  标准答案: 'answer',
  解析: 'explanation',
  答案解析: 'explanation',
  解释: 'explanation',
  章节: 'chapter',
  分类: 'chapter',
  知识点: 'chapter',
  模块: 'chapter',
  难度: 'difficulty',
  难易度: 'difficulty',
  标签: 'tags',
  tag: 'tags',
  tags: 'tags',
  关键词: 'keywords',
  关键字: 'keywords',
}

const TYPE_WORDS =
  '单项选择|多项选择|不定项选择|单选|多选|判断|是非|填空|简答|问答|论述|名词解释'

const NUMBER_PREFIX = /^\s*(?:第\s*)?\d{1,4}\s*(?:题)?\s*[.、．)）]\s*/
const QUESTION_NUMBER = /^\s*(?:第\s*)?\d{1,4}\s*(?:题)?\s*[.、．)）]\s*\S/
const TYPE_PREFIX = /^\s*[【[（(]\s*([^】\]）)]{1,24})\s*[】\]）)]\s*/

function stripNumberPrefix(line: string): string {
  return line.replace(NUMBER_PREFIX, '')
}

function parseTypeMarker(
  line: string,
): { typeText: string; rest: string } | null {
  const match = line.match(TYPE_PREFIX)
  if (!match || !new RegExp(TYPE_WORDS).test(match[1])) return null
  return {
    typeText: match[1].trim(),
    rest: line.slice(match[0].length),
  }
}

function isQuestionStart(line: string): boolean {
  if (QUESTION_NUMBER.test(line)) return true
  return parseTypeMarker(stripNumberPrefix(line)) !== null
}

function normalizeFieldKey(key: string): string {
  return key.replace(/[\s：:]/g, '').toLowerCase()
}

function matchField(
  line: string,
): { field: Field; value: string } | null {
  const bracket = line.match(
    /^\s*[【[]\s*([^】\]]{1,12})\s*[】\]]\s*[:：]?\s*(.*)$/,
  )
  if (bracket) {
    const field = FIELD_ALIASES[normalizeFieldKey(bracket[1])]
    if (field) return { field, value: bracket[2] }
  }

  const plain = line.match(/^\s*([^:：]{1,12})\s*[:：]\s*(.*)$/)
  if (plain) {
    const field = FIELD_ALIASES[normalizeFieldKey(plain[1])]
    if (field) return { field, value: plain[2] }
  }

  const spaced = line.match(
    /^\s*(参考答案|正确答案|答案|答案解析|解析|章节|分类|知识点|难度|标签|关键词|关键字)\s+(.+)$/,
  )
  if (spaced) {
    const field = FIELD_ALIASES[normalizeFieldKey(spaced[1])]
    if (field) return { field, value: spaced[2] }
  }

  return null
}

function parseOptionLine(
  line: string,
): Array<{ key: string; text: string }> | null {
  const trimmed = line.trim()
  const dotted = /^([A-Ha-h])\s*[.、．)）:：]\s*(.*)$/.exec(trimmed)
  const bracketed = /^[（(]\s*([A-Ha-h])\s*[）)]\s*(.*)$/.exec(trimmed)

  if (!dotted && !bracketed) return null

  if (dotted) {
    const pattern = /([A-Ha-h])\s*[.、．)）:：]\s*/g
    const matches = [...trimmed.matchAll(pattern)]
    if (matches.length > 1 && matches[0].index === 0) {
      return matches.map((match, index) => ({
        key: match[1].toUpperCase(),
        text: trimmed
          .slice(
            (match.index ?? 0) + match[0].length,
            matches[index + 1]?.index ?? trimmed.length,
          )
          .trim(),
      }))
    }
  }

  const match = dotted ?? bracketed
  if (!match) return null
  return [{ key: match[1].toUpperCase(), text: match[2].trim() }]
}

interface BlockResult {
  raw: RawQuestion
  issues: ParseIssue[]
}

function parseBlock(
  lines: string[],
  start: number,
  end: number,
): BlockResult {
  const sourceRow = start + 1
  const issues: ParseIssue[] = []

  let typeText = ''
  const stemLines: string[] = []
  const options: Record<string, string> = {}
  let currentOptionKey: string | null = null
  const answerLines: string[] = []
  const explanationLines: string[] = []
  let chapter = ''
  let difficultyText = ''
  let tagsText = ''
  let keywordsText = ''
  let answerFieldCount = 0

  let currentField:
    | Field
    | 'stem'
    | 'option' = 'stem'

  for (let index = start; index < end; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.replace(/ /g, ' ').trim()

    if (!line) {
      if (currentField === 'explanation') explanationLines.push('')
      continue
    }
    if (/^(?:#|\/\/)/.test(line)) continue

    const field = matchField(line)
    if (field) {
      currentOptionKey = null
      currentField = field.field

      if (field.field === 'answer') {
        answerFieldCount += 1
        answerLines.length = 0
        answerLines.push(field.value)
      } else if (field.field === 'explanation') {
        explanationLines.length = 0
        explanationLines.push(field.value)
      } else if (field.field === 'chapter') {
        chapter = field.value
      } else if (field.field === 'difficulty') {
        difficultyText = field.value
      } else if (field.field === 'tags') {
        tagsText = field.value
      } else {
        keywordsText = field.value
      }
      continue
    }

    const optionItems = parseOptionLine(line)
    if (optionItems) {
      currentField = 'option'
      for (const item of optionItems) {
        options[item.key] = item.text
        currentOptionKey = item.key
      }
      continue
    }

    if (currentField === 'option' && currentOptionKey) {
      const current = options[currentOptionKey] ?? ''
      options[currentOptionKey] = `${current} ${line}`.trim()
      continue
    }

    if (currentField === 'stem') {
      let content = line
      if (stemLines.length === 0) {
        content = stripNumberPrefix(content)
        const marker = parseTypeMarker(content)
        if (marker) {
          if (!typeText) typeText = marker.typeText
          content = marker.rest
        }
      }
      if (content.trim()) stemLines.push(content.trim())
      continue
    }

    if (currentField === 'answer') {
      answerLines.push(line)
    } else if (currentField === 'explanation') {
      explanationLines.push(line)
    } else if (currentField === 'chapter') {
      chapter = chapter ? `${chapter} ${line}` : line
    } else if (currentField === 'difficulty') {
      difficultyText = difficultyText ? `${difficultyText} ${line}` : line
    } else if (currentField === 'tags') {
      tagsText = tagsText ? `${tagsText} ${line}` : line
    } else if (currentField === 'keywords') {
      keywordsText = keywordsText ? `${keywordsText} ${line}` : line
    }
  }

  if (answerFieldCount > 1) {
    issues.push({
      row: sourceRow,
      level: 'warning',
      message: '同一题中出现了多个“答案”，可能缺少题号分隔',
      raw: stemLines.join(' ').slice(0, 200),
    })
  }

  return {
    raw: {
      sourceRow,
      typeText,
      stem: stemLines.join('\n').trim(),
      options,
      answerText: answerLines.join('\n').trim(),
      explanation: explanationLines.join('\n').trim(),
      chapter: chapter.trim(),
      difficultyText: difficultyText.trim(),
      tagsText: tagsText.trim(),
      keywordsText: keywordsText.trim(),
      raw: lines
        .slice(start, end)
        .filter((line) => line.trim())
        .join('\n')
        .slice(0, 600),
    },
    issues,
  }
}

export function parseTextQuestions(input: string): {
  raws: RawQuestion[]
  issues: ParseIssue[]
} {
  const normalized = input
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\u0000')
    .join('')

  const lines = normalized.split('\n')
  const issues: ParseIssue[] = []
  const isIgnored = (line: string) =>
    !line.trim() || /^\s*(?:#|\/\/)/.test(line)

  const starts: number[] = []
  lines.forEach((line, index) => {
    if (isIgnored(line)) return
    if (isQuestionStart(line)) starts.push(index)
  })

  if (starts.length === 0) {
    const firstContent = lines.findIndex((line) => !isIgnored(line))
    if (firstContent === -1) {
      return {
        raws: [],
        issues: [
          { row: 1, level: 'error', message: '文件中没有可解析的内容' },
        ],
      }
    }

    const block = parseBlock(lines, firstContent, lines.length)
    return { raws: [block.raw], issues: [...issues, ...block.issues] }
  }

  if (starts[0] > 0) {
    const preamble = lines
      .slice(0, starts[0])
      .filter((line) => !isIgnored(line))
    if (preamble.length > 0) {
      issues.push({
        row: 1,
        level: 'warning',
        message: '已忽略第一题之前的说明文字',
      })
    }
  }

  const raws: RawQuestion[] = []
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    const end = starts[index + 1] ?? lines.length
    const block = parseBlock(lines, start, end)
    raws.push(block.raw)
    issues.push(...block.issues)
  }

  return { raws, issues }
}
