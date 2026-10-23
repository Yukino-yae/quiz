import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSettingsStore, type ThemeMode } from '@/stores/settingsStore'

const themes: Record<ThemeMode, { label: string; icon: typeof Sun }> = {
  light: { label: '浅色', icon: Sun },
  dark: { label: '深色', icon: Moon },
  system: { label: '跟随系统', icon: Monitor },
}

const order: ThemeMode[] = ['light', 'dark', 'system']

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const current = themes[theme]
  const next = order[(order.indexOf(theme) + 1) % order.length]
  const Icon = current.icon

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`当前主题：${current.label}，点击切换为${themes[next].label}`}
      title={`主题：${current.label}`}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted transition-colors hover:text-fg',
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.9} />
    </button>
  )
}
