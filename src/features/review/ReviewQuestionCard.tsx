import {
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Star,
  Target,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  markQuestionMastered,
  removeQuestionFromWrong,
  resetQuestionToLearning,
  toggleQuestionFavorite,
} from '@/db/questionStateRepository'
import {
  isMasteredState,
  isWrongState,
} from '@/features/review/stateFilters'
import { cn } from '@/lib/cn'
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/labels'
import { formatAnswerSummary } from '@/lib/questionText'
import type { Question, QuestionState } from '@/types/quiz'

interface ReviewQuestionCardProps {
  question: Question
  state: QuestionState
  bankName: string
}

type PendingAction = 'favorite' | 'wrong' | 'mastered' | 'reset' | ''

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请重试'
}

export function ReviewQuestionCard({
  question,
  state,
  bankName,
}: ReviewQuestionCardProps) {
  const [pending, setPending] = useState<PendingAction>('')
  const [error, setError] = useState('')

  const mastered = isMasteredState(state)
  const wrong = isWrongState(state)
  const hasChoices =
    question.type === 'single' || question.type === 'multiple'

  async function run(action: PendingAction, task: () => Promise<unknown>) {
    if (pending) return
    setPending(action)
    setError('')
    try {
      await task()
    } catch (actionError) {
      setError(messageOf(actionError))
    } finally {
      setPending('')
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone="primary">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          <Badge>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
          {state.wrongCount > 0 && (
            <Badge tone={wrong ? 'warning' : 'neutral'}>
              错 {state.wrongCount} 次
            </Badge>
          )}
          {mastered && (
            <Badge tone="success">
              <CheckCircle2 className="size-3" />
              已掌握
            </Badge>
          )}
          <span className="max-w-[180px] truncate text-[11px] text-muted">
            {bankName}
            {question.chapter ? ` · ${question.chapter}` : ''}
          </span>
        </div>

        <button
          type="button"
          aria-pressed={state.favorite}
          aria-label={state.favorite ? '取消收藏' : '收藏题目'}
          title={state.favorite ? '取消收藏' : '收藏'}
          disabled={pending !== ''}
          onClick={() =>
            run('favorite', () => toggleQuestionFavorite(question))
          }
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
            state.favorite
              ? 'text-warning hover:bg-warning-soft'
              : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Star
            className={cn('size-4', state.favorite && 'fill-current')}
          />
        </button>
      </div>

      <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-6">
        {question.stem}
      </p>

      <details className="group mt-3 rounded-xl border border-border bg-bg/50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
          查看答案与解析
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-2.5 border-t border-border px-3 py-3">
          {hasChoices && question.options.length > 0 && (
            <ul className="space-y-1.5">
              {question.options.map((option) => {
                const correct = question.answer.includes(option.key)
                return (
                  <li
                    key={option.key}
                    className={cn(
                      'flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs leading-5',
                      correct
                        ? 'bg-success-soft text-success'
                        : 'text-muted',
                    )}
                  >
                    <span className="font-semibold">{option.key}.</span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">
                      {option.text}
                    </span>
                    {correct && (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <div className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
            <span className="font-medium">正确答案：</span>
            <span className="whitespace-pre-wrap">
              {formatAnswerSummary(question) || '未填写'}
            </span>
          </div>

          {question.explanation && (
            <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-6 text-muted">
              <span className="font-medium text-fg">解析：</span>
              <span className="whitespace-pre-wrap">
                {question.explanation}
              </span>
            </div>
          )}

          {question.type === 'short' && question.keywords.length > 0 && (
            <p className="text-[11px] text-muted">
              关键词：{question.keywords.join(' / ')}
            </p>
          )}
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending !== ''}
          onClick={() =>
            run('favorite', () => toggleQuestionFavorite(question))
          }
        >
          <Star
            className={cn('size-3.5', state.favorite && 'fill-warning text-warning')}
          />
          {state.favorite ? '已收藏' : '收藏'}
        </Button>

        {wrong && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending !== ''}
            onClick={() =>
              run('wrong', () => removeQuestionFromWrong(question))
            }
          >
            <XCircle className="size-3.5" />
            移出错题
          </Button>
        )}

        {mastered ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending !== ''}
            onClick={() =>
              run('reset', () => resetQuestionToLearning(question))
            }
          >
            <RotateCcw className="size-3.5" />
            取消掌握
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending !== ''}
            onClick={() =>
              run('mastered', () => markQuestionMastered(question))
            }
          >
            <Target className="size-3.5" />
            标记已掌握
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11px] text-danger">
          {error}
        </p>
      )}
    </Card>
  )
}
