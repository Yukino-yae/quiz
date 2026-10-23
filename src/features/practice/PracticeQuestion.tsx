import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Star,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import {
  getBlankCount,
  gradeAnswer,
  isAnswerComplete,
  type GradeResult,
} from '@/features/practice/grading'
import { cn } from '@/lib/cn'
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/labels'
import type { AnswerRecord, Question } from '@/types/quiz'

interface Feedback extends GradeResult {
  selfGraded?: boolean
}

interface PracticeQuestionProps {
  question: Question
  existingAnswer?: AnswerRecord
  favorite: boolean
  isLast: boolean
  onAnswer: (
    selected: string[],
    correct: boolean,
    timeSpentMs: number,
  ) => Promise<void>
  onNext: () => Promise<void>
  onToggleFavorite: () => Promise<void>
}

const JUDGE_OPTIONS = [
  { key: 'true', label: '对', icon: Check },
  { key: 'false', label: '错', icon: X },
]

function buildFeedback(
  question: Question,
  selected: string[],
  existingAnswer?: AnswerRecord,
): Feedback | null {
  if (!existingAnswer) return null
  const base = gradeAnswer(question, selected)
  const hasKeywords = question.keywords.some((keyword) => keyword.trim())
  return {
    ...base,
    correct: existingAnswer.correct,
    needsSelfAssessment: false,
    selfGraded: question.type === 'short' && !hasKeywords,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : '保存失败，请重试'
}

export function PracticeQuestion({
  question,
  existingAnswer,
  favorite,
  isLast,
  onAnswer,
  onNext,
  onToggleFavorite,
}: PracticeQuestionProps) {
  const [selected, setSelected] = useState<string[]>(
    () => existingAnswer?.selected ?? [],
  )
  const [feedback, setFeedback] = useState<Feedback | null>(() =>
    buildFeedback(question, existingAnswer?.selected ?? [], existingAnswer),
  )
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [error, setError] = useState('')
  const startedAt = useRef(0)

  useEffect(() => {
    startedAt.current = Date.now()
  }, [])

  const blankCount = getBlankCount(question)
  const hasKeywords = question.keywords.some((keyword) => keyword.trim())
  const locked = Boolean(feedback) || revealed || saving
  const canSubmit = !locked && isAnswerComplete(question, selected)
  const selectedSet = new Set(selected)

  function elapsedMs() {
    return startedAt.current ? Date.now() - startedAt.current : 0
  }

  function toggleChoice(key: string) {
    if (locked) return
    if (question.type === 'multiple') {
      setSelected((previous) =>
        previous.includes(key)
          ? previous.filter((item) => item !== key)
          : [...previous, key].sort(),
      )
      return
    }
    setSelected([key])
  }

  function updateBlank(index: number, value: string) {
    if (locked) return
    setSelected((previous) => {
      const next = Array.from(
        { length: blankCount },
        (_, itemIndex) => previous[itemIndex] ?? '',
      )
      next[index] = value
      return next
    })
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setError('')

    if (question.type === 'short' && !hasKeywords) {
      setRevealed(true)
      return
    }

    const result = gradeAnswer(question, selected)
    setSaving(true)
    try {
      await onAnswer(selected, result.correct, elapsedMs())
      setFeedback(result)
    } catch (submitError) {
      setError(messageOf(submitError))
    } finally {
      setSaving(false)
    }
  }

  async function handleSelfGrade(correct: boolean) {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onAnswer(selected, correct, elapsedMs())
      const base = gradeAnswer(question, selected)
      setFeedback({
        ...base,
        correct,
        needsSelfAssessment: false,
        selfGraded: true,
      })
      setRevealed(false)
    } catch (submitError) {
      setError(messageOf(submitError))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleFavorite() {
    if (favoriteBusy) return
    setFavoriteBusy(true)
    setError('')
    try {
      await onToggleFavorite()
    } catch (favoriteError) {
      setError(messageOf(favoriteError))
    } finally {
      setFavoriteBusy(false)
    }
  }

  async function handleNext() {
    if (advancing) return
    setAdvancing(true)
    setError('')
    try {
      await onNext()
    } catch (nextError) {
      setError(messageOf(nextError))
      setAdvancing(false)
    }
  }

  function optionClass(key: string, selectedOption: boolean) {
    const isCorrectOption = question.answer.includes(key)
    if (feedback) {
      if (isCorrectOption) return 'border-success bg-success-soft'
      if (selectedOption) return 'border-danger bg-danger-soft'
      return 'border-border bg-bg opacity-70'
    }
    if (selectedOption) return 'border-primary bg-primary-soft'
    return 'border-border bg-bg hover:border-border-strong'
  }

  function optionMarkerClass(key: string, selectedOption: boolean) {
    const isCorrectOption = question.answer.includes(key)
    if (feedback && isCorrectOption) return 'bg-success text-bg'
    if (feedback && selectedOption) return 'bg-danger text-bg'
    if (selectedOption) return 'bg-primary text-primary-fg'
    return 'bg-surface-2 text-muted'
  }

  function renderChoiceOptions() {
    return (
      <div
        className="space-y-2.5"
        role={question.type === 'single' ? 'radiogroup' : 'group'}
        aria-label="选项"
      >
        {question.options.map((option) => {
          const selectedOption = selectedSet.has(option.key)
          const isCorrectOption = question.answer.includes(option.key)
          return (
            <button
              key={option.key}
              type="button"
              role={question.type === 'single' ? 'radio' : 'checkbox'}
              aria-checked={selectedOption}
              disabled={locked}
              onClick={() => toggleChoice(option.key)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm leading-6 transition-colors disabled:cursor-default sm:p-4',
                optionClass(option.key, selectedOption),
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg text-xs font-semibold transition-colors',
                  optionMarkerClass(option.key, selectedOption),
                )}
              >
                {option.key}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap">
                {option.text}
              </span>
              {feedback && isCorrectOption && (
                <Check className="mt-1 size-4 shrink-0 text-success" />
              )}
              {feedback && selectedOption && !isCorrectOption && (
                <X className="mt-1 size-4 shrink-0 text-danger" />
              )}
            </button>
          )
        })}
        {question.options.length === 0 && (
          <p className="text-sm text-danger">这道题还没有设置选项。</p>
        )}
      </div>
    )
  }

  function renderJudgeOptions() {
    return (
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="选项">
        {JUDGE_OPTIONS.map((option) => {
          const selectedOption = selectedSet.has(option.key)
          const Icon = option.icon
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selectedOption}
              disabled={locked}
              onClick={() => toggleChoice(option.key)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-sm font-medium transition-colors disabled:cursor-default',
                optionClass(option.key, selectedOption),
              )}
            >
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full transition-colors',
                  selectedOption
                    ? 'bg-primary-soft text-primary'
                    : 'bg-surface-2 text-muted',
                )}
              >
                <Icon className="size-5" strokeWidth={2} />
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  function renderFillInputs() {
    return (
      <div className="space-y-4">
        {Array.from({ length: blankCount }, (_, index) => {
          const blank = feedback?.blanks?.[index]
          const value = selected[index] ?? ''
          return (
            <label key={index} className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                第 {index + 1} 空
              </span>
              <span className="relative block">
                <input
                  type="text"
                  value={value}
                  disabled={locked}
                  onChange={(event) =>
                    updateBlank(index, event.target.value)
                  }
                  placeholder="输入答案"
                  className={cn(
                    'h-11 w-full rounded-xl border bg-bg px-3 pr-10 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary disabled:cursor-default',
                    blank
                      ? blank.correct
                        ? 'border-success'
                        : 'border-danger'
                      : 'border-border',
                  )}
                />
                {blank && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {blank.correct ? (
                      <Check className="size-4 text-success" />
                    ) : (
                      <X className="size-4 text-danger" />
                    )}
                  </span>
                )}
              </span>
              {blank && !blank.correct && blank.accepted.length > 0 && (
                <span className="mt-1.5 block text-xs text-muted">
                  参考答案：{blank.accepted.join(' / ')}
                </span>
              )}
            </label>
          )
        })}
        <p className="text-xs text-muted">
          答案不区分大小写和全半角，忽略空格与常见标点。
        </p>
      </div>
    )
  }

  function renderShortInput() {
    return (
      <label className="block">
        <span className="mb-2 block text-sm font-medium">你的回答</span>
        <textarea
          rows={5}
          value={selected[0] ?? ''}
          disabled={locked}
          onChange={(event) => setSelected([event.target.value])}
          placeholder="写下你的答案，提交后对照参考答案"
          className="w-full resize-y rounded-xl border border-border bg-bg px-3.5 py-3 text-sm leading-7 text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary disabled:cursor-default"
        />
        <p className="mt-1.5 text-xs text-muted">
          {hasKeywords
            ? `本题会按 ${question.keywords.length} 个关键词自动判分。`
            : '本题没有设置关键词，提交后对照参考答案自评。'}
        </p>
      </label>
    )
  }

  const feedbackTone = feedback?.correct
    ? 'border-success/30 bg-success-soft'
    : 'border-danger/30 bg-danger-soft'
  const FeedbackIcon = feedback?.correct ? CheckCircle2 : XCircle

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">
              {QUESTION_TYPE_LABELS[question.type]}题
            </Badge>
            <Badge>{DIFFICULTY_LABELS[question.difficulty]}难度</Badge>
            {question.chapter && (
              <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-muted">
                {question.chapter}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {question.type === 'multiple' && (
                <span className="text-[11px] text-muted">多选</span>
              )}
              <button
                type="button"
                aria-pressed={favorite}
                aria-label={favorite ? '取消收藏' : '收藏题目'}
                title={favorite ? '取消收藏' : '收藏'}
                disabled={favoriteBusy}
                onClick={handleToggleFavorite}
                className={cn(
                  'grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-50',
                  favorite
                    ? 'text-warning hover:bg-warning-soft'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Star
                  className={cn('size-4', favorite && 'fill-current')}
                />
              </button>
            </div>
          </div>
          <h1 className="mt-4 whitespace-pre-wrap text-[17px] font-medium leading-8 text-fg sm:text-lg sm:leading-9">
            {question.stem}
          </h1>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          {question.type === 'single' || question.type === 'multiple'
            ? renderChoiceOptions()
            : null}
          {question.type === 'judge' ? renderJudgeOptions() : null}
          {question.type === 'fill' ? renderFillInputs() : null}
          {question.type === 'short' ? renderShortInput() : null}
        </div>
      </Card>

      {revealed && !feedback && (
        <Card className="mt-4 border-primary/30 p-5 sm:p-6">
          <p className="text-xs font-medium text-primary">参考答案</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
            {question.referenceAnswer || '这道题还没有填写参考答案。'}
          </p>
          <p className="mt-5 text-sm font-medium">
            对照参考答案，你的作答算答对吗？
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSelfGrade(true)}
              className={buttonStyles({
                variant: 'secondary',
                className:
                  'border-success/40 text-success hover:bg-success-soft',
              })}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              算答对
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSelfGrade(false)}
              className={buttonStyles({ variant: 'danger' })}
            >
              <X className="size-4" />
              需要复习
            </button>
          </div>
        </Card>
      )}

      {feedback && (
        <section
          className={cn('mt-4 rounded-2xl border p-5 sm:p-6', feedbackTone)}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <FeedbackIcon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                feedback.correct ? 'text-success' : 'text-danger',
              )}
            />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {feedback.selfGraded
                  ? feedback.correct
                    ? '已记录为答对'
                    : '已记录为需要复习'
                  : feedback.correct
                    ? '回答正确'
                    : '回答错误'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {feedback.selfGraded
                  ? '这道简答题按自评结果记录，参考答案仅供对照。'
                  : feedback.correct
                    ? '继续保持，点击下方按钮进入下一题。'
                    : '对照正确答案和解析，下次别再错。'}
              </p>
            </div>
          </div>

          {feedback.blanks && (
            <div className="mt-4 flex flex-wrap gap-2">
              {feedback.blanks.map((blank) => (
                <span
                  key={blank.index}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    blank.correct
                      ? 'bg-success/10 text-success'
                      : 'bg-danger/10 text-danger',
                  )}
                >
                  {blank.correct ? (
                    <Check className="size-3" />
                  ) : (
                    <X className="size-3" />
                  )}
                  第 {blank.index + 1} 空
                </span>
              ))}
            </div>
          )}

          {feedback.keywords && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted">关键词命中</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {feedback.keywords.matched.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success"
                  >
                    <Check className="size-3" />
                    {keyword}
                  </span>
                ))}
                {feedback.keywords.missing.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger"
                  >
                    <X className="size-3" />
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-border bg-surface/75 p-4">
            <p className="text-[11px] font-medium text-muted">正确答案</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7">
              {feedback.correctAnswer}
            </p>
          </div>

          {question.explanation && (
            <div className="mt-3 rounded-xl border border-border bg-surface/75 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                <Lightbulb className="size-3.5" />
                解析
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7">
                {question.explanation}
              </p>
            </div>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {!revealed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-safe backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="hidden text-xs leading-5 text-muted sm:block">
              {feedback
                ? isLast
                  ? '这是最后一题，查看本次练习结果。'
                  : '进度已自动保存，退出后可以继续。'
                : question.type === 'multiple'
                  ? '多选题：选全后提交。'
                  : question.type === 'fill'
                    ? '填完所有空后提交。'
                    : '作答后立即查看判分和解析。'}
            </p>
            {feedback ? (
              <Button
                size="lg"
                disabled={advancing}
                onClick={handleNext}
                className="w-full sm:w-auto"
              >
                {advancing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                {isLast ? '查看结果' : '下一题'}
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                提交答案
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
