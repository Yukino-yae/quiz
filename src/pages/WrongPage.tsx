import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Loader2,
  Play,
  Search,
  Star,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { ReviewQuestionCard } from '@/features/review/ReviewQuestionCard'
import {
  isFavoriteState,
  isMasteredState,
  isWrongState,
  type ReviewTab,
} from '@/features/review/stateFilters'
import { cn } from '@/lib/cn'
import { QUESTION_TYPE_LABELS } from '@/lib/labels'
import type { Question, QuestionState, QuestionType } from '@/types/quiz'

const PAGE_SIZE = 10

const TABS: {
  value: ReviewTab
  label: string
  icon: typeof CircleX
  description: string
}[] = [
  {
    value: 'wrong',
    label: '错题',
    icon: CircleX,
    description:
      '答错后自动收录，连续答对 3 次或手动标记掌握后自动移出。',
  },
  {
    value: 'favorite',
    label: '收藏',
    icon: Star,
    description: '收藏的题目会集中在这里，随时可以针对性重练。',
  },
  {
    value: 'mastered',
    label: '已掌握',
    icon: CheckCircle2,
    description: '连续答对 3 次或手动标记的题目，也可以取消掌握。',
  },
]

const selectClass =
  'h-9 w-full rounded-xl border border-border bg-bg px-2.5 text-[12px] text-fg outline-none focus:border-primary'

const STATE_FILTERS: Record<ReviewTab, (state: QuestionState) => boolean> = {
  wrong: isWrongState,
  favorite: isFavoriteState,
  mastered: isMasteredState,
}

const PRACTICE_MODE: Record<ReviewTab, PracticeRunMode> = {
  wrong: 'wrong',
  favorite: 'favorite',
  mastered: 'sequence',
}

const PRACTICE_LABEL: Record<ReviewTab, string> = {
  wrong: '重练这些错题',
  favorite: '练习这些收藏题',
  mastered: '复习这些已掌握题',
}

const ENTRY_LABEL: Record<ReviewTab, string> = {
  wrong: '错题',
  favorite: '收藏题',
  mastered: '已掌握题',
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '创建练习失败，请重试'
}

