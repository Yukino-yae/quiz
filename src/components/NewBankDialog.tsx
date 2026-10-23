import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createBank } from '@/db/bankRepository'
import type { Bank } from '@/types/quiz'

interface NewBankDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (bank: Bank) => void
}

export function NewBankDialog({
  open,
  onClose,
  onCreated,
}: NewBankDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setError('')
      formRef.current?.reset()
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '')
    const description = String(data.get('description') ?? '')

    setSubmitting(true)
    setError('')

    try {
      const bank = await createBank({ name, description })
      onCreated(bank)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="new-bank-title"
      className="m-auto w-[min(92vw,460px)] rounded-2xl border border-border bg-surface p-0 text-fg shadow-float"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-bank-title" className="text-lg font-semibold">
              新建题库
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              先建一个题库，之后可以导入题目或手动添加。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </div>

        <label
          htmlFor="bank-name"
          className="mt-5 block text-sm font-medium text-fg"
        >
          题库名称
        </label>
        <input
          id="bank-name"
          name="name"
          required
          maxLength={60}
          autoFocus
          placeholder="例如：计算机二级 · 公共基础"
          className="mt-2 h-11 w-full rounded-xl border border-border-strong bg-bg px-3 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary"
        />

        <label
          htmlFor="bank-description"
          className="mt-4 block text-sm font-medium text-fg"
        >
          简介 <span className="font-normal text-muted">（可选）</span>
        </label>
        <textarea
          id="bank-description"
          name="description"
          maxLength={200}
          rows={3}
          placeholder="这个题库用来准备什么？"
          className="mt-2 w-full resize-none rounded-xl border border-border-strong bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary"
        />

        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? '创建中…' : '创建题库'}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
