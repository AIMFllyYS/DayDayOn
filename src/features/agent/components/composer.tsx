'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FileUIPart } from 'ai'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { newIdempotencyKey } from '@/lib/api/fetcher'
import { compressImage, ImageCompressError, sniffIsImageFile } from '@/lib/image'
import { hasNativeSystemFilePicker, pickNativeSystemFiles } from '@/lib/native'
import { usePetIdentity } from '../pet-binding'
import { useAgentUi, useAgentUiState } from '../agent-store'
import { useAgentChat } from '../chat-context'

/*
 * Agent 输入框：
 * - 单行设计：左侧「上传图片或文件」按钮、中间自适应输入框、右侧发送/停止按钮。
 * - 双端统一直接调用系统原生文件管理器（<input type="file" multiple>），支持同时选择图片（最多 2 张）与 .txt/.md/.csv 文本附件，
 *   不再错误弹出纯相册组件 PhotoAlbumSheet。
 * - 选完图片后在输入框上方展示真实圆角缩略图（支持单张独立移除）；发送后在当次对话气泡内直接渲染预览（内存压缩，绝不落盘）。
 */

const TEXT_FILE_MAX = 50_000
const AGENT_FILE_ACCEPT = 'image/*,text/plain,text/markdown,text/csv,.txt,.md,.csv'

interface Attachment {
  id: string
  kind: 'image' | 'text'
  label: string
  previewUrl?: string
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
  const { send, stop, status } = useAgentChat()
  const { deepThink } = useAgentUiState()
  const ui = useAgentUi()
  const pet = usePetIdentity()
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

  async function onPick(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    setAttachError(null)
    const rawArray = Array.from(files)
    const imageFlags = await Promise.all(rawArray.map((f) => sniffIsImageFile(f)))
    const existingImageCount = attachments.filter((x) => x.kind === 'image').length
    const incomingImages = rawArray.filter((_, idx) => imageFlags[idx])
    if (existingImageCount + incomingImages.length > 2) {
      toast.info('单次对话最多同时附带 2 张图片～')
    }
    let imageQuota = Math.max(0, 2 - existingImageCount)
    const next: Attachment[] = []
    for (let i = 0; i < rawArray.length; i++) {
      const file = rawArray[i]!
      const isImg = Boolean(imageFlags[i])
      try {
        if (isImg) {
          if (imageQuota <= 0) continue
          imageQuota--
          const { blob } = await compressImage(file)
          const url = await blobToDataUrl(blob)
          next.push({
            id: crypto.randomUUID(),
            kind: 'image',
            label: file.name || '图片',
            previewUrl: url,
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
    if (next.length > 0) {
      setAttachments((prev) => {
        const merged = [...prev, ...next]
        const imgs = merged.filter((x) => x.kind === 'image').slice(0, 2)
        const texts = merged.filter((x) => x.kind !== 'image')
        return [...imgs, ...texts]
      })
    }
  }

  function handleAttachButtonClick() {
    if (busy) return
    if (hasNativeSystemFilePicker()) {
      void pickNativeSystemFiles(AGENT_FILE_ACCEPT, 9).then((picked) => {
        if (picked === null) {
          fileRef.current?.click()
          return
        }
        if (picked.length > 0) {
          void onPick(picked)
        }
      })
      return
    }
    fileRef.current?.click()
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

  const imageAtts = attachments.filter((a) => a.kind === 'image')
  const textAtts = attachments.filter((a) => a.kind !== 'image')

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      <input
        ref={fileRef}
        type="file"
        accept={AGENT_FILE_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const picked = e.target.files ? Array.from(e.target.files) : []
          e.target.value = ''
          void onPick(picked)
        }}
      />

      {/* 悬浮在输入框之上的深度思考按钮：AI 输出时透明隐藏但保持高度，避免消息区跳动 */}
      <div
        aria-hidden={busy || undefined}
        className={cn(
          'flex items-center justify-start pl-1 transition-opacity duration-(--dur-fast)',
          busy && 'pointer-events-none opacity-0',
        )}
      >
        <button
          type="button"
          tabIndex={busy ? -1 : 0}
          aria-pressed={deepThink}
          onClick={() => ui.setDeepThink(!deepThink)}
          className={cn(
            'text-tiny shadow-soft pointer-events-auto flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md transition-all select-none',
            deepThink
              ? 'bg-primary-soft text-primary-ink border-primary/20 border font-semibold'
              : 'bg-surface/90 text-muted hover:text-foreground border-border hover:bg-surface border',
          )}
        >
          <Icon name="bulb" size={12} lineOnly />
          <span>深度思考</span>
        </button>
      </div>

      {(imageAtts.length > 0 || textAtts.length > 0) && (
        <ul className="pointer-events-auto flex flex-wrap items-center gap-2 px-1">
          {imageAtts.map((img) => (
            <li key={img.id} className="relative">
              <div className="border-border bg-surface-sunken shadow-soft size-12 overflow-hidden rounded-xl border">
                {img.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- 待发送内存压缩图片缩略图
                  <img src={img.previewUrl} alt={img.label} className="size-full object-cover" />
                )}
              </div>
              <button
                type="button"
                aria-label={`移除图片 ${img.label}`}
                onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== img.id))}
                className="bg-foreground/80 text-on-primary absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full shadow-xs transition-transform active:scale-90"
              >
                <Icon name="x" size={10} lineOnly />
              </button>
            </li>
          ))}
          {textAtts.map((a) => (
            <li
              key={a.id}
              className="bg-surface-sunken text-tiny text-muted flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1"
            >
              <Icon name="copy" size={12} lineOnly />
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
      {attachError && (
        <p className="text-tiny text-danger-ink pointer-events-auto px-1">{attachError}</p>
      )}

      {/* 单行输入框主体：左侧原生文件管理上传按钮、中间文字输入、右侧发送按钮 */}
      <div
        ref={inputRowRef}
        className="border-border bg-surface shadow-soft pointer-events-auto flex items-center gap-1.5 rounded-2xl border px-2 py-1"
      >
        <button
          type="button"
          aria-label="上传图片或文件"
          disabled={busy}
          onClick={handleAttachButtonClick}
          className="text-muted hover:text-foreground hover:bg-surface-sunken flex size-7 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 disabled:opacity-40"
        >
          <Icon name="plus" size={16} lineOnly />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          style={{ height: '24px' }}
          placeholder={
            variant === 'panel'
              ? `和${pet.name}说点什么，或点左侧传图…`
              : `和${pet.name}说点什么，或上传餐盘/运动照片…`
          }
          className="text-body text-foreground placeholder:text-subtle max-h-[7.5rem] min-h-[1.5rem] w-full min-w-0 flex-1 resize-none bg-transparent px-1 py-0 leading-6 outline-none"
        />

        {busy ? (
          <button
            type="button"
            aria-label="停止生成"
            onClick={() => stop()}
            className="bg-surface-sunken text-foreground hover:bg-border flex size-7 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95"
          >
            <Icon name="square" size={11} lineOnly />
          </button>
        ) : (
          <button
            type="button"
            aria-label="发送"
            onClick={sendNow}
            disabled={input.trim().length === 0 && attachments.length === 0}
            className="bg-primary text-on-primary hover:bg-primary-hover flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm transition-[transform,background-color,opacity] duration-150 ease-out active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <Icon name="arrow" size={13} lineOnly />
          </button>
        )}
      </div>
    </div>
  )
}
