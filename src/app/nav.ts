import {
  BarChart3,
  CircleX,
  Home,
  LibraryBig,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/banks', label: '题库', icon: LibraryBig },
  { to: '/wrong', label: '错题', icon: CircleX },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
]
