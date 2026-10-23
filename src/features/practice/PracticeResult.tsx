import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Home,
  LibraryBig,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { formatSelectedAnswer } from '@/features/practice/grading'
import { formatAnswerSummary } from '@/lib/questionText'
import {
  DIFFICULTY_LABELS,
  PRACTICE_MODE_LABELS,
  QUESTION_TYPE_LABELS,
} from '@/lib/labels'
import { formatDuration } from '@/lib/format'
import type { AnswerRecord, Question, Session } from '@/types/quiz'

interface PracticeResultProps {
  session: Session
  bankName: string
  questions: Question[]
  answers: AnswerRecord[]
}

export function PracticeResult({
  session,
  bankName,
  questions,
  answers,
}: PracticeResultProps) {
  const questionMap = new Map(
    questions.map((question) => [question.id, question] as const),
  )
  const answerMap = new Map<string, AnswerRecord>()
  for (const answer of answers) {
    if (!answerMap.has(answer.questionId)) {
      answerMap.set(answer.questionId, answer)
    }
  }

  const records = [...answerMap.values()]
  const answeredCount = records.length
  const correctCount = records.filter((record) => record.correct).length
  const accuracy =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
  const wrongRecords = records
    .filter((record) => !record.correct)
    .map((record) => ({
      record,
      question: questionMap.get(record.questionId),
    }))
    .filter(
      (item): item is { record: AnswerRecord; question: Question } =>
        Boolean(item.question),
    )

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            to={`/banks/${session.bankId}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-4" />
            返回题库
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            <Home className="size-4" />
            首页
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
        <Card className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-success-soft blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 size-56 rounded-full bg-primary-soft blur-3xl"
          />

          <div className="relative px-5 py-8 text-center sm:px-8 sm:py-10">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-success-soft text-success">
              <Trophy className="size-7" strokeWidth={1.8} />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              练习完成
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              {bankName} · {PRACTICE_MODE_LABELS[session.mode]}
            </p>

            <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface-2 px-2 py-3">
                <p className="text-xl font-semibold text-success sm:text-2xl">
                  {correctCount}
                  <span className="text-sm font-normal text-muted">
                    /{answeredCount}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-muted">答对</p>
              </div>
              <div className="rounded-xl bg-surface-2 px-2 py-3">
                <p className="text-xl font-semibold sm:text-2xl">
                  {accuracy}%
                </p>
                <p className="mt-1 text-[11px] text-muted">正确率</p>
              </div>
              <div className="rounded-xl bg-surface-2 px-2 py-3">
                <p className="text-xl font-semibold sm:text-2xl">
                  {formatDuration(session.elapsedSec ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted">用时</p>
              </div>
            </div>

            <div className="mx-auto mt-5 h-1.5 max-w-md overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-success transition-[width]"
                style={{ width: `${accuracy}%` }}
              />
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Target className="size-3.5" />
              本次共 {session.questionIds.length} 题，已作答 {answeredCount} 题
            </p>
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            to={`/banks/${session.bankId}/practice?mode=${session.mode}`}
            className={buttonStyles({ size: 'lg' })}
          >
            <RotateCcw className="size-4" />
            再练一次
          </Link>
          <Link
            to={`/banks/${session.bankId}`}
            className={buttonStyles({ variant: 'secondary', size: 'lg' })}
          >
            <LibraryBig className="size-4" />
            返回题库
          </Link>
        </div>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">本次错题</h2>
              <p className="mt-0.5 text-xs text-muted">
                正确率不是重点，把错题弄懂才有用。
              </p>
            </div>
            <Badge tone={wrongRecords.length > 0 ? 'warning' : 'success'}>
              {wrongRecords.length} 题
            </Badge>
          </div>

          {wrongRecords.length === 0 ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-success/25 bg-success-soft p-4">
              <CheckCircle2 className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium text-success">
                  {answeredCount > 0 ? '全部答对' : '还没有作答记录'}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {answeredCount > 0
                    ? '这次没有产生新的错题。'
                    : '本次练习没有可统计的作答记录。'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {wrongRecords.map(({ record, question }, index) => (
                <Card key={record.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted">
                      {index + 1}.
                    </span>
                    <Badge tone="primary">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </Badge>
                    <Badge>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
                    {question.chapter && (
                      <span className="text-[11px] text-muted">
                        {question.chapter}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 line-clamp-3 whitespace-pre-wrap text-sm leading-6">
                    {question.stem}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
                      <span className="font-medium">你的答案：</span>
                      {formatSelectedAnswer(question, record.selected)}
                    </div>
                    <div className="rounded-lg bg-success-soft px-3 py-2 text-success">
                      <span className="font-medium">正确答案：</span>
                      {formatAnswerSummary(question)}
                    </div>
                  </div>
                  {question.explanation && (
                    <p className="mt-3 border-t border-border pt-3 text-xs leading-6 text-muted">
                      {question.explanation}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 flex items-center justify-center gap-5 border-t border-border pt-6 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {session.elapsedSec
              ? `本次用时 ${formatDuration(session.elapsedSec)}`
              : '用时未记录'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {wrongRecords.length > 0 ? (
              <XCircle className="size-3.5" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {wrongRecords.length > 0
              ? `${wrongRecords.length} 道题需要复习`
              : '本次没有错题'}
          </span>
        </div>
      </main>
    </div>
  )
}
