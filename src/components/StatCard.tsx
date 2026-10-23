import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

type Tone = 'primary' | 'success' | 'warning' | 'neutral'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-surface-2 text-muted',
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  icon: LucideIcon
  tone?: Tone
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
}: StatCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg',
            toneClasses[tone],
          )}
        >
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-fg">
        {value}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-4 text-muted">{hint}</p>}
    </Card>
  )
}
