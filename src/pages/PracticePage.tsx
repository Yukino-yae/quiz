import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Loader2,
  Play,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'
import { toggleQuestionFavorite } from '@/db/questionStateRepository'
import {
  advanceSession,
  completeSession,
  recordAnswer,
} from '@/db/sessionRepository'
import { PracticeQuestion } from '@/features/practice/PracticeQuestion'
import { PracticeResult } from '@/features/practice/PracticeResult'
import { PRACTICE_MODE_LABELS } from '@/lib/labels'
import type { Question, QuestionState } from '@/types/quiz'

function PracticeShell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>
}

function LoadingPractice() {
  return (
    <PracticeShell>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <div className="size-8 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      </main>
    </PracticeShell>
  )
}

export default function PracticePage() {
  const { sessionId = '' } = useParams()
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) return null

    const [bank, questionRecords, stateRecords] = await Promise.all([
      db.banks.get(session.bankId),
      db.questions.bulkGet(session.questionIds),
      db.questionStates.bulkGet(session.questionIds),
    ])

    return {
      session,
      bankName: bank?.name ?? '已删除的题库',
      questions: questionRecords.filter(
        (question): question is Question => Boolean(question),
      ),
      states: stateRecords.filter(
        (state): state is QuestionState => Boolean(state),
      ),
    }
  }, [sessionId])

  const answers = useLiveQuery(
    () => db.answers.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  )

  const [skipping, setSkipping] = useState(false)

  if (data === undefined || (data && answers === undefined)) {
    return <LoadingPractice />
  }

  if (!data) {
    return (
      <PracticeShell>
        <div className="flex min-h-dvh items-center justify-center px-4">
          <EmptyState
            className="w-full max-w-lg"
            icon={Play}
            title="练习记录不存在"
            description="它可能已经被删除，或者链接不正确。"
            action={
              <Link to="/banks" className={buttonStyles()}>
                返回题库列表
              </Link>
            }
          />
        </div>
      </PracticeShell>
    )
  }

  const { session, bankName, questions, states } = data
  const answerRecords = answers ?? []
  const stateMap = new Map(
    states.map((state) => [state.questionId, state] as const),
  )

  if (session.finishedAt) {
    return (
      <PracticeResult
        session={session}
        bankName={bankName}
        questions={questions}
        answers={answerRecords}
      />
    )
  }

  const total = session.questionIds.length
  const index = Math.min(session.cursor, Math.max(total - 1, 0))
  const currentId = session.questionIds[index]
  const currentQuestion = questions.find(
    (question) => question.id === currentId,
  )
  const existingAnswer = answerRecords.find(
    (answer) => answer.questionId === currentId,
  )
  const answeredCount = new Set(
    answerRecords.map((answer) => answer.questionId),
  ).size
  const progress = total > 0 ? (answeredCount / total) * 100 : 0
  const isLast = index >= total - 1

  async function moveNext() {
    if (isLast || !currentQuestion) {
      await completeSession(session.id)
      return
    }
    await advanceSession(session.id, index + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSkip() {
    if (skipping) return
    setSkipping(true)
    try {
      if (isLast) {
        await completeSession(session.id)
      } else {
        await advanceSession(session.id, index + 1)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSkipping(false)
    }
  }

  async function handleAnswer(
    selected: string[],
    correct: boolean,
    timeSpentMs: number,
  ) {
    if (!currentQuestion) throw new Error('题目不存在')
    await recordAnswer({
      sessionId: session.id,
      question: currentQuestion,
      selected,
      correct,
      timeSpentMs,
    })
  }

  async function handleToggleFavorite() {
    if (!currentQuestion) return
    await toggleQuestionFavorite(currentQuestion)
  }

  return (
    <PracticeShell>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Link
            to={`/banks/${session.bankId}`}
            aria-label="退出练习"
            title="退出后可在首页继续"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:px-2"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">退出</span>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[13px] font-medium">
              {PRACTICE_MODE_LABELS[session.mode]} · {bankName}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted">
              第 {index + 1} / {total} 题
            </p>
          </div>
          <span className="min-w-10 shrink-0 text-right text-xs tabular-nums text-muted">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 bg-surface-2">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-36 pt-5 sm:px-6 sm:pt-6">
        {total === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="这场练习没有题目"
            description="题目可能已经被删除，请返回题库重新开始。"
            action={
              <Link
                to={`/banks/${session.bankId}`}
                className={buttonStyles()}
              >
                返回题库
              </Link>
            }
          />
        ) : !currentQuestion ? (
          <Card className="p-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
              <AlertCircle className="size-5" />
            </span>
            <h1 className="mt-4 text-base font-medium">题目已被删除</h1>
            <p className="mt-1.5 text-sm text-muted">
              这道题可能已经在题目管理中被删除，可以跳过继续作答。
            </p>
            <Button
              className="mt-5"
              disabled={skipping}
              onClick={handleSkip}
            >
              {skipping ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isLast ? '结束练习' : '跳过，下一题'}
            </Button>
          </Card>
        ) : (
          <PracticeQuestion
            key={currentQuestion.id}
            question={currentQuestion}
            existingAnswer={existingAnswer}
            favorite={stateMap.get(currentQuestion.id)?.favorite ?? false}
            isLast={isLast}
            onAnswer={handleAnswer}
            onNext={moveNext}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </main>
    </PracticeShell>
  )
}
