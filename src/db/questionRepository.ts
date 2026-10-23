import { db } from '@/db/db'
import type { Question, QuestionInput } from '@/types/quiz'

export async function listBankQuestions(bankId: string): Promise<Question[]> {
  return db.questions.where('bankId').equals(bankId).sortBy('order')
}

export async function createQuestion(
  bankId: string,
  input: QuestionInput,
): Promise<Question> {
  const bank = await db.banks.get(bankId)
  if (!bank) throw new Error('题库不存在')

  return db.transaction('rw', db.questions, db.banks, async () => {
    const last = await db.questions
      .where('bankId')
      .equals(bankId)
      .sortBy('order')
      .then((questions) => questions.at(-1))
    const now = Date.now()

    const question: Question = {
      ...input,
      id: crypto.randomUUID(),
      bankId,
      order: (last?.order ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    }

    await db.questions.add(question)
    await db.banks.update(bankId, { updatedAt: now })
    return question
  })
}

export async function updateQuestion(
  id: string,
  input: QuestionInput,
): Promise<void> {
  const existing = await db.questions.get(id)
  if (!existing) throw new Error('题目不存在')

  const now = Date.now()
  await db.transaction('rw', db.questions, db.banks, async () => {
    await db.questions.update(id, { ...input, updatedAt: now })
    await db.banks.update(existing.bankId, { updatedAt: now })
  })
}

export async function deleteQuestion(id: string): Promise<void> {
  const existing = await db.questions.get(id)
  if (!existing) return

  await db.transaction(
    'rw',
    db.questions,
    db.questionStates,
    db.answers,
    db.banks,
    async () => {
      await db.questions.delete(id)
      await db.questionStates.delete(id)
      await db.answers.where('questionId').equals(id).delete()
      await db.banks.update(existing.bankId, { updatedAt: Date.now() })
    },
  )
}
