import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { buttonStyles } from '@/components/ui/buttonStyles'
import { Card } from '@/components/ui/Card'
import { createBank, listBanks } from '@/db/bankRepository'
import { parseImportFile } from '@/features/import/fileParser'
import { importQuestions } from '@/features/import/importService'
import {
  downloadIssuesCsv,
  downloadParsedCsv,
  downloadParsedXlsx,
  downloadTemplateCsv,
  downloadTemplateTxt,
  downloadTemplateXlsx,
} from '@/features/import/template'
import type {
  DraftQuestion,
  ImportFileType,
  ParseIssue,
  ParseResult,
} from '@/features/import/types'
import { cn } from '@/lib/cn'
import { QUESTION_TYPE_LABELS } from '@/lib/labels'
import type { Bank } from '@/types/quiz'

const FILE_LABELS: Record<ImportFileType, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  txt: 'TXT',
  docx: 'Word',
}

const columns = [
  ['题型', '必填', '单选 / 多选 / 判断 / 填空 / 简答'],
  ['题干', '必填', '填空题用 ____ 表示空'],
  ['选项A–H', '选择题必填', '至少两个选项，用不到的列留空即可'],
  ['答案', '必填', '写法见下方“答案格式”'],
  ['解析', '选填', '作答后展示'],
  ['章节', '选填', '用于按章节筛选和统计'],
  ['难度', '选填', '易 / 中 / 难，默认中'],
  ['标签', '选填', '多个标签用逗号或顿号分隔'],
  ['关键词', '简答选填', '用 | 分隔；留空则采用自评'],
]

const answerFormats = [
  { type: '单选', code: 'A' },
  { type: '多选', code: 'ABC' },
  { type: '判断', code: '对 / 错' },
  { type: '填空', code: '北京|首都；中国' },
  { type: '简答', code: '参考答案全文' },
]

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg placeholder:text-muted/70 focus:border-primary focus:outline-none'

function answerSummary(question: DraftQuestion): string {
  if (question.type === 'single' || question.type === 'multiple') {
    return question.answer.join('')
  }
  if (question.type === 'judge') {
    return question.answer[0] === 'true' ? '对' : '错'
  }
  if (question.type === 'fill') {
    return question.answerGroups.map((group) => group.join(' / ')).join('；')
  }
  return question.referenceAnswer
}

function StepTitle({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
        {index}
      </span>
      <h2 className="text-[15px] font-semibold">{title}</h2>
    </div>
  )
}

function IssueIcon({ level }: { level: ParseIssue['level'] }) {
  return level === 'error' ? (
    <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />
  ) : (
    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
  )
}

