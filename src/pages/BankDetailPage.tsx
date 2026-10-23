import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  CircleX,
  ListOrdered,
  Play,
  RotateCcw,
  Shuffle,
  Star,
  Target,
  Upload,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'
import { QuestionList } from '@/features/questions/QuestionList'
import {
  isFavoriteState,
  isMasteredState,
  isWrongState,
} from '@/features/review/stateFilters'

const practiceModes = [
  {
    icon: ListOrdered,
    mode: 'sequence',
    title: '顺序练习',
    description: '按题库顺序逐题作答',
  },
  {
    icon: Shuffle,
    mode: 'random',
    title: '随机练习',
    description: '打乱顺序，自测掌握程度',
  },
  {
    icon: RotateCcw,
    mode: 'wrong',
    title: '错题重练',
    description: '集中巩固答错过的题',
  },
  {
    icon: Star,
    mode: 'favorite',
    title: '收藏练习',
    description: '练习标记过星标的题',
  },
]

export default function BankDetailPage() {
  const { bankId = '' } = useParams()

  const data = useLiveQuery(async () => {
    if (!bankId) {
      return {
        bank: null,
        questionCount: 0,
        wrongCount: 0,
        masteredCount: 0,
        favoriteCount: 0,
        activeSession: undefined,
      }
    }

    const bank = await db.banks.get(bankId)
    if (!bank) {
      return {
        bank: null,
        questionCount: 0,
        wrongCount: 0,
        masteredCount: 0,
        favoriteCount: 0,
        activeSession: undefined,
      }
    }

    const [questionCount, states, sessions] = await Promise.all([
      db.questions.where('bankId').equals(bankId).count(),
      db.questionStates.where('bankId').equals(bankId).toArray(),
      db.sessions.where('bankId').equals(bankId).toArray(),
    ])
    const activeSession = sessions
      .filter((session) => !session.finishedAt)
      .sort((left, right) => right.startedAt - left.startedAt)[0]

    return {
      bank,
      questionCount,
      wrongCount: states.filter(isWrongState).length,
      masteredCount: states.filter(isMasteredState).length,
      favoriteCount: states.filter(isFavoriteState).length,
      activeSession,
    }
  }, [bankId])

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[104px] animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!data.bank) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          className="w-full max-w-lg"
          icon={BookOpen}
          title="题库不存在"
          description="它可能已经被删除，或者链接不正确。"
          action={
            <Link to="/banks" className={buttonStyles()}>
              返回题库列表
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/banks"
        backLabel="所有题库"
        title={data.bank.name}
        description={data.bank.description || '这个题库还没有简介。'}
        actions={
          <>
            <Link
              to="/import"
              className={buttonStyles({ variant: 'secondary' })}
            >
              <Upload className="size-4" />
              导入题目
            </Link>
            {data.activeSession ? (
              <Link
                to={`/practice/${data.activeSession.id}`}
                className={buttonStyles()}
              >
                <Play className="size-4" />
                继续练习
              </Link>
            ) : (
              <Link
                to={`/banks/${bankId}/practice`}
                className={buttonStyles()}
              >
                <Play className="size-4" />
                开始练习
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="题目总数"
          value={data.questionCount}
          icon={BookOpen}
          tone="primary"
          hint="导入后自动统计"
        />
        <StatCard
          label="待复习错题"
          value={data.wrongCount}
          icon={CircleX}
          tone="warning"
          hint="掌握后自动移出"
        />
        <StatCard
          label="已掌握"
          value={data.masteredCount}
          icon={Target}
          tone="success"
          hint="连续答对 3 次或手动标记"
        />
        <StatCard
          label="收藏"
          value={data.favoriteCount}
          icon={Star}
          hint="用于集中重练"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">开始练习</h2>
            <p className="mt-1 text-[13px] text-muted">
              逐题作答、即时判分，支持按题型、难度和章节筛选。
            </p>
          </div>
          <Badge tone="success">即时判分</Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {practiceModes.map((mode) => (
            <Link
              key={mode.title}
              to={`/banks/${bankId}/practice?mode=${mode.mode}`}
              className="group rounded-xl border border-border bg-bg/60 p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
            >
              <mode.icon
                className="size-5 text-muted transition-colors group-hover:text-primary"
                strokeWidth={1.8}
              />
              <p className="mt-2.5 text-sm font-medium">{mode.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {mode.description}
              </p>
            </Link>
          ))}
        </div>

        {data.activeSession && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-primary">
              有一场未完成的练习，当前进行到第{' '}
              {Math.min(
                data.activeSession.cursor + 1,
                data.activeSession.questionIds.length,
              )}{' '}
              / {data.activeSession.questionIds.length} 题。
            </p>
            <Link
              to={`/practice/${data.activeSession.id}`}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              继续这场练习
              <Play className="size-3" />
            </Link>
          </div>
        )}
      </Card>

      <QuestionList bankId={bankId} />
    </div>
  )
}
