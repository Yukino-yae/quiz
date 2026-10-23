import { Plus, Trash2, X } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Button } from '@/components/ui/Button'
import {
  createQuestion,
  updateQuestion,
} from '@/db/questionRepository'
import {
  OPTION_KEYS,
  splitKeywords,
} from '@/lib/questionText'
import { cn } from '@/lib/cn'
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from '@/lib/labels'
import type {
  Difficulty,
  Question,
  QuestionInput,
  QuestionType,
} from '@/types/quiz'

interface QuestionEditorDialogProps {
  open: boolean
  bankId: string
  question: Question | null
  onClose: () => void
}

const TYPE_OPTIONS: QuestionType[] = [
  'single',
  'multiple',
  'judge',
  'fill',
  'short',
]

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary'

const textareaClass =
  'w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-sm leading-6 text-fg outline-none transition-colors placeholder:text-muted/70 focus:border-primary'

interface EditorState {
  type: QuestionType
  stem: string
  options: string[]
  selected: string[]
  groups: string[]
  referenceAnswer: string
  keywords: string
  explanation: string
  chapter: string
  difficulty: Difficulty
  tags: string
}

function emptyState(): EditorState {
  return {
    type: 'single',
    stem: '',
    options: ['', '', '', ''],
    selected: [],
    groups: [''],
    referenceAnswer: '',
    keywords: '',
    explanation: '',
    chapter: '',
    difficulty: 2,
    tags: '',
  }
}

function stateFromQuestion(question: Question): EditorState {
  const options = question.options.map((option) => option.text)
  const selected =
    question.type === 'judge'
      ? question.answer.slice(0, 1)
      : question.answer
          .map((key) => {
            const index = question.options.findIndex(
              (option) => option.key === key,
            )
            return index >= 0 ? OPTION_KEYS[index] : null
          })
          .filter((key): key is string => Boolean(key))

  return {
    type: question.type,
    stem: question.stem,
    options:
      question.type === 'single' || question.type === 'multiple'
        ? options.length >= 2
          ? options
          : [...options, '', '', '', ''].slice(0, 4)
        : ['', '', '', ''],
    selected,
    groups:
      question.answerGroups.length > 0
        ? question.answerGroups.map((group) => group.join('|'))
        : [''],
    referenceAnswer: question.referenceAnswer,
    keywords: question.keywords.join('|'),
    explanation: question.explanation,
    chapter: question.chapter,
    difficulty: question.difficulty,
    tags: question.tags.join(','),
  }
}

function countBlanks(stem: string): number {
  return (stem.match(/_{2,}|＿{2,}/g) ?? []).length
}

