'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FileUIPart } from 'ai'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { newIdempotencyKey } from '@/lib/api/fetcher'
import { compressImage, ImageCompressError } from '@/lib/image/compress'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'

/*
 * Agent 输入框：
 * - 单行设计：左侧小拍摄按钮、中间输入文字、右侧小发送按钮。
 * - 默认展示 1 行（约 24px），超出后自动平滑扩展至最多 5 行（约 120px），再超出滚动。
 * - 「深度思考」按钮悬浮于输入框之上，AI 输出中自动隐藏。
 * - 图片走现有压缩管线（内存压缩 JPEG 发送，不落盘）；Enter 发送、Shift+Enter 换行。
 */

const TEXT_FILE_MAX = 50_000

interface Attachment {
  id: string
  kind: 'image' | 'text'
  label: string
  file?: FileUIPart
  text?: string
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

interface ComposerProps {
  variant?: 'panel' | 'fullscreen'
  className?: string
}

export function Composer({ variant = 'panel', className }: ComposerProps) {
  const { send, status } = useAgentChat()
  const { deepThink } = useAgentUiState()
  const ui = useAgentUi()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRowRef = useRef<HTMLDivElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

  // 输入框自适应：默认 1 行（约 24px），最多扩展至 5 行（约 120px），超出后滚动
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const scrollHeight = el.scrollHeight
    const minHeight = 24
    const maxHeight = 120
    const row = inputRowRef.current
    if (!input) {
      el.style.height = `${minHeight}px`
      el.style.overflowY = 'hidden'
      if (row) {
        row.classList.remove('items-end')
        row.classList.add('items-center')
      }
    } else {
      const targetHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      el.style.height = `${targetHeight}px`
      el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
      if (row) {
        if (targetHeight > minHeight + 4) {
          row.classList.remove('items-center')
          row.classList.add('items-end')
        } else {
          row.classList.remove('items-end')
          row.classList.add('items-center')
        }
      }
    }
  }, [input])

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return
    setAttachError(null)
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('image/')) {
          const { blob } = await compressImage(file)
          const url = await blobToDataUrl(blob)
          next.push({
            id: crypto.randomUUID(),
            kind: 'image',
            label: file.name || '图片',
            file: { type: 'file', mediaType: 'image/jpeg', url, filename: 'image.jpg' },
          })
        } else {
          const text = await file.text()
          next.push({
            id: crypto.randomUUID(),
            kind: 'text',
            label: file.name || '文本',
            text:
              text.length > TEXT_FILE_MAX
                ? `${text.slice(0, TEXT_FILE_MAX)}\n…（过长已截断）`
                : text,
          })
        }
      } catch (err) {
        setAttachError(err instanceof ImageCompressError ? err.message : '附件读取失败，换一个试试')
      }
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next])
  }

  function sendNow() {
    const text = input.trim()
    if ((!text && attachments.length === 0) || busy) return
    const textParts = attachments
      .filter((a): a is Attachment & { text: string } => a.kind === 'text' && a.text !== undefined)
      .map((a) => `【附件：${a.label}】\n${a.text}`)
    const files = attachments
      .filter(
        (a): a is Attachment & { file: FileUIPart } => a.kind === 'image' && a.file !== undefined,
      )
      .map((a) => a.file)
    const finalText = [text, ...textParts].filter(Boolean).join('\n\n')
    send(finalText, files.length > 0 ? files : undefined, {
      deepThink,
      idempotencyKey: newIdempotencyKey(),
    })
    setInput('')
    setAttachments([])
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendNow()
    }
  }

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,text/plain,text/markdown,.txt,.md,.csv"
        multiple
        hidden
        onChange={(e) => {
          void onPick(e.target.files)
          e.target.value = ''
        }}
      />

      {/* 悬浮在输入框之上的深度思考按钮：AI 输出时隐藏 */}
      {!busy && (
        <div className="flex items-center justify-start pl-1">
          <button
            type="button"
            aria-pressed={deepThink}
            onClick={() => ui.setDeepThink(!deepThink)}
            className={cn(
              'text-tiny shadow-soft flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md transition-all select-none',
              deepThink
                ? 'bg-primary-soft text-primary-ink border-primary/20 border font-semibold'
                : 'bg-surface/90 text-muted hover:text-foreground border-border hover:bg-surface border',
            )}
          >
            <Icon name="bulb" size={12} lineOnly />
            <span>深度思考</span>
          </button>
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="bg-surface-sunken text-tiny text-muted flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1"
            >
              <Icon name={a.kind === 'image' ? 'camera' : 'copy'} size={12} lineOnly />
              <span className="truncate">{a.label}</span>
              <button
                type="button"
                aria-label={`移除 ${a.label}`}
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
              >
                <Icon name="x" size={12} className="text-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {attachError && <p className="text-tiny text-danger-ink px-1">{attachError}</p>}

      {/* 单行输入框主体：左侧小拍摄按钮、中间输入文字、右侧小发送按钮 */}
      <div
        ref={inputRowRef}
        className="border-border bg-surface shadow-soft flex items-center gap-1.5 rounded-2xl border px-2 py-1"
      >
        <button
          type="button"
          aria-label="添加图片或文件"
          onClick={() => fileRef.current?.click()}
          className="text-muted hover:text-foreground hover:bg-surface-sunken flex size-7 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
        >
          <Icon name="camera" size={15} lineOnly />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          style={{ height: '24px' }}
          placeholder={
            variant === 'panel' ? '和团团说点什么…' : '和团团说点什么，比如「我今天跑了 3 公里」'
          }
          className="text-body text-foreground placeholder:text-subtle max-h-[7.5rem] min-h-[1.5rem] w-full min-w-0 flex-1 resize-none bg-transparent px-1 py-0 leading-6 outline-none"
        />

        <button
          type="button"
          aria-label="发送"
          onClick={sendNow}
          disabled={busy || (input.trim().length === 0 && attachments.length === 0)}
          className="bg-primary text-on-primary hover:bg-primary-hover flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm transition-[transform,background-color,opacity] duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon name="arrow" size={13} lineOnly />
        </button>
      </div>
    </div>
  )
}
