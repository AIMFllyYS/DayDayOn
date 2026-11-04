'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import { moduleMeta, moduleTones, softToneClass, type ModuleTone } from '@/components/ui/tone'
import {
  SMART_TEXT_MAX_CHARS,
  type SmartRecognitionDraft,
  type SmartRecognitionResult,
} from '@/features/checkin/smart-schemas'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, newIdempotencyKey } from '@/lib/api'
import { useRecognizeSmart } from '@/lib/api/queries/ai'
import { cn } from '@/lib/cn'
import { compressImage } from '@/lib/image'

/*
 * 智能打卡正式原子组件（对齐 Playbook /dev/playbook/smart-checkin 定稿规范）：
 * 1. SmartScannerLens：极简顶栏（左状态 + 右「重新扫描」），四角取景框与呼吸扫描光束，底部 3 步实时识别轨迹；
 *    支持拍照/图片（内存压缩为 JPEG，绝不落盘）与纯文本附件（HTML/TXT/MD/CSV 提纯正文）。
 * 2. SmartModuleDetector：一行识别方向胶囊条（5 大板块同行排开，AI 自动高亮，点选秒切）。
 * 3. CheckinModeTabs：全板块统一的「手动填写 | 智能拍照 | 智能上传」三态 Tab 栏。
 */

export type CheckinInputMode = 'manual' | 'smart-capture' | 'smart-upload'

export const SMART_IMAGE_ACCEPT = 'image/*'
export const SMART_UPLOAD_ACCEPT =
  'image/*,text/plain,text/html,text/markdown,text/csv,.txt,.html,.htm,.md,.csv'

const modeTabOptions: { value: CheckinInputMode; label: string; icon: IconName }[] = [
  { value: 'manual', label: '手动填写', icon: 'edit' },
  { value: 'smart-capture', label: '智能拍照', icon: 'camera' },
  { value: 'smart-upload', label: '智能上传', icon: 'sparkles' },
]

