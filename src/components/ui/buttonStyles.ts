import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg hover:opacity-90 active:opacity-80',
  secondary:
    'border border-border bg-surface text-fg hover:bg-surface-2 active:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger-soft text-danger hover:bg-danger/15',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
}

export function buttonStyles(options: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}): string {
  const { variant = 'primary', size = 'md', className } = options
  return cn(base, variantClasses[variant], sizeClasses[size], className)
}
