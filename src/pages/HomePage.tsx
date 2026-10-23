import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  LibraryBig,
  Plus,
  Sparkles,
  Target,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { db } from '@/db/db'
import { formatRelativeDate } from '@/lib/format'

export default function HomePage() {
  const summary = useLiveQuery(async () => {
    const startOfDay = dayjs().startOf('day').valueOf()
    const [bankCount, questionCount, todayAnswers] = await Promise.all([
      db.banks.count(),
      db.questions.count(),
      db.answers.where('answeredAt').aboveOrEqual(startOfDay).toArray(),
    ])
    const correctCount = todayAnswers.filter((answer) => answer.correct).length

    return {
      bankCount,
      questionCount,
      todayCount: todayAnswers.length,
      correctCount,
    }
  }, [])

  const recentBanks = useLiveQuery(
    () => db.banks.orderBy('createdAt').reverse().limit(3).toArray(),
    [],
  )

  const activeSession = useLiveQuery(async () => {
    const sessions = await db.sessions
      .filter((session) => !session.finishedAt)
      .toArray()
    sessions.sort((a, b) => b.startedAt - a.startedAt)
    const session = sessions[0]
    if (!session) return undefined
    const bank = await db.banks.get(session.bankId)
    return { ...session, bankName: bank?.name ?? '已删除的题库' }
  }, [])

  const hasBanks = (summary?.bankCount ?? 0) > 0
  const accuracy =
    summary && summary.todayCount > 0
      ? `${Math.round((summary.correctCount / summary.todayCount) * 100)}%`
      : '—'

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary-soft blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-20 size-56 rounded-full bg-success-soft blur-3xl"
        />

        <div className="relative">
          <Badge tone="primary">
            <Sparkles className="size-3" />
            数据只存本机
          </Badge>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            今天也来刷几题
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted sm:text-[15px]">
            导入题库，按章节练习、整理错题，看着正确率一点点上涨。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={hasBanks ? '/banks' : '/import'}
              className={buttonStyles({ size: 'lg' })}
            >
              {hasBanks ? '选择题库' : '导入题库'}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/banks"
              className={buttonStyles({ variant: 'secondary', size: 'lg' })}
            >
              <Plus className="size-4" />
              新建题库
            </Link>
          </div>
        </div>
      </section>

      {activeSession && (
        <Link
          to={`/practice/${activeSession.id}`}
          className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong sm:p-5"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
              继续练习
            </p>
            <p className="mt-1 truncate text-sm font-medium">
              {activeSession.bankName}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              上次进度：第{' '}
              {Math.min(
                activeSession.cursor + 1,
                activeSession.questionIds.length,
              )}{' '}
              / {activeSession.questionIds.length} 题
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      <section
        aria-label="学习概览"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="题库"
          value={summary?.bankCount ?? '—'}
          icon={LibraryBig}
          tone="primary"
          hint="按科目或考试分类"
        />
        <StatCard
          label="题目总数"
          value={summary?.questionCount ?? '—'}
          icon={BookOpen}
          hint="导入后自动统计"
        />
        <StatCard
          label="今日已练"
          value={summary?.todayCount ?? '—'}
          icon={Target}
          tone="success"
          hint="每天进步一点点"
        />
        <StatCard
          label="今日正确率"
          value={accuracy}
          icon={Flame}
          tone="warning"
          hint={
            summary && summary.todayCount > 0
              ? `答对 ${summary.correctCount} 题`
              : '开始练习后显示'
          }
        />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">最近题库</h2>
            <p className="mt-0.5 text-xs text-muted">
              最多显示 3 个最近创建的题库
            </p>
          </div>
          <Link
            to="/banks"
            className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-primary"
          >
            全部题库
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {recentBanks === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[104px] animate-pulse rounded-2xl border border-border bg-surface"
              />
            ))}
          </div>
        ) : recentBanks.length === 0 ? (
          <EmptyState
            icon={LibraryBig}
            title="还没有题库"
            description="新建一个题库，或从 Excel、CSV、TXT、Word 批量导入题目，就可以开始刷题了。"
            action={
              <>
                <Link to="/banks" className={buttonStyles()}>
                  新建题库
                </Link>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentBanks.map((bank) => (
              <Link
                key={bank.id}
                to={`/banks/${bank.id}`}
                className="group rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <BookOpen className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-3 truncate text-sm font-medium">{bank.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {formatRelativeDate(bank.createdAt)}创建
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
