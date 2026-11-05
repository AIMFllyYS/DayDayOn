'use client'

import { usePetIdentity } from '@/features/agent/pet-binding'
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
import {
  buildRelativeMediaPath,
  consumePendingSmartCapture,
  saveSmartHistoryRecord,
  subscribePendingSmartCapture,
  type SmartHistoryRecord,
  type SmartInputMode,
} from '../smart-handoff'

/*
 * 智能打卡正式原子组件（对齐 Playbook /dev/playbook/smart-checkin 定稿规范）：
 * 1. SmartScannerLens：
 *    - 顶栏：左侧扫描状态指示 + 右侧操作按钮（智能上传模式显示「重新上传」，智能拍照模式显示「重新拍摄」）；
 *    - 视窗：四角取景框 + 真实上下往返移动的扫描光束（animate-scan-sweep）；
 *    - 底部 1、2、3 步骤栏：始终显示 1、2、3 序号图标，当前进行到哪一步，哪一步前面就转圈圈（loader 动画）。
 * 2. SmartModuleDetector：一行识别方向胶囊条（5 大板块同行排开，AI 自动高亮并带魔法扫光，点选秒切）。
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
      className="bg-surface-sunken grid w-full min-w-0 grid-cols-3 gap-1 overflow-hidden rounded-full p-1"
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
              'text-tiny flex h-8.5 min-w-0 items-center justify-center gap-1 rounded-full px-1.5 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none',
              active
                ? 'bg-surface text-primary-ink shadow-soft'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon name={tab.icon} size={13} lineOnly={active} className="shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface SmartModuleDetectorProps {
  selectedModule: Module
  magicHighlight?: boolean
  onSelectModule: (m: Module) => void
}

export function SmartModuleDetector({
  selectedModule,
  magicHighlight = false,
  onSelectModule,
}: SmartModuleDetectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="识别出的打卡方向"
      className="bg-surface-sunken animate-pop-in flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-full p-1"
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
              'text-tiny relative flex h-8.5 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full px-1 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none active:scale-95',
              active
                ? cn(softToneClass[m], 'shadow-soft font-bold')
                : 'text-muted hover:text-foreground',
            )}
          >
            {active && magicHighlight && (
              <span className="bg-sheen animate-shimmer pointer-events-none absolute inset-0" />
            )}
            <Icon name={moduleMeta[m].icon} size={13} className="relative shrink-0" />
            <span className="relative truncate">{moduleMeta[m].label}</span>
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
  mode?: SmartInputMode
  /** 已知打卡板块（在单板块打卡页内传入，全局页不传） */
  hintModule?: Module
  /** 已知目标 ID */
  goalId?: string
  /** 视觉主题色 */
  tone?: ModuleTone
  /** 开始扫描时的回调（通知父级展示「正在搜索哪个分区」懒加载动画） */
  onScanStart?: (mode: SmartInputMode) => void
  /** 识别成功后的回调 */
  onRecognized: (result: SmartRecognitionResult, savedRecord: SmartHistoryRecord) => void
  /** 识别失败/不识别时的回调 */
  onScanError?: (message: string) => void
  /** 不识别时用户点击「直接手动填写」的兜底回调 */
  onManualFallback?: () => void
}

