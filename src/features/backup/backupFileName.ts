export type BackupSource = 'manual' | 'auto'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local-time stamp with seconds, e.g. 2026-01-02_03-04-05. */
export function backupFileStamp(date = new Date()): string {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`,
  ].join('_')
}

export function backupFileName(
  source: BackupSource = 'manual',
  date = new Date(),
): string {
  const prefix = source === 'auto' ? '刷题题库自动备份' : '刷题题库备份'
  return `${prefix}-${backupFileStamp(date)}.json`
}
