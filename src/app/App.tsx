import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { useThemeSync } from '@/hooks/useThemeSync'
import BankDetailPage from '@/pages/BankDetailPage'
import BanksPage from '@/pages/BanksPage'
import ExamPage from '@/pages/ExamPage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import PracticePage from '@/pages/PracticePage'
import PracticeSetupPage from '@/pages/PracticeSetupPage'
import StatsPage from '@/pages/StatsPage'
import WrongPage from '@/pages/WrongPage'

const ImportPage = lazy(() => import('@/pages/ImportPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export default function App() {
  useThemeSync()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="practice/:sessionId" element={<PracticePage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="banks/:bankId" element={<BankDetailPage />} />
          <Route
            path="banks/:bankId/practice"
            element={<PracticeSetupPage />}
          />
          <Route path="wrong" element={<WrongPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route
            path="import"
            element={
              <LazyPage>
                <ImportPage />
              </LazyPage>
            }
          />
          <Route
            path="settings"
            element={
              <LazyPage>
                <SettingsPage />
              </LazyPage>
            }
          />
          <Route path="exam/:sessionId" element={<ExamPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