export default function WrongPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ReviewTab>('wrong')
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all')
  const [page, setPage] = useState(1)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const counts = useLiveQuery(async () => {
    const states = await db.questionStates.toArray()
    return {
      wrong: states.filter(isWrongState).length,
      favorite: states.filter(isFavoriteState).length,
      mastered: states.filter(isMasteredState).length,
    }
  }, [])

  const data = useLiveQuery(async () => {
    const [states, banks] = await Promise.all([
      db.questionStates.toArray(),
      db.banks.orderBy('createdAt').reverse().toArray(),
    ])
    const activeStates = states.filter(STATE_FILTERS[tab])
    const questions = await db.questions.bulkGet(
      activeStates.map((state) => state.questionId),
    )
    const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]))

    const entries = activeStates
      .map((state, index) => {
        const question = questions[index]
        if (!question) return null
        return {
          state,
          question,
          bankName: bankNames.get(question.bankId) ?? '已删除的题库',
        }
      })
      .filter(
        (
          entry,
        ): entry is {
          state: QuestionState
          question: Question
          bankName: string
        } => Boolean(entry),
      )
      .sort(
        (left, right) =>
          (right.state.lastAnsweredAt ?? 0) -
            (left.state.lastAnsweredAt ?? 0) ||
          left.question.order - right.question.order,
      )

    return { entries, banks }
  }, [tab])

  const activeTab = TABS.find((item) => item.value === tab) ?? TABS[0]
  const allEntries = data?.entries ?? []
  const keyword = search.trim().toLowerCase()
  const filtered = allEntries.filter((entry) => {
    if (bankFilter !== 'all' && entry.question.bankId !== bankFilter) {
      return false
    }
    if (typeFilter !== 'all' && entry.question.type !== typeFilter) {
      return false
    }
    if (!keyword) return true
    return [
      entry.question.stem,
      entry.question.chapter,
      entry.question.explanation,
      ...entry.question.tags,
    ]
      .join('\n')
      .toLowerCase()
      .includes(keyword)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const hasFilters =
    search.trim() !== '' || bankFilter !== 'all' || typeFilter !== 'all'
  const selectedBank = data?.banks.find((bank) => bank.id === bankFilter)
  const canPractice =
    bankFilter !== 'all' && filtered.length > 0 && !starting

  function switchTab(next: ReviewTab) {
    setTab(next)
    setPage(1)
    setError('')
  }

  function resetFilters() {
    setSearch('')
    setBankFilter('all')
    setTypeFilter('all')
    setPage(1)
  }

  async function handlePractice() {
    if (!canPractice || !selectedBank) return
    setStarting(true)
    setError('')
    try {
      const session = await createPracticeSession({
        bankId: selectedBank.id,
        mode: PRACTICE_MODE[tab],
        questionIds: filtered.map((entry) => entry.question.id),
      })
      navigate(`/practice/${session.id}`)
    } catch (startError) {
      setError(errorMessage(startError))
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="错题与收藏"
        description="按题库整理错题、收藏和已掌握题目，随时开始针对性练习。"
      />

      <div
        role="tablist"
        aria-label="错题、收藏与已掌握"
        className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1"
      >
        {TABS.map((item) => {
          const Icon = item.icon
          const active = tab === item.value
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`review-tab-${item.value}`}
              aria-selected={active}
              onClick={() => switchTab(item.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted hover:text-fg',
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
              <span className="tabular-nums opacity-70">
                {counts?.[item.value] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <p className="-mt-3 text-xs leading-5 text-muted">
        {activeTab.description}
      </p>

      <Card
        className="p-5 sm:p-6"
        role="tabpanel"
        id={`review-panel-${tab}`}
        aria-labelledby={`review-tab-${tab}`}
      >
        {(data?.banks.length ?? 0) > 0 && allEntries.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="搜索题干、章节或标签"
                aria-label="搜索错题与收藏"
                className="h-9 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-[13px] text-fg outline-none placeholder:text-muted/70 focus:border-primary"
              />
            </div>
            <select
              value={bankFilter}
              onChange={(event) => {
                setBankFilter(event.target.value)
                setPage(1)
                setError('')
              }}
              aria-label="按题库筛选"
              className={selectClass}
            >
              <option value="all">全部题库</option>
              {(data?.banks ?? []).map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as 'all' | QuestionType)
                setPage(1)
              }}
              aria-label="按题型筛选"
              className={selectClass}
            >
              <option value="all">全部题型</option>
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(
                (type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ),
              )}
            </select>
          </div>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 text-[11px] font-medium text-primary hover:underline"
          >
            清除筛选
          </button>
        )}

        {data === undefined ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[104px] animate-pulse rounded-xl bg-surface-2"
              />
            ))}
          </div>
        ) : allEntries.length === 0 ? (
          <EmptyState
            icon={activeTab.icon}
            title={
              tab === 'wrong'
                ? '错题本是空的'
                : tab === 'favorite'
                  ? '还没有收藏的题目'
                  : '还没有已掌握的题目'
            }
            description={
              tab === 'wrong'
                ? '练习时答错的题会自动出现在这里，掌握之后会自动移出。'
                : tab === 'favorite'
                  ? '在题目列表或练习页点击星标，就能把题目收藏到这里。'
                  : '连续答对 3 次会自动标记掌握，也可以在错题本中手动标记。'
            }
            className="border-0 bg-transparent py-8"
            action={
              <Link to="/banks" className={buttonStyles()}>
                去题库练习
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="mt-4 rounded-xl bg-surface-2 px-4 py-10 text-center">
            <p className="text-[13px] text-muted">没有符合筛选条件的题目。</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              清除筛选条件
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-primary/25 bg-primary-soft px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-primary">
                  {filtered.length} 道{ENTRY_LABEL[tab]}
                  {selectedBank ? ` · ${selectedBank.name}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] leading-5 text-primary/80">
                  {bankFilter === 'all'
                    ? '选择单个题库后，可以只练习当前筛选出的题目。'
                    : '练习范围与当前筛选结果一致。'}
                </p>
              </div>
              {bankFilter === 'all' ? (
                <Badge tone="primary" className="shrink-0">
                  先选择题库
                </Badge>
              ) : (
                <Button
                  size="sm"
                  disabled={!canPractice}
                  onClick={handlePractice}
                  className="shrink-0"
                >
                  {starting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {starting ? '正在创建…' : PRACTICE_LABEL[tab]}
                </Button>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
              >
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {visible.map((entry) => (
                <ReviewQuestionCard
                  key={entry.question.id}
                  question={entry.question}
                  state={entry.state}
                  bankName={entry.bankName}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted">
                  第 {currentPage} / {totalPages} 页
                </p>
                <div className="flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    aria-label="上一页"
                  >
                    <ChevronLeft className="size-4" />
                    上一页
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage >= totalPages}
                    aria-label="下一页"
                  >
                    下一页
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
