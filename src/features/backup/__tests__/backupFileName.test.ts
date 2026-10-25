import { describe, expect, it } from 'vitest'
import { backupFileName, backupFileStamp } from '../backupFileName'

describe('backupFileName', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5)

  it('builds a local timestamp with seconds', () => {
    expect(backupFileStamp(date)).toBe('2026-01-02_03-04-05')
  })

  it('labels manual backups', () => {
    expect(backupFileName('manual', date)).toBe(
      '刷题题库备份-2026-01-02_03-04-05.json',
    )
  })

  it('labels automatic backups separately', () => {
    expect(backupFileName('auto', date)).toBe(
      '刷题题库自动备份-2026-01-02_03-04-05.json',
    )
  })

  it('differs between backups taken in different seconds', () => {
    const later = new Date(2026, 0, 2, 3, 4, 6)
    expect(backupFileName('auto', date)).not.toBe(backupFileName('auto', later))
  })
})
