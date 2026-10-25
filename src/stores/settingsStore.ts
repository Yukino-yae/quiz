import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export const AUTO_BACKUP_INTERVALS = [5, 10, 15, 30, 60] as const
export type AutoBackupIntervalMin = (typeof AUTO_BACKUP_INTERVALS)[number]

interface SettingsState {
  theme: ThemeMode
  autoBackupEnabled: boolean
  autoBackupIntervalMin: AutoBackupIntervalMin
  /** Timestamp of the last successful automatic backup this browser knows about. */
  lastAutoBackupAt: number | null
  setTheme: (theme: ThemeMode) => void
  setAutoBackupEnabled: (enabled: boolean) => void
  setAutoBackupIntervalMin: (minutes: AutoBackupIntervalMin) => void
  markAutoBackup: (at: number) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      autoBackupEnabled: true,
      autoBackupIntervalMin: 10,
      lastAutoBackupAt: null,
      setTheme: (theme) => set({ theme }),
      setAutoBackupEnabled: (autoBackupEnabled) => set({ autoBackupEnabled }),
      setAutoBackupIntervalMin: (autoBackupIntervalMin) =>
        set({ autoBackupIntervalMin }),
      markAutoBackup: (lastAutoBackupAt) => set({ lastAutoBackupAt }),
    }),
    {
      name: 'quiz-settings',
    },
  ),
)
