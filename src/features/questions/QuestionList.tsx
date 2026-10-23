import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'
import {
  deleteQuestion,
  listBankQuestions,
} from '@/db/questionRepository'
import { toggleQuestionFavorite } from '@/db/questionStateRepository'
import { QuestionEditorDialog } from '@/features/questions/QuestionEditorDialog'
import {
  isMasteredState,
  isWrongState,
} from '@/features/review/stateFilters'
import { cn } from '@/lib/cn'
import {
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/lib/labels'
import { formatAnswerSummary } from '@/lib/questionText'
import type {
  Difficulty,
  Question,
  QuestionType,
} from '@/types/quiz'

const PAGE_SIZE = 12

const selectClass =
  'h-9 w-full rounded-xl border border-border bg-bg px-2.5 text-[12px] text-fg outline-none focus:border-primary'

const typeTones = {
  single: 'primary',
  multiple: 'primary',
  judge: 'neutral',
  fill: 'neutral',
  short: 'neutral',
} as const

export function QuestionList({ bankId }: { bankId: string }) {
  const questions = useLiveQuery(
    () => listBankQuestions(bankId),
    [bankId],
  )
  const states = useLiveQuery(
    () => db.questionStates.where('bankId').equals(bankId).toArray(),
    [bankId],
  )
  const stateMap = useMemo(
    () =>
      new Map(
        (states ?? []).map((state) => [state.questionId, state] as const),
      ),
    [states],
  )

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | QuestionType>('all')
  const [chapterFilter, setChapterFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | Difficulty>(
    'all',
  )
  const [page, setPage] = useState(1)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Question | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [favoriteId, setFavoriteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const chapters = useMemo(
    () =>
      Array.from(
        new Set(
          (questions ?? [])
            .map((question) => question.chapter.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [questions],
  )

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (questions ?? []).filter((question) => {
      if (typeFilter !== 'all' && question.type !== typeFilter) return false
      if (chapterFilter !== 'all' && question.chapter !== chapterFilter) {
        return false
      }
      if (
        difficultyFilter !== 'all' &&
        question.difficulty !== difficultyFilter
      ) {
        return false
      }
      if (!keyword) return true
      const haystack = [
        question.stem,
        question.chapter,
        question.explanation,
        ...question.tags,
      ]
        .join('\n')
        .toLowerCase()
      return haystack.includes(keyword)
    })
  }, [questions, search, typeFilter, chapterFilter, difficultyFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const hasFilters =
    search.trim() !== '' ||
    typeFilter !== 'all' ||
    chapterFilter !== 'all' ||
    difficultyFilter !== 'all'

  const resetFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setChapterFilter('all')
    setDifficultyFilter('all')
    setPage(1)
  }

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (question: Question) => {
    setEditing(question)
    setEditorOpen(true)
  }

  const handleFavorite = async (question: Question) => {
    if (favoriteId) return
    setFavoriteId(question.id)
    setError('')
    try {
      await toggleQuestionFavorite(question)
    } catch (err) {
      setError(err instanceof Error ? err.message : '收藏失败，请重试')
    } finally {
      setFavoriteId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    setError('')
    try {
      await deleteQuestion(id)
      setDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">题目列表</h2>
          <p className="mt-1 text-xs text-muted">
            {questions === undefined
              ? '加载中…'
              : `共 ${questions.length} 道题${
                  hasFilters ? `，筛选出 ${filtered.length} 道` : ''
                }`}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          添加题目
        </Button>
      </div>

      {(questions?.length ?? 0) > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px_130px_96px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="搜索题干、章节或标签"
              aria-label="搜索题目"
              className="h-9 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-[13px] text-fg outline-none placeholder:text-muted/70 focus:border-primary"
            />
          </div>
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
          <select
            value={chapterFilter}
            onChange={(event) => {
              setChapterFilter(event.target.value)
              setPage(1)
            }}
            aria-label="按章节筛选"
            className={selectClass}
          >
            <option value="all">全部章节</option>
            {chapters.map((chapter) => (
              <option key={chapter} value={chapter}>
                {chapter}
              </option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(event) => {
              setDifficultyFilter(
                event.target.value === 'all'
                  ? 'all'
                  : (Number(event.target.value) as Difficulty),
              )
              setPage(1)
            }}
            aria-label="按难度筛选"
            className={selectClass}
          >
            <option value="all">全部难度</option>
            {([1, 2, 3] as Difficulty[]).map((value) => (
              <option key={value} value={value}>
                {DIFFICULTY_LABELS[value]}
              </option>
            ))}
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

      {error && (
        <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">
          {error}
        </p>
      )}

      <div className="mt-4">
        {questions === undefined ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[88px] animate-pulse rounded-xl bg-surface-2"
              />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="题库里还没有题目"
            description="可以导入 Excel、CSV、TXT 或 Word 文件，也可以手动添加单道题目。"
            className="border-0 bg-transparent py-8"
            action={
              <>
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  手动添加
                </Button>
                <Link
                  to="/import"
                  className={buttonStyles({ variant: 'secondary' })}
                >
                  <Upload className="size-4" />
                  导入题目
                </Link>
              </>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-[13px] text-muted">
            没有符合筛选条件的题目。
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {visible.map((question) => {
                const state = stateMap.get(question.id)
                const favorite = state?.favorite ?? false
                return (
                <li key={question.id} className="px-3.5 py-3.5 sm:px-4">
                  <div className="flex gap-2.5 sm:gap-3">
                    <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-[11px] text-muted/80">
                      {question.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={typeTones[question.type]}>
                          {QUESTION_TYPE_LABELS[question.type]}
                        </Badge>
                        <Badge
                          tone={
                            question.difficulty === 1
                              ? 'success'
                              : question.difficulty === 3
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {DIFFICULTY_LABELS[question.difficulty]}
                        </Badge>
                        {question.chapter && (
                          <span className="max-w-[140px] truncate text-[10px] text-muted">
                            {question.chapter}
                          </span>
                        )}
                        {question.tags.length > 0 && (
                          <span className="max-w-[140px] truncate text-[10px] text-muted">
                            · {question.tags.join(' / ')}
                          </span>
                        )}
                        {state && isWrongState(state) && (
                          <Badge tone="warning">错题</Badge>
                        )}
                        {state && isMasteredState(state) && (
                          <Badge tone="success">已掌握</Badge>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-[13px] leading-6">
                        {question.stem}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted">
                        答案：
                        <span className="font-medium text-fg">
                          {formatAnswerSummary(question)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleFavorite(question)}
                        disabled={favoriteId === question.id}
                        aria-label={favorite ? '取消收藏' : '收藏题目'}
                        aria-pressed={favorite}
                        title={favorite ? '取消收藏' : '收藏'}
                        className={cn(
                          'grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-50',
                          favorite
                            ? 'text-warning hover:bg-warning-soft'
                            : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )}
                      >
                        <Star
                          className={cn(
                            'size-4',
                            favorite && 'fill-current',
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(question)}
                        aria-label="编辑题目"
                        title="编辑"
                        className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteId(
                            deleteId === question.id ? null : question.id,
                          )
                        }
                        aria-label="删除题目"
                        title="删除"
                        className={cn(
                          'grid size-8 place-items-center rounded-lg transition-colors hover:bg-danger-soft hover:text-danger',
                          deleteId === question.id
                            ? 'bg-danger-soft text-danger'
                            : 'text-muted',
                        )}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {deleteId === question.id && (
                    <div className="mt-2.5 flex flex-col gap-2 rounded-xl bg-danger-soft px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[12px] leading-5 text-danger">
                        删除后，这道题的练习记录也会一并清除。确定删除？
                      </p>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDeleteId(null)}
                          disabled={deleting}
                        >
                          取消
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(question.id)}
                          disabled={deleting}
                        >
                          {deleting ? '删除中…' : '确认删除'}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
                )
              })}
            </ul>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted">
                  第 {currentPage} / {totalPages} 页
                </p>
                <div className="flex gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setPage(Math.max(1, currentPage - 1))
                    }
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
      </div>

      <QuestionEditorDialog
        open={editorOpen}
        bankId={bankId}
        question={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </Card>
  )
}
