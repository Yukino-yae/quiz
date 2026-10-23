import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'

const LIGHT_THEME_COLOR = '#f5f6f8'
const DARK_THEME_COLOR = '#0c0f16'

function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
}

export function useThemeSync() {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    if (theme !== 'system') {
      applyTheme(theme === 'dark')
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => applyTheme(media.matches)

    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])
}
