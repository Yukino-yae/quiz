import type { LucideIcon } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
  backTo?: string
  backLabel?: string
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
  backTo = '/banks',
  backLabel = '返回题库',
}: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Icon className="size-6" strokeWidth={1.8} />
        </span>
        <div className="mt-4 flex justify-center">
          <Badge tone="warning">开发中</Badge>
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
          {description}
        </p>
        <Link
          to={backTo}
          className={buttonStyles({
            variant: 'secondary',
            className: 'mt-6',
          })}
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      </Card>
    </div>
  )
}
