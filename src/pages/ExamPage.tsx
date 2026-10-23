import { FileText } from 'lucide-react'
import { ComingSoon } from '@/components/ComingSoon'

export default function ExamPage() {
  return (
    <ComingSoon
      icon={FileText}
      title="模拟考试正在搭建"
      description="阶段 5 会实现组卷、倒计时、答题卡、交卷判分和成绩历史。"
    />
  )
}
