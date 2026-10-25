import { z } from 'zod'
import { db } from '@/db/db'
import { downloadBlob } from '@/lib/download'
import {
  backupFileName,
  type BackupSource,
} from '@/features/backup/backupFileName'
import type {
  AnswerRecord,
  AppSetting,
  Bank,
  Question,
  QuestionState,
  Session,
} from '@/types/quiz'

const questionTypeSchema = z.enum([
  'single',
  'multiple',
  'judge',
  'fill',
  'short',
])

const difficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

const bankSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().default(''),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const questionSchema = z.object({
  id: z.string().min(1),
  bankId: z.string().min(1),
  type: questionTypeSchema,
  stem: z.string(),
  options: z
    .array(z.object({ key: z.string(), text: z.string() }))
    .default([]),
  answer: z.array(z.string()).default([]),
  answerGroups: z.array(z.array(z.string())).default([]),
  referenceAnswer: z.string().default(''),
  keywords: z.array(z.string()).default([]),
  explanation: z.string().default(''),
  chapter: z.string().default(''),
  difficulty: difficultySchema.default(2),
  tags: z.array(z.string()).default([]),
  order: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const questionStateSchema = z.object({
  questionId: z.string().min(1),
  bankId: z.string().min(1),
  status: z.enum(['new', 'learning', 'mastered']).default('new'),
  favorite: z.boolean().default(false),
  wrongCount: z.number().default(0),
  correctStreak: z.number().default(0),
  lastResult: z.boolean().optional(),
  lastAnsweredAt: z.number().optional(),
})

const sessionSchema = z.object({
  id: z.string().min(1),
  bankId: z.string().min(1),
  mode: z.enum([
    'sequence',
    'random',
    'wrong',
    'favorite',
    'exam',
    'review',
  ]),
  config: z
    .object({
      count: z.number().optional(),
      chapters: z.array(z.string()).optional(),
      types: z.array(questionTypeSchema).optional(),
      difficulties: z.array(difficultySchema).optional(),
      durationSec: z.number().optional(),
      passScore: z.number().optional(),
    })
    .default({}),
  questionIds: z.array(z.string()).default([]),
  cursor: z.number().default(0),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  score: z.number().optional(),
  elapsedSec: z.number().optional(),
})

const answerSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string(),
  questionId: z.string(),
  bankId: z.string(),
  selected: z.array(z.string()).default([]),
  correct: z.boolean(),
  timeSpentMs: z.number().default(0),
  answeredAt: z.number(),
})

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
})

const backupSchema = z.object({
  app: z.literal('quiz'),
  version: z.literal(1),
  exportedAt: z.number(),
  data: z.object({
    banks: z.array(bankSchema),
    questions: z.array(questionSchema),
    questionStates: z.array(questionStateSchema),
    sessions: z.array(sessionSchema),
    answers: z.array(answerSchema),
    settings: z.array(settingSchema).default([]),
  }),
})

export type BackupPayload = z.infer<typeof backupSchema>
export type RestoreMode = 'merge' | 'replace'

export interface BackupSummary {
  banks: number
  questions: number
  questionStates: number
  sessions: number
  answers: number
}

export interface RestoreResult extends BackupSummary {
  addedBanks: number
  addedQuestions: number
}

export async function createBackup(): Promise<Blob> {
  const [banks, questions, questionStates, sessions, answers, settings] =
    await Promise.all([
      db.banks.toArray(),
      db.questions.toArray(),
      db.questionStates.toArray(),
      db.sessions.toArray(),
      db.answers.toArray(),
      db.settings.toArray(),
    ])

  const payload: BackupPayload = {
    app: 'quiz',
    version: 1,
    exportedAt: Date.now(),
    data: {
      banks,
      questions,
      questionStates,
      sessions,
      answers,
      settings,
    },
  }

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
}

/**
 * Snapshot everything up to now and download it. The payload is read at call
 * time, so a manual export includes every record written before the click.
 */
export async function exportBackup(
  source: BackupSource = 'manual',
): Promise<string> {
  const blob = await createBackup()
  const fileName = backupFileName(source)
  downloadBlob(blob, fileName)
  return fileName
}

export async function readBackupFile(file: File): Promise<BackupPayload> {
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('备份文件超过 100 MB，无法导入。')
  }

  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('无法读取备份文件，请确认它是有效的 JSON 文件。')
  }

  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('备份文件格式不正确，可能不是本系统导出的文件。')
  }

  return parsed.data
}

export function summarizeBackup(payload: BackupPayload): BackupSummary {
  const { data } = payload
  return {
    banks: data.banks.length,
    questions: data.questions.length,
    questionStates: data.questionStates.length,
    sessions: data.sessions.length,
    answers: data.answers.length,
  }
}

async function mergeTable<T>(
  table: { bulkGet: (keys: string[]) => Promise<Array<T | undefined>>; bulkPut: (rows: T[]) => Promise<unknown> },
  rows: T[],
  getKey: (row: T) => string,
): Promise<void> {
  if (rows.length === 0) return
  const existing = await table.bulkGet(rows.map(getKey))
  const existingKeys = new Set(
    existing.filter((row): row is T => Boolean(row)).map(getKey),
  )
  const missing = rows.filter((row) => !existingKeys.has(getKey(row)))
  if (missing.length > 0) await table.bulkPut(missing)
}

export async function restoreBackup(
  payload: BackupPayload,
  mode: RestoreMode,
): Promise<RestoreResult> {
  const { data } = payload
  const [currentBanks, currentQuestions] = await Promise.all([
    db.banks.count(),
    db.questions.count(),
  ])

  await db.transaction(
    'rw',
    [
      db.banks,
      db.questions,
      db.questionStates,
      db.sessions,
      db.answers,
      db.settings,
    ],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.banks.clear(),
          db.questions.clear(),
          db.questionStates.clear(),
          db.sessions.clear(),
          db.answers.clear(),
          db.settings.clear(),
        ])
      }

      if (mode === 'replace') {
        await db.banks.bulkPut(data.banks as Bank[])
        await db.questions.bulkPut(data.questions as Question[])
        await db.questionStates.bulkPut(
          data.questionStates as QuestionState[],
        )
        await db.sessions.bulkPut(data.sessions as Session[])
        await db.answers.bulkPut(data.answers as AnswerRecord[])
        await db.settings.bulkPut(data.settings as AppSetting[])
        return
      }

      await mergeTable(db.banks, data.banks as Bank[], (bank) => bank.id)
      await mergeTable(
        db.questions,
        data.questions as Question[],
        (question) => question.id,
      )
      await mergeTable(
        db.questionStates,
        data.questionStates as QuestionState[],
        (state) => state.questionId,
      )
      await mergeTable(db.sessions, data.sessions as Session[], (session) => session.id)
      await mergeTable(db.answers, data.answers as AnswerRecord[], (answer) => answer.id)
      await mergeTable(db.settings, data.settings as AppSetting[], (setting) => setting.key)
    },
  )

  const [banks, questions] = await Promise.all([
    db.banks.count(),
    db.questions.count(),
  ])

  return {
    ...summarizeBackup(payload),
    addedBanks: Math.max(0, banks - currentBanks),
    addedQuestions: Math.max(0, questions - currentQuestions),
  }
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.banks,
      db.questions,
      db.questionStates,
      db.sessions,
      db.answers,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.banks.clear(),
        db.questions.clear(),
        db.questionStates.clear(),
        db.sessions.clear(),
        db.answers.clear(),
        db.settings.clear(),
      ])
    },
  )
}
