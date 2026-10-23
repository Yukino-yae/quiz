import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  description?: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = '返回',
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {backTo && (
          <Link
            to={backTo}
            className="mb-2 inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
