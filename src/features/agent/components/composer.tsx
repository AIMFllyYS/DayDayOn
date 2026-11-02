'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import type { FileUIPart } from 'ai'
import { IconButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { newIdempotencyKey } from '@/lib/api/fetcher'
import { compressImage, ImageCompressError } from '@/lib/image/compress'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'

/*
 * Agent 输入框：文字 + 图片/文本附件 + 深度思考开关。
 * 图片走现有压缩管线（内存里压成 JPEG，作为 file part 发送，不落盘）；文本文件在浏览器读成文字。
 * Enter 发送、Shift+Enter 换行；16px 字号避免 iOS 聚焦放大。
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

export function Composer({ className }: { className?: string }) {
  const { send, status } = useAgentChat()
  const { deepThink } = useAgentUiState()
  const ui = useAgentUi()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = status === 'submitted' || status === 'streaming'

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
    <div
      className={cn(
        'border-border bg-surface flex flex-col gap-2 rounded-2xl border p-2.5',
        className,
      )}
    >
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
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

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="和团团说点什么，比如「我今天跑了 3 公里」"
        className="text-body text-foreground placeholder:text-subtle max-h-32 min-h-6 w-full resize-none bg-transparent px-1 outline-none"
      />

      <div className="flex items-center gap-1">
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
        <IconButton
          icon="camera"
          label="添加图片或文件"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
        />
        <button
          type="button"
          aria-pressed={deepThink}
          onClick={() => ui.setDeepThink(!deepThink)}
          className={cn(
            'text-tiny flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-colors',
            deepThink
              ? 'bg-primary-soft text-primary-ink font-semibold'
              : 'text-muted hover:bg-surface-sunken',
          )}
        >
          <Icon name="bulb" size={13} lineOnly />
          深度思考
        </button>
        <span className="flex-1" />
        <IconButton
          icon="arrow"
          label="发送"
          onClick={sendNow}
          disabled={busy || (input.trim().length === 0 && attachments.length === 0)}
          className="bg-primary text-on-primary disabled:opacity-40"
        />
      </div>
    </div>
  )
}
