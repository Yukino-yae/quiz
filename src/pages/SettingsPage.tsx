import dayjs from 'dayjs'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Check,
  Clock,
  Database,
  Download,
  Loader2,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { db } from '@/db/db'
import {
  clearAllData,
  exportBackup,
  readBackupFile,
  restoreBackup,
  summarizeBackup,
  type BackupPayload,
  type RestoreMode,
} from '@/features/backup/backupService'
import { cn } from '@/lib/cn'
import {
  AUTO_BACKUP_INTERVALS,
  useSettingsStore,
  type AutoBackupIntervalMin,
  type ThemeMode,
} from '@/stores/settingsStore'

const themeOptions: {
  value: ThemeMode
  label: string
  icon: LucideIcon
}[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
]

function SettingRow({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
          <Icon className="size-4" strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
        </div>
      </div>
      <div className="pl-12 sm:shrink-0 sm:pl-0">{action}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-surface-2 ring-1 ring-inset ring-border',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

function Feedback({
  tone,
  children,
}: {
  tone: 'success' | 'danger'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[12px] leading-5',
        tone === 'success'
          ? 'bg-success-soft text-success'
          : 'bg-danger-soft text-danger',
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {tone === 'danger' ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" />
      )}
      <p>{children}</p>
    </div>
  )
}

export default function SettingsPage() {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const autoBackupEnabled = useSettingsStore(
    (state) => state.autoBackupEnabled,
  )
  const autoBackupIntervalMin = useSettingsStore(
    (state) => state.autoBackupIntervalMin,
  )
  const lastAutoBackupAt = useSettingsStore(
    (state) => state.lastAutoBackupAt,
  )
  const setAutoBackupEnabled = useSettingsStore(
    (state) => state.setAutoBackupEnabled,
  )
  const setAutoBackupIntervalMin = useSettingsStore(
    (state) => state.setAutoBackupIntervalMin,
  )
  const counts = useLiveQuery(async () => {
    const [banks, questions] = await Promise.all([
      db.banks.count(),
      db.questions.count(),
    ])
    return { banks, questions }
  }, [])

  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'' | 'export' | 'restore' | 'clear'>('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    fileName: string
    payload: BackupPayload
  } | null>(null)
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge')
  const [confirmClear, setConfirmClear] = useState(false)

  const handleExport = async () => {
    setBusy('export')
    setError('')
    setNotice('')
    try {
      const fileName = await exportBackup()
      setNotice(`备份已导出：${fileName}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败，请重试')
    } finally {
      setBusy('')
    }
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError('')
    setNotice('')
    setConfirmClear(false)
    try {
      const payload = await readBackupFile(file)
      setPending({ fileName: file.name, payload })
      setRestoreMode('merge')
    } catch (err) {
      setPending(null)
      setError(err instanceof Error ? err.message : '备份文件读取失败')
    }
  }

  const handleRestore = async () => {
    if (!pending) return
    setBusy('restore')
    setError('')
    setNotice('')
    try {
      const result = await restoreBackup(pending.payload, restoreMode)
      setNotice(
        restoreMode === 'replace'
          ? `恢复完成：共 ${result.banks} 个题库、${result.questions} 道题。`
          : `合并完成：新增 ${result.addedBanks} 个题库、${result.addedQuestions} 道题。`,
      )
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败，请重试')
    } finally {
      setBusy('')
    }
  }

  const handleClear = async () => {
    setBusy('clear')
    setError('')
    setNotice('')
    try {
      await clearAllData()
      setNotice('本机数据已全部清空。')
      setConfirmClear(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空失败，请重试')
    } finally {
      setBusy('')
    }
  }

  const summary = pending ? summarizeBackup(pending.payload) : null
  const isBusy = busy !== ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        description="调整外观、备份数据。所有内容都只保存在这台设备的浏览器里。"
      />

      <Card className="p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold">外观</h2>
        <p className="mt-1 text-[13px] text-muted">
          选择主题，修改后立即生效。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const active = theme === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface text-fg hover:bg-surface-2',
                )}
              >
                <option.icon className="size-4" strokeWidth={1.9} />
                <span className="font-medium">{option.label}</span>
                {active && <Check className="ml-auto size-4" />}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">数据与备份</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            数据存放在浏览器 IndexedDB 中，清理浏览器数据或更换设备会丢失。
            建议定期导出备份。当前
            {counts
              ? `有 ${counts.banks} 个题库、${counts.questions} 道题。`
              : '数据加载中…'}
          </p>
        </div>

        <div className="mt-2 divide-y divide-border">
          <SettingRow
            icon={Download}
            title="导出备份"
            description="立即导出点击时刻之前的全部题库、练习记录和设置。"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={isBusy}
              >
                {busy === 'export' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                导出
              </Button>
            }
          />
          <SettingRow
            icon={Upload}
            title="导入备份"
            description="从备份文件恢复数据，可选择合并或覆盖。"
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFile}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={isBusy}
                >
                  <Upload className="size-3.5" />
                  选择文件
                </Button>
              </>
            }
          />
          <SettingRow
            icon={Trash2}
            title="清空数据"
            description="删除本机全部题库和练习记录，操作不可恢复。"
            action={
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setConfirmClear(true)
                  setPending(null)
                  setNotice('')
                  setError('')
                }}
                disabled={isBusy || confirmClear}
              >
                <Trash2 className="size-3.5" />
                清空
              </Button>
            }
          />
        </div>

        {notice && <Feedback tone="success">{notice}</Feedback>}
        {error && <Feedback tone="danger">{error}</Feedback>}

        {pending && summary && (
          <div className="mt-3 rounded-xl border border-border bg-bg/50 p-4">
            <h3 className="text-[13px] font-semibold">恢复备份</h3>
            <p className="mt-1 break-all text-[12px] text-muted">
              {pending.fileName}
              <span className="mx-1.5 text-border-strong">·</span>
              {summary.banks} 个题库
              <span className="mx-1.5 text-border-strong">·</span>
              {summary.questions} 道题
              {summary.sessions > 0 && (
                <>
                  <span className="mx-1.5 text-border-strong">·</span>
                  {summary.sessions} 次练习
                </>
              )}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    'merge',
                    '合并导入',
                    '保留当前数据，相同 ID 以备份为准。',
                  ],
                  [
                    'replace',
                    '覆盖恢复',
                    '先清空当前数据，再完整恢复备份。',
                  ],
                ] as const
              ).map(([value, title, description]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={restoreMode === value}
                  onClick={() => setRestoreMode(value)}
                  className={cn(
                    'rounded-xl border px-3.5 py-3 text-left transition-colors',
                    restoreMode === value
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-surface hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'text-[13px] font-medium',
                      restoreMode === value ? 'text-primary' : 'text-fg',
                    )}
                  >
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                    {description}
                  </span>
                </button>
              ))}
            </div>

            {restoreMode === 'replace' && (
              <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[11px] leading-5 text-danger">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                覆盖恢复会删除当前全部题库和练习记录，建议先导出一份备份。
              </p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPending(null)}
                disabled={isBusy}
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleRestore}
                disabled={isBusy}
              >
                {busy === 'restore' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {restoreMode === 'replace' ? '覆盖并恢复' : '合并导入'}
              </Button>
            </div>
          </div>
        )}

        {confirmClear && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger-soft p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <h3 className="text-[13px] font-semibold text-danger">
                  确认清空全部数据？
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-danger/90">
                  所有题库、题目、错题和练习记录都会被删除，无法撤销。
                  建议先导出备份。
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmClear(false)}
                disabled={isBusy}
              >
                取消
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleClear}
                disabled={isBusy}
              >
                {busy === 'clear' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                确认清空
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div>
          <h2 className="text-[15px] font-semibold">自动备份</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            页面打开期间定时把全部数据导出为 JSON 文件。关闭页面或切换标签页后暂停，
            回到页面时如果已经超过间隔会立即补一份。
          </p>
        </div>

        <div className="mt-2 divide-y divide-border">
          <SettingRow
            icon={Timer}
            title="定时自动备份"
            description={
              autoBackupEnabled
                ? `每 ${autoBackupIntervalMin} 分钟自动下载一份备份。`
                : '已关闭，不会自动下载备份文件。'
            }
            action={
              <Toggle
                checked={autoBackupEnabled}
                onChange={setAutoBackupEnabled}
                label="定时自动备份"
              />
            }
          />
          <SettingRow
            icon={Clock}
            title="备份间隔"
            description="间隔越短越安全，但下载文件夹里会积累更多文件。"
            action={
              <select
                value={autoBackupIntervalMin}
                onChange={(event) =>
                  setAutoBackupIntervalMin(
                    Number(event.target.value) as AutoBackupIntervalMin,
                  )
                }
                disabled={!autoBackupEnabled}
                aria-label="自动备份间隔"
                className="h-9 rounded-lg border border-border bg-surface px-2.5 text-[13px] text-fg outline-none transition-colors focus:border-primary disabled:opacity-50"
              >
                {AUTO_BACKUP_INTERVALS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    每 {minutes} 分钟
                  </option>
                ))}
              </select>
            }
          />
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4 text-[12px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {lastAutoBackupAt
              ? `上次自动备份：${dayjs(lastAutoBackupAt).format('M月D日 HH:mm:ss')}`
              : '本次打开页面后还没有自动备份。'}
          </span>
          <span className="inline-flex items-start gap-1.5 text-warning">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            浏览器可能询问是否允许下载多个文件，请选择允许，否则之后的自动备份会被拦截。
          </span>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
            <ShieldCheck className="size-4" strokeWidth={1.9} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold">数据仅存本机</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              这个版本不需要账号，也不会上传任何内容到服务器。换设备使用时，
              通过备份文件迁移即可。
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Database className="size-3.5" />
            IndexedDB · 本地存储
          </span>
          <span>版本 0.4.0</span>
        </div>
      </Card>
    </div>
  )
}
