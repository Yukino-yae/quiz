import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CircleCheck,
  Target,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'

export default function StatsPage() {
  const stats = useLiveQuery(async () => {
    const [answers, masteredCount] = await Promise.all([
      db.answers.toArray(),
      db.questionStates.where('status').equals('mastered').count(),
    ])

    const correctCount = answers.filter((answer) => answer.correct).length
    const activeDays = new Set(
      answers.map((answer) => dayjs(answer.answeredAt).format('YYYY-MM-DD')),
    ).size

    return {
      answeredCount: answers.length,
      correctCount,
      masteredCount,
      activeDays,
    }
  }, [])

  const accuracy =
    stats && stats.answeredCount > 0
      ? `${Math.round((stats.correctCount / stats.answeredCount) * 100)}%`
      : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="学习统计"
        description="做题记录只保存在本机，这里会汇总你的正确率、掌握进度和练习天数。"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="累计做题"
          value={stats?.answeredCount ?? '—'}
          icon={BookOpen}
          tone="primary"
          hint="每次作答都会记录"
        />
        <StatCard
          label="总正确率"
          value={accuracy}
          icon={Target}
          tone="success"
          hint={stats ? `答对 ${stats.correctCount} 题` : '完成练习后统计'}
        />
        <StatCard
          label="已掌握"
          value={stats?.masteredCount ?? '—'}
          icon={CircleCheck}
          hint="连续答对 3 次或手动标记"
        />
        <StatCard
          label="学习天数"
          value={stats?.activeDays ?? '—'}
          icon={CalendarCheck}
          tone="warning"
          hint="有做题记录的日期"
        />
      </div>

      <Card className="p-5 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">近 7 天做题趋势</h2>
            <Badge>阶段 6</Badge>
          </div>
          <p className="mt-1 text-[13px] text-muted">
            阶段 6 会在这里展示每日做题量和正确率。
          </p>
        </div>

        <div className="mt-5 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong/70 bg-bg/50 text-muted">
          <BarChart3 className="size-5" strokeWidth={1.8} />
          <p className="mt-2 text-sm">暂无数据</p>
          <p className="mt-1 text-xs">完成一次练习后开始统计</p>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold">学习建议</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {stats && stats.answeredCount > 0
            ? '保持每天练习，优先重做错题，再挑战随机练习检验掌握程度。'
            : '还没有做题记录。导入题库后，从顺序练习开始建立第一份学习记录。'}
        </p>
      </Card>
    </div>
  )
}