export function QuestionEditorDialog({
  open,
  bankId,
  question,
  onClose,
}: QuestionEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<EditorState>(emptyState)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      setState(question ? stateFromQuestion(question) : emptyState())
      setError('')
      setSubmitting(false)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, question])

  const patch = (values: Partial<EditorState>) => {
    setState((current) => ({ ...current, ...values }))
  }

  const changeType = (type: QuestionType) => {
    setError('')
    setState((current) => {
      if (type === 'judge') {
        const selected =
          current.selected[0] === 'true' || current.selected[0] === 'false'
            ? current.selected.slice(0, 1)
            : ['true']
        return { ...current, type, selected }
      }
      if (type === 'single' || type === 'multiple') {
        const selected = current.selected.filter((key) =>
          OPTION_KEYS.includes(key),
        )
        return { ...current, type, selected }
      }
      return { ...current, type }
    })
  }

  const setOptionText = (index: number, value: string) => {
    setState((current) => ({
      ...current,
      options: current.options.map((text, itemIndex) =>
        itemIndex === index ? value : text,
      ),
    }))
  }

  const selectChoice = (key: string) => {
    setState((current) => {
      if (current.type === 'single') return { ...current, selected: [key] }
      if (current.type !== 'multiple') return current
      return {
        ...current,
        selected: current.selected.includes(key)
          ? current.selected.filter((item) => item !== key)
          : [...current.selected, key].sort(),
      }
    })
  }

  const addOption = () => {
    setState((current) =>
      current.options.length >= OPTION_KEYS.length
        ? current
        : { ...current, options: [...current.options, ''] },
    )
  }

  const removeOption = (index: number) => {
    setState((current) => {
      if (current.options.length <= 2) return current
      const options = current.options.filter((_, itemIndex) => itemIndex !== index)
      const selected = current.selected
        .map((key) => {
          const position = OPTION_KEYS.indexOf(key)
          if (position === index) return null
          return position > index
            ? OPTION_KEYS[position - 1]
            : OPTION_KEYS[position]
        })
        .filter((key): key is string => Boolean(key))
      return { ...current, options, selected }
    })
  }

  const setGroup = (index: number, value: string) => {
    setState((current) => ({
      ...current,
      groups: current.groups.map((group, itemIndex) =>
        itemIndex === index ? value : group,
      ),
    }))
  }

  const buildInput = (): QuestionInput | string => {
    const stem = state.stem.trim()
    if (!stem) return '请填写题干'

    const base = {
      stem,
      explanation: state.explanation.trim(),
      chapter: state.chapter.trim(),
      difficulty: state.difficulty,
      tags: splitKeywords(state.tags),
    }

    if (state.type === 'single' || state.type === 'multiple') {
      const texts = state.options.map((text) => text.trim())
      const firstEmpty = texts.findIndex((text) => !text)
      if (texts.length < 2) return '选择题至少需要两个选项'
      if (firstEmpty !== -1) {
        return `选项 ${OPTION_KEYS[firstEmpty]} 不能为空`
      }

      const answer = state.selected.filter((key) =>
        OPTION_KEYS.slice(0, texts.length).includes(key),
      )
      if (answer.length === 0) {
        return state.type === 'single' ? '请选择一个正确答案' : '请选择正确答案'
      }
      if (state.type === 'single' && answer.length > 1) {
        return '单选题只能有一个正确答案'
      }

      return {
        ...base,
        type: state.type,
        options: texts.map((text, index) => ({
          key: OPTION_KEYS[index],
          text,
        })),
        answer,
        answerGroups: [],
        referenceAnswer: '',
        keywords: [],
      }
    }

    if (state.type === 'judge') {
      const value = state.selected[0]
      if (value !== 'true' && value !== 'false') {
        return '请选择判断题答案'
      }
      return {
        ...base,
        type: 'judge',
        options: [],
        answer: [value],
        answerGroups: [],
        referenceAnswer: '',
        keywords: [],
      }
    }

    if (state.type === 'fill') {
      const groups = state.groups.map((group) =>
        group
          .split(/[|｜]/)
          .map((value) => value.trim())
          .filter(Boolean),
      )
      if (groups.some((group) => group.length === 0)) {
        return '每个空至少填写一个可接受答案'
      }
      return {
        ...base,
        type: 'fill',
        options: [],
        answer: [],
        answerGroups: groups,
        referenceAnswer: '',
        keywords: [],
      }
    }

    const referenceAnswer = state.referenceAnswer.trim()
    if (!referenceAnswer) return '请填写简答题的参考答案'

    return {
      ...base,
      type: 'short',
      options: [],
      answer: [],
      answerGroups: [],
      referenceAnswer,
      keywords: splitKeywords(state.keywords),
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = buildInput()
    if (typeof input === 'string') {
      setError(input)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (question) {
        await updateQuestion(question.id, input)
      } else {
        await createQuestion(bankId, input)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
      setSubmitting(false)
    }
  }

  const isChoice = state.type === 'single' || state.type === 'multiple'
  const blankCount = countBlanks(state.stem)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="question-editor-title"
      className="m-auto max-h-[90vh] w-[min(94vw,720px)] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-fg shadow-float"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="question-editor-title" className="text-lg font-semibold">
              {question ? '编辑题目' : '添加题目'}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              答案会在练习时用于判分，解析可留空。
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium">题型</span>
            <div className="grid grid-cols-5 gap-1.5">
              {TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={state.type === type}
                  onClick={() => changeType(type)}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-[12px] font-medium transition-colors',
                    state.type === type
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border bg-bg/50 text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {QUESTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">
              题干
              {state.type === 'fill' && (
                <span className="ml-1.5 font-normal text-muted">
                  用 ____ 表示空
                </span>
              )}
            </span>
            <textarea
              value={state.stem}
              onChange={(event) => patch({ stem: event.target.value })}
              rows={3}
              required
              placeholder="输入题目内容"
              className={textareaClass}
            />
            {state.type === 'fill' && (
              <span className="mt-1 block text-[11px] text-muted">
                当前题干检测到 {blankCount} 个空
              </span>
            )}
          </label>

          {isChoice && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium">
                  选项
                  <span className="ml-1.5 font-normal text-muted">
                    勾选正确答案
                  </span>
                </span>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={state.options.length >= OPTION_KEYS.length}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-primary disabled:opacity-50"
                >
                  <Plus className="size-3.5" />
                  加选项
                </button>
              </div>
              <div className="space-y-2">
                {state.options.map((text, index) => {
                  const key = OPTION_KEYS[index]
                  const checked = state.selected.includes(key)
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="flex shrink-0 cursor-pointer items-center gap-2">
                        <input
                          type={state.type === 'single' ? 'radio' : 'checkbox'}
                          name="choice-answer"
                          checked={checked}
                          onChange={() => selectChoice(key)}
                          className="size-4 accent-[var(--app-primary)]"
                        />
                        <span className="w-4 text-[13px] font-semibold text-muted">
                          {key}
                        </span>
                      </label>
                      <input
                        value={text}
                        onChange={(event) =>
                          setOptionText(index, event.target.value)
                        }
                        placeholder={`选项 ${key}`}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={state.options.length <= 2}
                        aria-label={`删除选项 ${key}`}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {state.type === 'judge' && (
            <div>
              <span className="mb-1.5 block text-[13px] font-medium">
                正确答案
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['true', '对'],
                  ['false', '错'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={state.selected[0] === value}
                    onClick={() => patch({ selected: [value] })}
                    className={cn(
                      'rounded-xl border py-2.5 text-sm font-medium transition-colors',
                      state.selected[0] === value
                        ? 'border-primary bg-primary-soft text-primary'
                        : 'border-border bg-bg/50 text-fg hover:bg-surface-2',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.type === 'fill' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[13px] font-medium">
                  答案
                  <span className="ml-1.5 font-normal text-muted">
                    每个空一行，多个写法用 | 分隔
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    patch({ groups: [...state.groups, ''] })
                  }
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
                >
                  <Plus className="size-3.5" />
                  加空
                </button>
              </div>
              <div className="space-y-2">
                {state.groups.map((group, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[12px] text-muted">
                      第 {index + 1} 空
                    </span>
                    <input
                      value={group}
                      onChange={(event) =>
                        setGroup(index, event.target.value)
                      }
                      placeholder="例如：北京|首都"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          groups: state.groups.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                      disabled={state.groups.length <= 1}
                      aria-label={`删除第 ${index + 1} 空`}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              {blankCount !== state.groups.length && (
                <p className="mt-1.5 text-[11px] text-warning">
                  题干有 {blankCount} 个空，答案有 {state.groups.length} 组。
                  数量不一致也可以保存，但练习时按顺序匹配。
                </p>
              )}
            </div>
          )}

          {state.type === 'short' && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium">
                  参考答案
                </span>
                <textarea
                  value={state.referenceAnswer}
                  onChange={(event) =>
                    patch({ referenceAnswer: event.target.value })
                  }
                  rows={4}
                  placeholder="填写参考答案，作答后展示"
                  className={textareaClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-medium">
                  关键词
                  <span className="ml-1.5 font-normal text-muted">
                    选填，用于自动判分；留空则自评
                  </span>
                </span>
                <input
                  value={state.keywords}
                  onChange={(event) =>
                    patch({ keywords: event.target.value })
                  }
                  placeholder="用逗号或 | 分隔，例如：光能|有机物|氧气"
                  className={inputClass}
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium">
              解析
              <span className="ml-1.5 font-normal text-muted">选填</span>
            </span>
            <textarea
              value={state.explanation}
              onChange={(event) =>
                patch({ explanation: event.target.value })
              }
              rows={2}
              placeholder="作答后展示的解题思路"
              className={textareaClass}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                章节
              </span>
              <input
                value={state.chapter}
                onChange={(event) => patch({ chapter: event.target.value })}
                placeholder="例如：第一章"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                难度
              </span>
              <select
                value={state.difficulty}
                onChange={(event) =>
                  patch({
                    difficulty: Number(event.target.value) as Difficulty,
                  })
                }
                className={inputClass}
              >
                {([1, 2, 3] as Difficulty[]).map((value) => (
                  <option key={value} value={value}>
                    {DIFFICULTY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                标签
              </span>
              <input
                value={state.tags}
                onChange={(event) => patch({ tags: event.target.value })}
                placeholder="用逗号分隔"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3.5">
          {error && (
            <p className="mb-2 text-[12px] text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '保存中…' : question ? '保存修改' : '添加题目'}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  )
}
