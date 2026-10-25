import { useEffect } from 'react'
import { db } from '@/db/db'
import { exportBackup } from '@/features/backup/backupService'
import { useSettingsStore } from '@/stores/settingsStore'

/** How often the scheduler wakes up to check whether a backup is due. */
const TICK_MS = 30_000

async function hasBackupData(): Promise<boolean> {
  const [banks, questions, sessions, answers] = await Promise.all([
    db.banks.count(),
    db.questions.count(),
    db.sessions.count(),
    db.answers.count(),
  ])
  return banks > 0 || questions > 0 || sessions > 0 || answers > 0
}

/**
 * Downloads a timestamped JSON backup every N minutes while the app is open.
 * Timers and downloads pause while the tab is hidden, and a backup that became
 * due while hidden runs as soon as the tab becomes visible again.
 */
export function useAutoBackup() {
  const enabled = useSettingsStore((state) => state.autoBackupEnabled)
  const intervalMin = useSettingsStore((state) => state.autoBackupIntervalMin)
  const markAutoBackup = useSettingsStore((state) => state.markAutoBackup)

  useEffect(() => {
    if (!enabled) return

    const intervalMs = Math.max(1, intervalMin) * 60_000
    let lastRunAt = Date.now()
    let running = false
    let disposed = false

    const tick = () => {
      if (disposed || running) return
      if (document.visibilityState === 'hidden') return
      if (Date.now() - lastRunAt < intervalMs) return

      running = true
      lastRunAt = Date.now()

      void hasBackupData()
        .then((hasData) => {
          if (!hasData) return false
          return exportBackup('auto').then(() => true)
        })
        .then((exported) => {
          if (exported && !disposed) markAutoBackup(Date.now())
        })
        .catch((error: unknown) => {
          console.error('自动备份失败', error)
        })
        .finally(() => {
          running = false
        })
    }

    const timer = window.setInterval(tick, Math.min(intervalMs, TICK_MS))
    document.addEventListener('visibilitychange', tick)

    return () => {
      disposed = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, intervalMin, markAutoBackup])
}
