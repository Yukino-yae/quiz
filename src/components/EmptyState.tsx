import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong/70 bg-surface/50 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <h3 className="mt-4 text-[15px] font-medium text-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      )}
    </div>
  )
}
