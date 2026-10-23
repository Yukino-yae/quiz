import { CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { buttonStyles } from '@/components/ui/buttonStyles'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        className="w-full max-w-lg bg-surface"
        icon={CircleAlert}
        title="页面不存在"
        description="链接可能已经失效，或者地址输入有误。"
        action={
          <Link to="/" className={buttonStyles()}>
            回到首页
          </Link>
        }
      />
    </div>
  )
}
