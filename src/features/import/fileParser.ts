import * as mammoth from 'mammoth'
import { parse as parseCsv } from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import { db } from '@/db/db'
import { decodeTextBuffer } from '@/features/import/encoding'
import { normalizeQuestion, questionKey } from '@/features/import/normalize'
import { rowsToRawQuestions } from '@/features/import/tableParser'
import { parseTextQuestions } from '@/features/import/textParser'
import type {
  DraftQuestion,
  ImportFileType,
  ParseIssue,
  ParseResult,
  RawQuestion,
} from '@/features/import/types'

interface RawFileResult {
  raws: RawQuestion[]
  issues: ParseIssue[]
}

const FILE_TYPES: Record<string, ImportFileType> = {
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  csv: 'csv',
  txt: 'txt',
  md: 'txt',
  docx: 'docx',
}

export function detectFileType(fileName: string): ImportFileType {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''

  if (extension === 'doc') {
    throw new Error(
      '暂不支持旧版 .doc 文件，请在 Word 中另存为 .docx 后再导入。',
    )
  }
  if (extension === 'xls') {
    throw new Error(
      '暂不支持旧版 .xls 文件，请在 Excel 中另存为 .xlsx 后再导入。',
    )
  }

  const type = FILE_TYPES[extension]
  if (!type) {
    throw new Error('支持的文件格式：.xlsx / .csv / .txt / .docx')
  }
  return type
}

async function readSpreadsheet(file: File): Promise<RawFileResult> {
  const sheets = await readXlsxFile(file, { trim: true })
  const raws: RawQuestion[] = []
  let lastError: unknown = null

  for (const sheet of sheets) {
    try {
      raws.push(...rowsToRawQuestions(sheet.data as unknown[][]))
    } catch (error) {
      lastError = error
    }
  }

  if (raws.length === 0) {
    if (lastError instanceof Error) throw lastError
    throw new Error('表格中没有读取到题目行')
  }

  return { raws, issues: [] }
}

async function readCsvFile(file: File): Promise<RawFileResult> {
  const text = decodeTextBuffer(await file.arrayBuffer())
  const parsed = parseCsv<string[]>(text, {
    skipEmptyLines: 'greedy',
  })

  const fatalError = parsed.errors.find(
    (error) => error.type === 'Quotes' || error.type === 'Delimiter',
  )
  if (fatalError) {
    throw new Error(`CSV 解析失败：${fatalError.message}`)
  }

  const raws = rowsToRawQuestions(parsed.data as unknown[][])
  if (raws.length === 0) throw new Error('CSV 中没有读取到题目行')

  return { raws, issues: [] }
}

async function readTextFile(file: File): Promise<RawFileResult> {
  const text = decodeTextBuffer(await file.arrayBuffer())
  const parsed = parseTextQuestions(text)
  return { raws: parsed.raws, issues: parsed.issues }
}

async function readDocxFile(file: File): Promise<RawFileResult> {
  const arrayBuffer = await file.arrayBuffer()
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer })
  const issues: ParseIssue[] = []

  if (/<img\b/i.test(htmlResult.value)) {
    issues.push({
      row: 0,
      level: 'warning',
      message: 'Word 文档中的图片不会被导入，题目文字仍可正常解析。',
    })
  }

  const document = new DOMParser().parseFromString(
    htmlResult.value,
    'text/html',
  )

  const tableRaws: RawQuestion[] = []
  for (const table of Array.from(document.querySelectorAll('table'))) {
    const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th,td')).map(
        (cell) => cell.textContent ?? '',
      ),
    )

    try {
      tableRaws.push(...rowsToRawQuestions(rows))
    } catch {
      // Not a question table; keep looking, then fall back to plain text.
    }
  }
  if (tableRaws.length > 0) return { raws: tableRaws, issues }

  const textResult = await mammoth.extractRawText({
    arrayBuffer: arrayBuffer.slice(0),
  })
  const parsed = parseTextQuestions(textResult.value)

  return {
    raws: parsed.raws,
    issues: [...issues, ...parsed.issues],
  }
}

async function readRawQuestions(
  file: File,
  fileType: ImportFileType,
): Promise<RawFileResult> {
  if (fileType === 'xlsx') return readSpreadsheet(file)
  if (fileType === 'csv') return readCsvFile(file)
  if (fileType === 'docx') return readDocxFile(file)
  return readTextFile(file)
}

export async function parseImportFile(
  file: File,
  targetBankId?: string,
): Promise<ParseResult> {
  const fileType = detectFileType(file.name)
  const parsed = await readRawQuestions(file, fileType)
  const issues: ParseIssue[] = [...parsed.issues]

  const drafts: DraftQuestion[] = []
  for (const raw of parsed.raws) {
    const normalized = normalizeQuestion(raw)
    issues.push(...normalized.issues)
    if (normalized.question) {
      drafts.push({
        ...normalized.question,
        sourceRow: raw.sourceRow,
        duplicate: false,
      })
    }
  }

  const existingQuestions = targetBankId
    ? await db.questions.where('bankId').equals(targetBankId).toArray()
    : []
  const existingKeys = new Set(
    existingQuestions.map((question) => questionKey(question)),
  )
  const seenInFile = new Map<string, number>()

  const questions = drafts.map((draft) => {
    const key = questionKey(draft)
    const firstRow = seenInFile.get(key)
    let duplicate = false

    if (firstRow !== undefined) {
      duplicate = true
      issues.push({
        row: draft.sourceRow,
        level: 'warning',
        message: `与第 ${firstRow} 行的题目重复`,
        raw: draft.stem.slice(0, 200),
      })
    } else if (existingKeys.has(key)) {
      duplicate = true
      issues.push({
        row: draft.sourceRow,
        level: 'warning',
        message: '目标题库中已存在相同题目',
        raw: draft.stem.slice(0, 200),
      })
    }

    if (firstRow === undefined) seenInFile.set(key, draft.sourceRow)
    return { ...draft, duplicate }
  })

  if (
    questions.length === 0 &&
    !issues.some((issue) => issue.level === 'error')
  ) {
    issues.push({
      row: 0,
      level: 'error',
      message: '没有识别到可导入的题目，请检查文件格式。',
    })
  }

  return {
    fileName: file.name,
    fileType,
    rows: parsed.raws.length,
    questions,
    issues,
    duplicateCount: questions.filter((question) => question.duplicate).length,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
  }
}
