import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertCircle,
  BookOpen,
  ListOrdered,
  Loader2,
  Play,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'
import {
  createPracticeSession,
  type PracticeRunMode,
} from '@/db/sessionRepository'
import { questionMatchesConfig } from '@/features/practice/filters'
import {
  isFavoriteState,
  isWrongState,
} from '@/features/review/stateFilters'
import { cn } from '@/lib/cn'
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/labels'
import type {
  Difficulty,
  Question,
  QuestionType,
  SessionConfig,
} from '@/types/quiz'

const ALL_TYPES: QuestionType[] = [
  'single',
  'multiple',
  'judge',
  'fill',
  'short',
]
const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3]
const COUNT_OPTIONS = [5, 10, 20, 50, 100]
const RUN_MODES: {
  value: PracticeRunMode
  title: string
  description: string
  icon: typeof ListOrdered
}[] = [
  {
    value: 'sequence',
    title: '顺序练习',
    description: '按题库顺序逐题作答',
    icon: ListOrdered,
  },
  {
    value: 'random',
    title: '随机练习',
    description: '打乱顺序，自测掌握程度',
    icon: Shuffle,
  },
  {
    value: 'wrong',
    title: '错题重练',
    description: '集中巩固答错过的题',
    icon: RotateCcw,
  },
  {
    value: 'favorite',
    title: '收藏练习',
    description: '练习标记过星标的题',
    icon: Star,
  },
]

function isRunMode(value: string | null): value is PracticeRunMode {
  return (
    value === 'sequence' ||
    value === 'random' ||
    value === 'wrong' ||
    value === 'favorite'
  )
}

function toggleItem<T>(items: T[], item: T): T[] {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '创建练习失败，请重试'
}