function BankSelector({
  banks,
  mode,
  bankId,
  name,
  description,
  disabled,
  onModeChange,
  onBankChange,
  onNameChange,
  onDescriptionChange,
}: {
  banks: Bank[]
  mode: 'existing' | 'new'
  bankId: string
  name: string
  description: string
  disabled: boolean
  onModeChange: (mode: 'existing' | 'new') => void
  onBankChange: (id: string) => void
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
}) {
  return (
    <div>
      <StepTitle index="1" title="选择目标题库" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled || banks.length === 0}
          aria-pressed={mode === 'existing'}
          onClick={() => onModeChange('existing')}
          className={cn(
            'rounded-xl border px-3.5 py-3 text-left text-sm transition-colors disabled:opacity-60',
            mode === 'existing'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-bg/40 text-fg hover:bg-surface-2',
          )}
        >
          <span className="font-medium">导入到已有题库</span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {banks.length === 0
              ? '还没有题库，请先新建'
              : '自动检查题库中的重复题'}
          </span>
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={mode === 'new'}
          onClick={() => onModeChange('new')}
          className={cn(
            'rounded-xl border px-3.5 py-3 text-left text-sm transition-colors disabled:opacity-60',
            mode === 'new'
              ? 'border-primary bg-primary-soft text-primary'
              : 'border-border bg-bg/40 text-fg hover:bg-surface-2',
          )}
        >
          <span className="font-medium">新建题库并导入</span>
          <span className="mt-0.5 block text-[11px] text-muted">
            适合按科目或考试分开存放
          </span>
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="mt-3">
          {banks.length === 0 ? (
            <p className="rounded-xl bg-warning-soft px-3.5 py-3 text-[12px] leading-5 text-warning">
              还没有题库，请先切换为“新建题库并导入”。
            </p>
          ) : (
            <select
              value={bankId}
              disabled={disabled}
              onChange={(event) => onBankChange(event.target.value)}
              className={inputClass}
              aria-label="目标题库"
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              题库名称
            </span>
            <input
              value={name}
              disabled={disabled}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="例如：计算机二级真题"
              maxLength={60}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">
              简介（选填）
            </span>
            <input
              value={description}
              disabled={disabled}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="例如：2025 年 3 月真题"
              maxLength={120}
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function FilePicker({
  file,
  dragging,
  disabled,
  onChoose,
  onDrop,
  onDragStateChange,
}: {
  file: File | null
  dragging: boolean
  disabled: boolean
  onChoose: (file: File) => void
  onDrop: (file: File) => void
  onDragStateChange: (dragging: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (selected) onChoose(selected)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    onDragStateChange(false)
    if (disabled) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) onDrop(dropped)
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="选择题目文件"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) onDragStateChange(true)
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={handleDrop}
      className={cn(
        'mt-3 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors',
        dragging
          ? 'border-primary bg-primary-soft/60'
          : 'border-border-strong/70 bg-bg/50 hover:border-primary/60 hover:bg-primary-soft/30',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv,.txt,.md,.docx"
        onChange={handleInput}
        className="hidden"
      />
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
        {file ? (
          <FileSpreadsheet className="size-5" strokeWidth={1.8} />
        ) : (
          <FileUp className="size-5" strokeWidth={1.8} />
        )}
      </span>
      {file ? (
        <>
          <p className="mt-3 break-all text-sm font-medium">{file.name}</p>
          <p className="mt-1 text-xs text-muted">
            {(file.size / 1024).toFixed(1)} KB · 点击可更换文件
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium">
            点击选择，或把文件拖到这里
          </p>
          <p className="mt-1 text-xs text-muted">
            支持 .xlsx / .csv / .txt / .docx
          </p>
        </>
      )}
    </div>
  )
}

export default function ImportPage() {
  const banks = useLiveQuery(() => listBanks(), [])
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing')
  const [bankId, setBankId] = useState('')
  const [newBankName, setNewBankName] = useState('')
  const [newBankDescription, setNewBankDescription] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [dragging, setDragging] = useState(false)

  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [importedBankId, setImportedBankId] = useState('')
  const [importError, setImportError] = useState('')

  const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning'>(
    'all',
  )
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [downloading, setDownloading] = useState<'' | 'xlsx' | 'template'>('')
  const parseRequestRef = useRef(0)

  const selectedBankId = bankId || banks?.[0]?.id || ''
  const effectiveMode =
    targetMode === 'existing' && (banks?.length ?? 0) === 0
      ? 'new'
      : targetMode
  const dedupeBankId =
    effectiveMode === 'existing' ? selectedBankId || undefined : undefined

  const runParse = async (
    selectedFile: File,
    targetId: string | undefined,
  ) => {
    const requestId = ++parseRequestRef.current
    setParsing(true)
    setParseError('')
    setIssueFilter('all')
    setPreviewExpanded(false)
    setResult(null)

    try {
      const parsed = await parseImportFile(selectedFile, targetId)
      if (parseRequestRef.current !== requestId) return
      setResult(parsed)
    } catch (error: unknown) {
      if (parseRequestRef.current !== requestId) return
      setParseError(
        error instanceof Error
          ? error.message
          : '文件解析失败，请换一种格式试试。',
      )
    } finally {
      if (parseRequestRef.current === requestId) setParsing(false)
    }
  }

  const chooseFile = (selected: File) => {
    if (selected.size > 30 * 1024 * 1024) {
      setParseError('文件超过 30 MB，建议拆分后再导入。')
      return
    }
    setImportedCount(null)
    setImportError('')
    setResult(null)
    setParseError('')
    setFile(selected)
    void runParse(selected, dedupeBankId)
  }

  const changeMode = (mode: 'existing' | 'new') => {
    setTargetMode(mode)
    setImportError('')
    if (file) {
      void runParse(
        file,
        mode === 'existing' ? bankId || banks?.[0]?.id : undefined,
      )
    }
  }

  const changeBank = (id: string) => {
    setBankId(id)
    setImportError('')
    if (file) void runParse(file, id)
  }

  const parsedQuestions = result?.questions ?? []
  const importableCount = parsedQuestions.filter(
    (question) => !(skipDuplicates && question.duplicate),
  ).length

  const filteredIssues = useMemo(() => {
    const issues = result?.issues ?? []
    if (issueFilter === 'all') return issues
    return issues.filter((issue) => issue.level === issueFilter)
  }, [result, issueFilter])

  const visibleQuestions = previewExpanded
    ? parsedQuestions.slice(0, 100)
    : parsedQuestions.slice(0, 6)

  const targetMissing =
    effectiveMode === 'existing' ? !selectedBankId : !newBankName.trim()

  const canImport =
    Boolean(result) &&
    !parsing &&
    !importing &&
    !targetMissing &&
    importableCount > 0

  const handleImport = async () => {
    if (!result || !canImport) return
    setImporting(true)
    setImportError('')

    try {
      let targetId = selectedBankId
      if (effectiveMode === 'new') {
        const bank = await createBank({
          name: newBankName.trim(),
          description: newBankDescription.trim(),
        })
        targetId = bank.id
      }

      const count = await importQuestions(
        targetId,
        result.questions,
        skipDuplicates,
      )
      setImportedBankId(targetId)
      setImportedCount(count)
    } catch (error: unknown) {
      setImportError(
        error instanceof Error ? error.message : '导入失败，请稍后重试。',
      )
    } finally {
      setImporting(false)
    }
  }

  const resetForNext = () => {
    setFile(null)
    setResult(null)
    setParseError('')
    setImportError('')
    setImportedCount(null)
    setPreviewExpanded(false)
    setSkipDuplicates(true)
    if (importedBankId) {
      setBankId(importedBankId)
      setTargetMode('existing')
      setNewBankName('')
      setNewBankDescription('')
    }
  }

  const handleDownloadParsedXlsx = async () => {
    if (!result) return
    setDownloading('xlsx')
    try {
      await downloadParsedXlsx(result.questions, result.fileName)
    } catch {
      setImportError('导出 Excel 失败，请改用 CSV。')
    } finally {
      setDownloading('')
    }
  }

  const handleDownloadTemplateXlsx = async () => {
    setDownloading('template')
    try {
      await downloadTemplateXlsx()
    } catch {
      setImportError('模板下载失败，请改用 CSV 模板。')
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="导入题库"
        description="支持 Excel、CSV、TXT 和 Word 文档。先预览校验，再确认导入，题量会自动统计。"
        actions={
          <Link
            to="/banks"
            className={buttonStyles({ variant: 'secondary' })}
          >
            返回题库
          </Link>
        }
      />

      {importedCount !== null ? (
        <Card className="p-6 sm:p-8">
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
              <CheckCircle2 className="size-7" strokeWidth={1.8} />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              {importedCount > 0 ? '导入完成' : '没有导入新题目'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {importedCount > 0
                ? `已成功导入 ${importedCount} 道题，可以开始练习或继续补充题目。`
                : '识别到的题目都已存在于目标题库中。可以关闭“跳过重复题”再试一次。'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to={`/banks/${importedBankId}`}
                className={buttonStyles()}
              >
                查看题库
              </Link>
              <Button variant="secondary" onClick={resetForNext}>
                <RotateCcw className="size-4" />
                继续导入
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <BankSelector
              banks={banks ?? []}
              mode={effectiveMode}
              bankId={selectedBankId}
              name={newBankName}
              description={newBankDescription}
              disabled={parsing || importing}
              onModeChange={changeMode}
              onBankChange={changeBank}
              onNameChange={setNewBankName}
              onDescriptionChange={setNewBankDescription}
            />

            <div className="mt-5 border-t border-border pt-5">
              <StepTitle index="2" title="选择题目文件" />
              <FilePicker
                file={file}
                dragging={dragging}
                disabled={parsing || importing}
                onChoose={chooseFile}
                onDrop={chooseFile}
                onDragStateChange={setDragging}
              />
              <p className="mt-2 text-[11px] leading-5 text-muted">
                .xls / .doc 旧格式不支持，请先另存为 .xlsx / .docx。图片题不会导入。
              </p>
            </div>

            {parseError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-3 text-[12px] leading-5 text-danger">
                <CircleX className="mt-0.5 size-4 shrink-0" />
                <p>{parseError}</p>
              </div>
            )}

            {parsing && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-muted">
                <Loader2 className="size-4 animate-spin text-primary" />
                正在解析文件，并检查格式与重复题…
              </div>
            )}
          </Card>

          {result && !parsing && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <StepTitle index="3" title="预览并确认" />
                  <p className="mt-2 break-all text-[13px] text-muted">
                    {result.fileName}
                    <span className="mx-1.5 text-border-strong">·</span>
                    {FILE_LABELS[result.fileType]}
                    <span className="mx-1.5 text-border-strong">·</span>
                    识别 {result.rows} 题
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadParsedCsv(result.questions, result.fileName)}
                    disabled={parsedQuestions.length === 0}
                  >
                    <Download className="size-3.5" />
                    导出 CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadParsedXlsx}
                    disabled={
                      parsedQuestions.length === 0 || downloading === 'xlsx'
                    }
                  >
                    {downloading === 'xlsx' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    导出 Excel
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: '可导入',
                    value: importableCount,
                    className: 'text-success',
                  },
                  {
                    label: '重复',
                    value: result.duplicateCount,
                    className: 'text-warning',
                  },
                  {
                    label: '出错',
                    value: result.errorCount,
                    className: 'text-danger',
                  },
                  {
                    label: '警告',
                    value: result.warningCount,
                    className: 'text-warning',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border bg-bg/40 px-3.5 py-3"
                  >
                    <p className={cn('text-xl font-semibold', stat.className)}>
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-bg/40 px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(event) => setSkipDuplicates(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--app-primary)]"
                />
                <span>
                  <span className="block text-[13px] font-medium">
                    跳过重复题
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                    题干和题型都相同的题目只会导入一次，包括题库中已有的题目。
                  </span>
                </span>
              </label>

              {result.issues.length > 0 && (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold">
                      校验结果
                      <span className="ml-1.5 font-normal text-muted">
                        {result.issues.length} 条
                      </span>
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          ['all', '全部'],
                          ['error', '错误'],
                          ['warning', '警告'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setIssueFilter(value)}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                            issueFilter === value
                              ? 'bg-primary-soft text-primary'
                              : 'text-muted hover:bg-surface-2',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          downloadIssuesCsv(result.issues, result.fileName)
                        }
                      >
                        <Download className="size-3.5" />
                        导出
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                    {filteredIssues.length === 0 ? (
                      <p className="px-3.5 py-4 text-center text-xs text-muted">
                        这一分类下没有问题。
                      </p>
                    ) : (
                      filteredIssues.map((issue, index) => (
                        <div
                          key={`${issue.row}-${issue.level}-${index}`}
                          className="flex items-start gap-2.5 px-3.5 py-2.5"
                        >
                          <IssueIcon level={issue.level} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] leading-5 text-fg">
                              {issue.row > 0 && (
                                <span className="mr-1.5 font-mono text-[11px] text-muted">
                                  第 {issue.row} 行
                                </span>
                              )}
                              {issue.message}
                            </p>
                            {issue.raw && (
                              <p className="mt-0.5 line-clamp-2 break-all text-[11px] leading-5 text-muted">
                                {issue.raw}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {parsedQuestions.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-[13px] font-semibold">
                    题目预览
                    <span className="ml-1.5 font-normal text-muted">
                      {parsedQuestions.length} 题
                    </span>
                  </h3>
                  <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {visibleQuestions.map((question) => (
                      <div
                        key={`${question.sourceRow}-${question.stem}`}
                        className="px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="primary">
                            {QUESTION_TYPE_LABELS[question.type]}
                          </Badge>
                          <span className="font-mono text-[10px] text-muted">
                            第 {question.sourceRow} 行
                          </span>
                          {question.chapter && (
                            <span className="text-[10px] text-muted">
                              {question.chapter}
                            </span>
                          )}
                          {question.duplicate && (
                            <Badge tone="warning">重复</Badge>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5">
                          {question.stem}
                        </p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted">
                          答案：
                          <span className="font-medium text-fg">
                            {answerSummary(question)}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                  {parsedQuestions.length > 6 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setPreviewExpanded((expanded) => !expanded)}
                    >
                      {previewExpanded
                        ? '收起预览'
                        : `显示更多（共 ${parsedQuestions.length} 题）`}
                    </Button>
                  )}
                  {previewExpanded && parsedQuestions.length > 100 && (
                    <p className="mt-1 text-[11px] text-muted">
                      仅预览前 100 道题，导入时会处理全部题目。
                    </p>
                  )}
                </div>
              )}

              {importError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-3 text-[12px] leading-5 text-danger">
                  <CircleX className="mt-0.5 size-4 shrink-0" />
                  <p>{importError}</p>
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-5 text-muted">
                  出错的行不会导入；可先导出校验结果，改好后重新上传。
                </p>
                <Button
                  size="lg"
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="sm:min-w-40"
                >
                  {importing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {importing ? '正在导入…' : `确认导入 ${importableCount} 题`}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">模板与格式</h2>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              推荐使用表格模板；TXT / Word 适合已经有现成文档的情况。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadTemplateCsv}
            >
              <Download className="size-3.5" />
              CSV 模板
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadTemplateTxt}
            >
              <Download className="size-3.5" />
              TXT 模板
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadTemplateXlsx}
              disabled={downloading === 'template'}
            >
              {downloading === 'template' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Excel 模板
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg/40 p-3.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              <p className="text-[13px] font-medium">Excel / CSV</p>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              第一行使用固定表头，一行一题，适合批量整理和修改。CSV
              建议使用 UTF-8 编码。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg/40 p-3.5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <p className="text-[13px] font-medium">TXT / Word</p>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              按题号分隔，自动识别【单选】等题型标记和“答案：”等字段。
              Word 支持 .docx，优先读取表格，其次读取正文。
            </p>
          </div>
        </div>

        <details className="group mt-4 rounded-xl border border-border bg-bg/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[13px] font-medium">
            表格列说明
            <span className="text-[11px] font-normal text-muted group-open:hidden">
              展开
            </span>
            <span className="hidden text-[11px] font-normal text-muted group-open:inline">
              收起
            </span>
          </summary>
          <div className="overflow-x-auto border-t border-border px-3.5 pb-3">
            <table className="w-full min-w-[560px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted">
                  <th className="pb-2 pt-2.5 pr-4 font-medium">列名</th>
                  <th className="pb-2 pt-2.5 pr-4 font-medium">必填</th>
                  <th className="pb-2 pt-2.5 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {columns.map(([name, required, description]) => (
                  <tr key={name} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-4 font-mono text-[11px] font-medium text-fg">
                      {name}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-[11px] text-muted">
                      {required}
                    </td>
                    <td className="py-2 leading-5 text-muted">
                      {description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div className="mt-4">
          <h3 className="text-[13px] font-semibold">TXT / Word 写法</h3>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg p-3.5 font-mono text-[11px] leading-6 text-fg">
{`1. 【单选】中国的首都是哪座城市？
A. 北京
B. 上海
C. 广州
D. 深圳
答案：A
解析：北京是中华人民共和国的首都。

2. 【判断】标准大气压下，水的沸点是 100°C。
答案：对`}
          </pre>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            题号可使用「1.」「1、」「（1）」；字段支持 答案 / 解析 / 章节 /
            难度 / 标签 / 关键词，写在题目末尾即可。也可以把同样内容做成 Word
            表格，表头与上表一致。
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {answerFormats.map((item) => (
            <div
              key={item.type}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg/40 px-3.5 py-2.5"
            >
              <span className="text-[12px] font-medium">{item.type}</span>
              <code className="rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg">
                {item.code}
              </code>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-primary-soft/60 px-3.5 py-3 text-[12px] leading-5 text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <p>
            填空题的多个空用中文分号「；」分隔，每个空的多个可接受答案用「|」分隔。
            例如两个空分别接受“北京/首都”和“中国”，写作{' '}
            <code className="font-mono text-fg">北京|首都；中国</code>。
            解析不理想时，可以先把文件内容粘贴到 TXT 模板中调整，再重新上传。
          </p>
        </div>
      </Card>
    </div>
  )
}