export function SmartScannerLens({
  mode = 'smart-capture',
  hintModule,
  goalId,
  tone = 'exercise',
  onScanStart,
  onRecognized,
  onScanError,
  onManualFallback,
}: SmartScannerLensProps) {
  const recognize = useRecognizeSmart()
  const pet = usePetIdentity()
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const [activeMode, setActiveMode] = useState<SmartInputMode>(mode)
  const [preview, setPreview] = useState<{
    kind: 'image' | 'text'
    imageUrl?: string
    textSnippet?: string
    relativePath?: string
  } | null>(null)
  const [draft, setDraft] = useState<SmartRecognitionDraft | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [activeStepIdx, setActiveStepIdx] = useState<0 | 1 | 2>(0)

  const pendingPayload = useRef<{
    image?: Blob
    textContent?: string
    key: string
    fileName: string
    mediaKind: 'image' | 'text'
    mode: SmartInputMode
    relativeImagePath: string | null
    textSnippet: string | null
  } | null>(null)

  const processFileRef = useRef<(file: File, sourceMode: SmartInputMode) => Promise<void>>(
    async () => {},
  )

  useEffect(() => {
    return () => {
      if (preview?.imageUrl) URL.revokeObjectURL(preview.imageUrl)
    }
  }, [preview?.imageUrl])

  const isScanning = recognize.isPending

  // 扫描进行中时，动态推进 1 -> 2 -> 3 步骤序号，让当前进行的步骤前面转圈圈
  useEffect(() => {
    if (!isScanning) return
    const t1 = window.setTimeout(() => setActiveStepIdx(1), 700)
    const t2 = window.setTimeout(() => setActiveStepIdx(2), 1450)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isScanning])

  function runRecognition() {
    const payload = pendingPayload.current
    if (!payload) return
    setErrorText(null)
    setActiveStepIdx(0)
    onScanStart?.(payload.mode)
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
          const saved = saveSmartHistoryRecord({
            mode: payload.mode,
            mediaKind: payload.mediaKind,
            fileName: payload.fileName,
            relativeImagePath: payload.relativeImagePath,
            textSnippet: payload.textSnippet,
            result: res,
          })
          onRecognized(res, saved)
        },
        onError: (err) => {
          const msg = isApiError(err) ? errorMessage(err.body) : errorMessage({ code: 'INTERNAL' })
          setErrorText(msg)
          onScanError?.(msg)
          toast.error(msg)
        },
      },
    )
  }

  async function processFile(file: File, sourceMode: SmartInputMode) {
    setActiveMode(sourceMode)
    setErrorText(null)
    setDraft(null)
    setActiveStepIdx(0)
    const relPath = buildRelativeMediaPath(file.name, sourceMode)

    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file)
        const nextUrl = URL.createObjectURL(compressed.blob)
        setPreview((prev) => {
          if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
          return { kind: 'image', imageUrl: nextUrl, relativePath: relPath }
        })
        pendingPayload.current = {
          image: compressed.blob,
          key: newIdempotencyKey(),
          fileName: file.name,
          mediaKind: 'image',
          mode: sourceMode,
          relativeImagePath: relPath,
          textSnippet: null,
        }
        runRecognition()
      } catch (e) {
        const msg = e instanceof Error ? e.message : '这张图打不开，换一张或截个图试试'
        setErrorText(msg)
        onScanError?.(msg)
        toast.error(msg)
      }
      return
    }

    try {
      const raw = await file.text()
      const clean = extractCleanText(raw)
      if (!clean) {
        const msg = '文件内容为空或无法识别，请重新选择'
        setErrorText(msg)
        onScanError?.(msg)
        return
      }
      const snippet = clean.slice(0, 240)
      setPreview((prev) => {
        if (prev?.imageUrl) URL.revokeObjectURL(prev.imageUrl)
        return { kind: 'text', textSnippet: snippet, relativePath: relPath }
      })
      pendingPayload.current = {
        textContent: clean,
        key: newIdempotencyKey(),
        fileName: file.name,
        mediaKind: 'text',
        mode: sourceMode,
        relativeImagePath: relPath,
        textSnippet: snippet,
      }
      runRecognition()
    } catch {
      const msg = '读取文件失败，请重新选择 TXT / HTML 或图片文件'
      setErrorText(msg)
      onScanError?.(msg)
    }
  }

  useEffect(() => {
    processFileRef.current = processFile
  })

  // 承接从打卡弹层点击「智能拍照」或「智能上传」直接选完文件传过来的内存交接槽，挂载即刻进入识别态
  useEffect(() => {
    const consumeIfAny = () => {
      const captured = consumePendingSmartCapture()
      if (captured) {
        void processFileRef.current(captured.file, captured.mode)
      }
    }
    consumeIfAny()
    return subscribePendingSmartCapture(consumeIfAny)
  }, [])

  function handleCaptureFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void processFile(file, 'smart-capture')
  }

  function handleUploadFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void processFile(file, 'smart-upload')
  }

  function triggerPicker() {
    if (activeMode === 'smart-capture') {
      captureInputRef.current?.click()
    } else {
      uploadInputRef.current?.click()
    }
  }

  const steps: [string, string, string] = draft?.scanSteps ?? [
    preview
      ? '正在扫描上传的内容特征与关键数值…'
      : activeMode === 'smart-capture'
        ? '点击立即拍照开始智能扫描'
        : '点击上传图片或 TXT / HTML 文本附件',
    hintModule
      ? `自动提取「${moduleMeta[hintModule].label}」板块结构化字段`
      : '自动判别所属打卡方向并匹配进行中目标',
    '流式魔法填充至下方表单，确认核对后入库',
  ]

  const hasContent = Boolean(preview || draft || errorText)

  // 严格区分右上角按钮文案：
  // - 智能上传模式（smart-upload）：识别完或失败后显示「重新上传」
  // - 智能拍照模式（smart-capture）：识别完或失败后显示「重新拍摄」
  const actionButtonLabel = !hasContent
    ? activeMode === 'smart-upload'
      ? '上传文件'
      : '立即拍照'
    : activeMode === 'smart-upload'
      ? '重新上传'
      : '重新拍摄'

  return (
    <div className="border-border bg-surface shadow-soft flex w-full min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border p-3.5">
      <input
        ref={captureInputRef}
        type="file"
        accept={SMART_IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCaptureFileChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept={SMART_UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleUploadFileChange}
      />

      {/* 极简顶部栏：左状态 + 右唯一操作按钮 */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isScanning ? (
            <Icon
              name="loader"
              size={14}
              strokeWidth={2.5}
              className="animate-spin-slow text-primary shrink-0"
            />
          ) : (
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                draft ? 'bg-success' : errorText ? 'bg-warning' : 'bg-primary/60',
              )}
            />
          )}
          <span className="text-caption truncate font-bold">
            {isScanning
              ? `${pet.name}扫描镜识别中…`
              : draft
                ? '扫描识别完成'
                : errorText
                  ? '未能识别出有效打卡数据'
                  : activeMode === 'smart-capture'
                    ? `${pet.name}智能拍照扫描镜`
                    : `${pet.name}智能上传扫描镜`}
          </span>
        </div>
        <button
          type="button"
          disabled={isScanning}
          onClick={triggerPicker}
          className="text-primary-ink hover:bg-primary-soft/60 text-tiny inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors active:scale-95 disabled:opacity-50"
        >
          <Icon name={activeMode === 'smart-capture' ? 'camera' : 'sparkles'} size={13} />
          <span>{actionButtonLabel}</span>
        </button>
      </div>

      {/* 扫描镜主视窗（四角对焦角标 + 真实上下往返移动的扫描条 animate-scan-sweep） */}
      <div className="bg-surface-sunken border-border-strong relative min-h-40 min-w-0 overflow-hidden rounded-2xl border p-3.5">
        <span className="border-primary pointer-events-none absolute top-2 left-2 size-3.5 rounded-tl-md border-t-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute top-2 right-2 size-3.5 rounded-tr-md border-t-2 border-r-2" />
        <span className="border-primary pointer-events-none absolute bottom-2 left-2 size-3.5 rounded-bl-md border-b-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute right-2 bottom-2 size-3.5 rounded-br-md border-r-2 border-b-2" />

        {/* 上下往返扫描条 */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2 z-10 transition-opacity duration-(--dur-base)',
            isScanning ? 'animate-scan-sweep opacity-100' : 'top-1/2 opacity-0',
          )}
        >
          <div className="via-primary/25 h-8 w-full bg-gradient-to-b from-transparent to-transparent" />
          <div className="bg-primary -mt-4 h-0.5 w-full rounded-full shadow-sm" />
        </div>

        {preview?.kind === 'image' && preview.imageUrl ? (
          <div className="flex flex-col items-center justify-center gap-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- 内存压缩后的 Blob URL，不落盘 */}
            <img
              src={preview.imageUrl}
              alt="待识别图片预览"
              className="max-h-44 rounded-xl object-contain"
            />
            {preview.relativePath && (
              <span className="text-tiny text-subtle max-w-full truncate font-mono">
                {preview.relativePath}
              </span>
            )}
          </div>
        ) : preview?.kind === 'text' ? (
          <div className="bg-surface/90 border-border min-w-0 rounded-xl border p-3">
            <p className="text-tiny text-muted line-clamp-4 font-mono break-words whitespace-pre-wrap">
              {preview.textSnippet}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2.5 py-3 text-center">
            <IconTile
              icon={activeMode === 'smart-capture' ? 'camera' : moduleMeta[tone].icon}
              tone={tone}
              size="md"
            />
            <div className="space-y-0.5">
              <p className="text-caption font-bold">
                {activeMode === 'smart-capture'
                  ? '拍下餐盘、运动记录或睡眠截图'
                  : '上传图片或 TXT / HTML 学习与打卡记录'}
              </p>
              <p className="text-tiny text-muted">图片仅在内存压缩识别，只记录相对路径、不存原图</p>
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
                智能上传
              </Button>
            </div>
          </div>
        )}
      </div>

      {errorText && (
        <div
          role="alert"
          className="bg-warning-soft/65 border-warning/30 text-warning-ink flex flex-col gap-2 rounded-xl border px-3 py-2.5"
        >
          <p className="text-tiny font-medium">{errorText}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="soft"
              icon={activeMode === 'smart-capture' ? 'camera' : 'sparkles'}
              onClick={triggerPicker}
            >
              {activeMode === 'smart-upload' ? '重新上传' : '重新拍摄'}
            </Button>
            {onManualFallback && (
              <Button size="sm" variant="secondary" icon="edit" onClick={onManualFallback}>
                直接手动填写
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 下方实时 1、2、3 步骤轨迹：始终展示 1、2、3 序号图标，进行到哪一步哪一步前面就转圈圈 */}
      <ol className="bg-surface-sunken/60 flex min-w-0 flex-col gap-1.5 rounded-xl px-3 py-2">
        {steps.map((step, idx) => {
          const doneStep = Boolean(draft) || (isScanning && idx < activeStepIdx)
          const activeStep = isScanning && idx === activeStepIdx
          return (
            <li key={`${idx}-${step}`} className="flex min-w-0 items-center gap-2">
              {activeStep ? (
                <Icon
                  name="loader"
                  size={14}
                  strokeWidth={2.5}
                  className="animate-spin-slow text-primary shrink-0"
                />
              ) : doneStep ? (
                <Icon name="check" size={14} strokeWidth={2.5} className="text-success shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden />
              )}

              <span
                className={cn(
                  'font-display text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold transition-colors',
                  doneStep
                    ? 'bg-success-soft text-success-ink'
                    : activeStep
                      ? 'bg-primary-soft text-primary-ink ring-primary/30 ring-2'
                      : 'bg-surface text-subtle',
                )}
              >
                {idx + 1}
              </span>

              <span
                className={cn(
                  'text-tiny min-w-0 flex-1 truncate transition-colors',
                  activeStep
                    ? 'text-primary-ink font-semibold'
                    : doneStep
                      ? 'text-foreground font-semibold'
                      : 'text-muted',
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
