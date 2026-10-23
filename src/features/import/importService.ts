import { db } from '@/db/db'
import type { Question } from '@/types/quiz'
import type { DraftQuestion } from '@/features/import/types'

export async function importQuestions(
  bankId: string,
  drafts: DraftQuestion[],
  skipDuplicates: boolean,
): Promise<number> {
  const selected = skipDuplicates
    ? drafts.filter((draft) => !draft.duplicate)
    : drafts

  if (selected.length === 0) return 0

  const bank = await db.banks.get(bankId)
  if (!bank) throw new Error('目标题库不存在')

  const existing = await db.questions
    .where('bankId')
    .equals(bankId)
    .toArray()
  let nextOrder = existing.reduce(
    (max, question) => Math.max(max, question.order),
    0,
  )

  const now = Date.now()
  const rows: Question[] = selected.map((draft) => {
    nextOrder += 1
    return {
      id: crypto.randomUUID(),
      bankId,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
      type: draft.type,
      stem: draft.stem,
      options: draft.options,
      answer: draft.answer,
      answerGroups: draft.answerGroups,
      referenceAnswer: draft.referenceAnswer,
      keywords: draft.keywords,
      explanation: draft.explanation,
      chapter: draft.chapter,
      difficulty: draft.difficulty,
      tags: draft.tags,
    }
  })

  await db.transaction('rw', db.questions, db.banks, async () => {
    await db.questions.bulkAdd(rows)
    await db.banks.update(bankId, { updatedAt: now })
  })

  return rows.length
}
