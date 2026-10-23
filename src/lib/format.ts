import dayjs from 'dayjs'

export function formatDate(timestamp: number): string {
  return dayjs(timestamp).format('YYYY-MM-DD')
}

export function formatRelativeDate(timestamp: number): string {
  const date = dayjs(timestamp)
  const today = dayjs().startOf('day')

  if (!date.isBefore(today)) return '今天'
  if (!date.isBefore(today.subtract(1, 'day'))) return '昨天'
  return date.format('M月D日')
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remaining = seconds % 60

  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  if (minutes > 0) return `${minutes} 分 ${remaining} 秒`
  return `${remaining} 秒`
}
