import { Database } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Brand } from '@/components/Brand'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/cn'
import { navItems, type NavItem } from '@/app/nav'

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary-soft text-primary'
            : 'text-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className="size-[18px] shrink-0"
            strokeWidth={isActive ? 2.2 : 1.9}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function BottomLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors',
          isActive ? 'text-primary' : 'text-muted',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className="size-5"
            strokeWidth={isActive ? 2.3 : 1.8}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface/80 backdrop-blur-xl lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="主导航">
          {navItems.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="m-3 rounded-2xl bg-surface-2 p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium text-fg">
            <Database className="size-3.5 text-primary" />
            数据存于本机
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">
            题库与答题记录保存在此浏览器，建议定期导出备份。
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-xs text-muted">v0.4.0</span>
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <ThemeToggle />
      </header>

      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:pb-12">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="底部导航"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-safe backdrop-blur-xl lg:hidden"
      >
        <div className="flex items-stretch justify-around px-2 pt-1">
          {navItems.map((item) => (
            <BottomLink key={item.to} item={item} />
          ))}
        </div>
      </nav>
    </div>
  )
}