export function CheckinModeTabs({
  value,
  onValueChange,
}: {
  value: CheckinInputMode
  onValueChange: (next: CheckinInputMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="打卡记录方式"
      className="bg-surface-sunken grid grid-cols-3 gap-1 rounded-full p-1"
    >
      {modeTabOptions.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              'text-caption flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-1.5 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none',
              active
                ? 'bg-surface text-primary-ink shadow-soft'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon name={tab.icon} size={14} lineOnly={active} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface SmartModuleDetectorProps {
  selectedModule: Module
  onSelectModule: (m: Module) => void
}

export function SmartModuleDetector({ selectedModule, onSelectModule }: SmartModuleDetectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="识别出的打卡方向"
      className="bg-surface-sunken flex min-w-0 items-center gap-1 rounded-full p-1"
    >
      {moduleTones.map((m) => {
        const active = m === selectedModule
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelectModule(m)}
            className={cn(
              'text-tiny flex h-9 flex-1 items-center justify-center gap-1 rounded-full px-1.5 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none active:scale-95',
              active
                ? cn(softToneClass[m], 'shadow-soft font-bold')
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon name={moduleMeta[m].icon} size={13} className="shrink-0" />
            <span>{moduleMeta[m].label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 提纯 HTML / TXT / MD 文本内容，去掉脚本样式与标签 */
export function extractCleanText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SMART_TEXT_MAX_CHARS)
}

export interface SmartScannerLensProps {
  /** 当前输入模式：拍照优先或通用上传优先 */
  mode?: 'smart-capture' | 'smart-upload'
  /** 已知打卡板块（在单板块打卡页内传入，全局页不传） */
  hintModule?: Module
  /** 已知目标 ID */
  goalId?: string
  /** 视觉主题色 */
  tone?: ModuleTone
  /** 识别成功后的回调 */
  onRecognized: (result: SmartRecognitionResult) => void
}

export function SmartScannerLens({
  mode = 'smart-capture',
  hintModule,
  goalId,
  tone = 'exercise',
  onRecognized,
}: SmartScannerLensProps) {
  const recognize = useRecognizeSmart()
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<{
    kind: 'image' | 'text'
    imageUrl?: string
    textSnippet?: string
  } | null>(null)
  const [draft, setDraft] = useState<SmartRecognitionDraft | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const pendingPayload = useRef<{
    image?: Blob
    textContent?: string
    key: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (preview?.imageUrl) URL.revokeObjectURL(preview.imageUrl)
    }
  }, [preview?.imageUrl])

  function runRecognition() {
    const payload = pendingPayload.current
    if (!payload) return
    setErrorText(null)
    recognize.mutate(
      {
        image: payload.image,
        textContent: payload.textContent,
        hintModule,
        goalId,
        idempotencyKey: payload.key,
      },
      {
        onSuccess: (res) => {
          setDraft(res.draft)
          onRecognized(res)
        },
        onError: (err) => {
          const msg = isApiError(err) ? errorMessage(err.body) : errorMessage({ code: 'INTERNAL' })
          setErrorText(msg)
          toast.error(msg)
        },
      },
    )
  }

  async function processFile(file: File) {
    setErrorText(null)
    setDraft(null)
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file)
        const nextUrl = URL.createObjectURL(compressed.blob)
        setPreview((prev) => {
          if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
          return { kind: 'image', imageUrl: nextUrl }
        })
        pendingPayload.current = { image: compressed.blob, key: newIdempotencyKey() }
        runRecognition()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '这张图打不开，换一张或截个图试试'
        setErrorText(msg)
        toast.error(msg)
      }
      return
    }

    try {
      const raw = await file.text()
      const clean = extractCleanText(raw)
      if (!clean) {
        setErrorText('文件内容为空，换个文件试试吧')
        return
      }
      setPreview((prev) => {
        if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
        return { kind: 'text', textSnippet: clean.slice(0, 240) }
      })
      pendingPayload.current = { textContent: clean, key: newIdempotencyKey() }
      runRecognition()
    } catch {
      setErrorText('读取文件失败，请上传 TXT / HTML 或图片文件')
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void processFile(file)
  }

  function triggerPicker() {
    if (mode === 'smart-capture') {
      captureInputRef.current?.click()
    } else {
      uploadInputRef.current?.click()
    }
  }

  const isScanning = recognize.isPending
  const steps: [string, string, string] = draft?.scanSteps ?? [
    preview
      ? '正在扫描上传的内容特征与关键数值…'
      : mode === 'smart-capture'
        ? '点击取景框拍照或选择图片开始扫描'
        : '点击上传图片或 TXT / HTML 文本附件',
    hintModule
      ? `自动提取「${moduleMeta[hintModule].label}」板块结构化字段`
      : '自动判别所属打卡方向并匹配进行中目标',
    '填充至下方表单，确认核对后入库',
  ]

  return (
    <div className="border-border bg-surface shadow-soft flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border p-3.5">
      <input
        ref={captureInputRef}
        type="file"
        accept={SMART_IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleFileChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept={SMART_UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleFileChange}
      />

      {/* 极简顶部栏：左状态 + 右唯一「重新扫描」按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              isScanning
                ? 'bg-primary animate-pulse'
                : draft
                  ? 'bg-success'
                  : errorText
                    ? 'bg-danger'
                    : 'bg-primary/60',
            )}
          />
          <span className="text-caption truncate font-bold">
            {isScanning
              ? '团团扫描镜识别中…'
              : draft
                ? '扫描识别完成'
                : errorText
                  ? '扫描遇到一点小问题'
                  : mode === 'smart-capture'
                    ? '团团智能拍照扫描镜'
                    : '团团智能上传扫描镜'}
          </span>
        </div>
        <button
          type="button"
          disabled={isScanning}
          onClick={() => {
            if (pendingPayload.current && errorText) {
              pendingPayload.current = { ...pendingPayload.current, key: newIdempotencyKey() }
              runRecognition()
            } else {
              triggerPicker()
            }
          }}
          className="text-primary-ink hover:bg-primary-soft/60 text-tiny inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors active:scale-95 disabled:opacity-50"
        >
          <Icon name="sparkles" size={13} />
          <span>{preview ? '重新扫描' : '选择文件'}</span>
        </button>
      </div>

      {/* 扫描镜主视窗（四角对焦角标 + 呼吸扫描光束） */}
      <div className="bg-surface-sunken border-border-strong relative min-w-0 overflow-hidden rounded-2xl border p-3.5">
        <span className="border-primary pointer-events-none absolute top-2 left-2 size-3.5 rounded-tl-md border-t-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute top-2 right-2 size-3.5 rounded-tr-md border-t-2 border-r-2" />
        <span className="border-primary pointer-events-none absolute bottom-2 left-2 size-3.5 rounded-bl-md border-b-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute right-2 bottom-2 size-3.5 rounded-br-md border-r-2 border-b-2" />

        {/* 扫描光束 */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2 z-10 transition-all duration-(--dur-slow)',
            isScanning ? 'animate-pulse opacity-100' : 'opacity-0',
          )}
          style={{ top: isScanning ? '36%' : '90%' }}
        >
          <div className="bg-primary h-0.5 w-full rounded-full shadow-sm" />
          <div className="from-primary/25 h-9 w-full bg-gradient-to-b to-transparent" />
        </div>

        {preview?.kind === 'image' && preview.imageUrl ? (
          <div className="flex flex-col items-center gap-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- 内存压缩后的 Blob URL，不落盘 */}
            <img
              src={preview.imageUrl}
              alt="待识别图片预览"
              className="max-h-44 rounded-xl object-contain"
            />
          </div>
        ) : preview?.kind === 'text' ? (
          <div className="bg-surface/90 border-border min-w-0 rounded-xl border p-3">
            <p className="text-tiny text-muted line-clamp-3 font-mono break-words whitespace-pre-wrap">
              {preview.textSnippet}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 py-4 text-center">
            <IconTile
              icon={mode === 'smart-capture' ? 'camera' : moduleMeta[tone].icon}
              tone={tone}
              size="md"
            />
            <div className="space-y-0.5">
              <p className="text-caption font-bold">
                {mode === 'smart-capture'
                  ? '拍下餐盘、运动记录或睡眠截图'
                  : '上传图片或 TXT / HTML 学习与打卡记录'}
              </p>
              <p className="text-tiny text-muted">图片仅在内存压缩识别，绝不落盘保存</p>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button
                variant="soft"
                size="sm"
                icon="camera"
                onClick={() => captureInputRef.current?.click()}
              >
                智能拍照
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="sparkles"
                onClick={() => uploadInputRef.current?.click()}
              >
                上传图片 / 文本
              </Button>
            </div>
          </div>
        )}
      </div>

      {errorText && (
        <div
          role="alert"
          className="bg-danger-soft text-danger-ink text-tiny flex items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium"
        >
          <span className="min-w-0 flex-1">{errorText}</span>
          <button type="button" onClick={triggerPicker} className="shrink-0 font-bold underline">
            换一个试试
          </button>
        </div>
      )}

      {/* 下方实时 3 步分析轨迹 */}
      <ol className="bg-surface-sunken/60 grid gap-1.5 rounded-xl px-3 py-2">
        {steps.map((step, idx) => {
          const doneStep = Boolean(draft) || (isScanning && idx === 0)
          const activeStep = isScanning && idx === 1
          return (
            <li key={`${idx}-${step}`} className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'font-display text-tiny flex size-4.5 shrink-0 items-center justify-center rounded-full font-semibold',
                  doneStep
                    ? 'bg-success-soft text-success-ink'
                    : activeStep
                      ? 'bg-primary-soft text-primary-ink animate-breathe'
                      : 'bg-surface text-subtle',
                )}
              >
                {doneStep ? '✓' : idx + 1}
              </span>
              <span
                className={cn(
                  'text-tiny min-w-0 flex-1 truncate',
                  doneStep ? 'text-foreground font-semibold' : 'text-muted',
                )}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
