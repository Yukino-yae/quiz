import { db } from '@/db/db'
import type { Bank } from '@/types/quiz'

export interface CreateBankInput {
  name: string
  description?: string
}

export async function listBanks(): Promise<Bank[]> {
  return db.banks.orderBy('createdAt').reverse().toArray()
}

export async function getBank(id: string): Promise<Bank | undefined> {
  return db.banks.get(id)
}

export async function createBank(input: CreateBankInput): Promise<Bank> {
  const name = input.name.trim()

  if (!name) {
    throw new Error('题库名称不能为空')
  }

  const now = Date.now()
  const bank: Bank = {
    id: crypto.randomUUID(),
    name,
    description: input.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  }

  await db.banks.add(bank)
  return bank
}
