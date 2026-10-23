import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, LibraryBig, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { NewBankDialog } from '@/components/NewBankDialog'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { db } from '@/db/db'
import { listBanks } from '@/db/bankRepository'
import { formatRelativeDate } from '@/lib/format'
import type { Bank } from '@/types/quiz'

function BankCard({ bank }: { bank: Bank }) {
  const questionCount = useLiveQuery(
    () => db.questions.where('bankId').equals(bank.id).count(),
    [bank.id],
  )

  return (
    <Link
      to={`/banks/${bank.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <LibraryBig className="size-5" strokeWidth={1.9} />
        </span>
        <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <h2 className="mt-3.5 truncate text-[15px] font-semibold">
        {bank.name}
      </h2>
      <p className="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted">
        {bank.description || '暂无简介'}
      </p>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
        <span className="font-medium text-fg">{questionCount ?? '—'}</span>
        道题
        <span className="text-border-strong">·</span>
        <span>{formatRelativeDate(bank.createdAt)}创建</span>
      </div>
    </Link>
  )
}

export default function BanksPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const banks = useLiveQuery(() => listBanks(), [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="题库"
        description="所有题库都保存在本机浏览器中，可以按科目或考试自由分类。"
        actions={
          <>
            <Link
              to="/import"
              className={buttonStyles({ variant: 'secondary' })}
            >
              <Upload className="size-4" />
              导入题库
            </Link>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              新建题库
            </Button>
          </>
        }
      />

      {banks === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[176px] animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : banks.length === 0 ? (
        <EmptyState
          icon={LibraryBig}
          title="还没有题库"
          description="先新建一个空题库，或者导入 Excel / CSV / TXT / Word 题目。题量不需要提前确定，导入时会自动统计。"
          action={
            <>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                新建题库
              </Button>
              <Link
                to="/import"
                className={buttonStyles({ variant: 'secondary' })}
              >
                导入题库
              </Link>
            </>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {banks.map((bank) => (
            <BankCard key={bank.id} bank={bank} />
          ))}
        </div>
      )}

      <NewBankDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(bank) => navigate(`/banks/${bank.id}`)}
      />
    </div>
  )
}