export default function PracticeSetupPage() {
  const { bankId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<PracticeRunMode>(() => {
    const value = searchParams.get('mode')
    return isRunMode(value) ? value : 'sequence'
  })
  const [types, setTypes] = useState<QuestionType[]>(ALL_TYPES)
  const [difficulties, setDifficulties] =
    useState<Difficulty[]>(ALL_DIFFICULTIES)
  const [chapter, setChapter] = useState('all')
  const [count, setCount] = useState<'all' | number>('all')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const data = useLiveQuery(async () => {
    if (!bankId) return null
    const bank = await db.banks.get(bankId)
    if (!bank) {
      return {
        bank: null,
        questions: [],
        wrongIds: new Set<string>(),
        favoriteIds: new Set<string>(),
      }
    }

    const [questions, states] = await Promise.all([
      db.questions.where('bankId').equals(bankId).toArray(),
      db.questionStates.where('bankId').equals(bankId).toArray(),
    ])

    return {
      bank,
      questions: questions.sort((left, right) => left.order - right.order),
      wrongIds: new Set(
        states.filter(isWrongState).map((state) => state.questionId),
      ),
      favoriteIds: new Set(
        states.filter(isFavoriteState).map((state) => state.questionId),
      ),
    }
  }, [bankId])

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-2" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    )
  }

  if (!data?.bank) {
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

  const { bank, questions, wrongIds, favoriteIds } = data
  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          backTo={`/banks/${bank.id}`}
          backLabel="返回题库"
          title="开始练习"
          description={bank.name}
        />
        <EmptyState
          icon={BookOpen}
          title="题库还是空的"
          description="先导入或手动添加题目，再来开始练习。"
          action={
            <>
              <Link to="/import" className={buttonStyles()}>
                导入题目
              </Link>
              <Link
                to={`/banks/${bank.id}`}
                className={buttonStyles({ variant: 'secondary' })}
              >
                返回题库
              </Link>
            </>
          }
        />
      </div>
    )
  }

  const chapters = [...new Set(
    questions.map((question) => question.chapter).filter(Boolean),
  )].sort((left, right) => left.localeCompare(right, 'zh-CN'))
  const wrongCount = questions.filter((question) =>
    wrongIds.has(question.id),
  ).length
  const favoriteCount = questions.filter((question) =>
    favoriteIds.has(question.id),
  ).length

  const config: SessionConfig = {
    types: types.length === ALL_TYPES.length ? undefined : types,
    difficulties:
      difficulties.length === ALL_DIFFICULTIES.length
        ? undefined
        : difficulties,
    chapters: chapter === 'all' ? undefined : [chapter],
  }

  const scopedQuestions: Question[] =
    mode === 'wrong'
      ? questions.filter((question) => wrongIds.has(question.id))
      : mode === 'favorite'
        ? questions.filter((question) => favoriteIds.has(question.id))
        : questions
  const eligibleCount = scopedQuestions.filter((question) =>
    questionMatchesConfig(question, config),
  ).length
  const actualCount =
    count === 'all'
      ? eligibleCount
      : Math.min(count, eligibleCount)

  async function handleStart() {
    if (starting || actualCount === 0) return
    setStarting(true)
    setError('')
    try {
      const session = await createPracticeSession({
        bankId: bank.id,
        mode,
        config: {
          ...config,
          count: count === 'all' ? undefined : count,
        },
      })
      navigate(`/practice/${session.id}`)
    } catch (startError) {
      setError(errorMessage(startError))
      setStarting(false)
    }
  }

  const typeSummary =
    types.length === ALL_TYPES.length
      ? '全部题型'
      : types.length === 0
        ? '未选择题型'
        : `已选 ${types.length} 种题型`
  const difficultySummary =
    difficulties.length === ALL_DIFFICULTIES.length
      ? '全部难度'
      : difficulties.length === 0
        ? '未选择难度'
        : difficulties
            .slice()
            .sort()
            .map((value) => DIFFICULTY_LABELS[value])
            .join(' / ')

  return (
    <div className="space-y-5">
      <PageHeader
        backTo={`/banks/${bank.id}`}
        backLabel="返回题库"
        title="开始练习"
        description={`${bank.name} · 共 ${questions.length} 道题`}
      />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">练习方式</h2>
            <p className="mt-1 text-[13px] text-muted">
              答题后立即判分，进度会自动保存。
            </p>
          </div>
          <Badge tone="primary">即时判分</Badge>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {RUN_MODES.map((option) => {
            const Icon = option.icon
            const active = mode === option.value
            const modeCount =
              option.value === 'wrong'
                ? wrongCount
                : option.value === 'favorite'
                  ? favoriteCount
                  : null
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option.value)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-bg/60 hover:border-border-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-lg',
                      active
                        ? 'bg-primary text-primary-fg'
                        : 'bg-surface-2 text-muted',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  {modeCount !== null && modeCount > 0 && (
                    <span className="text-[11px] font-medium text-warning">
                      {modeCount} 道
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-sm font-medium">{option.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">
                  {option.description}
                </p>
              </button>
            )
          })}
        </div>

        {mode === 'wrong' && wrongCount === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs leading-5 text-warning">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            还没有错题记录。先做顺序或随机练习，答错的题会自动进入错题重练。
          </p>
        )}

        {mode === 'favorite' && favoriteCount === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs leading-5 text-warning">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            还没有收藏题目。在题目列表或练习页点击星标，就能收藏题目。
          </p>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted" />
            <h2 className="text-[15px] font-semibold">筛选题目</h2>
          </div>
          <Badge tone={eligibleCount > 0 ? 'success' : 'warning'}>
            可用 {eligibleCount} 道
          </Badge>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium">题型</p>
              <span className="text-[11px] text-muted">{typeSummary}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((value) => {
                const active = types.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTypes((previous) => toggleItem(previous, value))}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border bg-bg text-muted hover:border-border-strong',
                    )}
                  >
                    {QUESTION_TYPE_LABELS[value]}题
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium">难度</p>
              <span className="text-[11px] text-muted">
                {difficultySummary}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_DIFFICULTIES.map((value) => {
                const active = difficulties.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDifficulties((previous) =>
                        toggleItem(previous, value),
                      )
                    }
                    className={cn(
                      'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border bg-bg text-muted hover:border-border-strong',
                    )}
                  >
                    {DIFFICULTY_LABELS[value]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                章节
              </span>
              <select
                value={chapter}
                onChange={(event) => setChapter(event.target.value)}
                disabled={chapters.length === 0}
                className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none transition-colors focus:border-primary disabled:opacity-60"
              >
                <option value="all">全部章节</option>
                {chapters.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {chapters.length === 0 && (
                <span className="mt-1 block text-[11px] text-muted">
                  题目还没有设置章节
                </span>
              )}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                题量
              </span>
              <select
                value={String(count)}
                onChange={(event) => {
                  const value = event.target.value
                  setCount(value === 'all' ? 'all' : Number(value))
                }}
                className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none transition-colors focus:border-primary"
              >
                <option value="all">全部可用题目</option>
                {COUNT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} 题
                  </option>
                ))}
              </select>
              {count !== 'all' && count > eligibleCount && (
                <span className="mt-1 block text-[11px] text-muted">
                  可用题目不足 {count} 道，将按 {eligibleCount} 道开始。
                </span>
              )}
            </label>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            {eligibleCount > 0
              ? `本次将练习 ${actualCount} 道题`
              : '当前筛选条件下没有题目，请调整筛选。'}
          </p>
          <Button
            size="lg"
            disabled={starting || actualCount === 0}
            onClick={handleStart}
            className="w-full sm:w-auto"
          >
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {starting ? '正在创建…' : `开始练习（${actualCount} 题）`}
          </Button>
        </div>
      </Card>
    </div>
  )
}
