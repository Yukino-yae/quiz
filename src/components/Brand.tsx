import { BookOpenCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg shadow-card">
        <BookOpenCheck className="size-5" strokeWidth={2.1} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight tracking-tight text-fg">
          刷题
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
          Quiz
        </span>
      </span>
    </Link>
  )
}
