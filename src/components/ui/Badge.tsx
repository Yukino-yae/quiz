import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
