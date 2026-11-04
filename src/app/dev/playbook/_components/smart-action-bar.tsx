'use client'

import { useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Icon, type IconName } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'

/*
 * 打卡弹层底部双栏智能入口（Playbook 先行定稿组件）：
 * 将原先单一且仅绑定饮食板块的「拍照记一餐」拆分为左右并列的两个原子操作：
 *   - 左按钮：智能拍照（调起相机/拍照，交由智能识别页扫描并自动判别板块）
 *   - 右按钮：智能上传（支持相册图片 + TXT / HTML / MD / CSV 纯文本附件上传分析）
 *
 * 配色原则（遵守 ui-design-system.md 第 2 节）：
 * 1. 严禁使用深色系（如实底 bg-primary）：弹层上方已有 5 个彩色板块图标 + 2 个指标图标，
 *    底部若放两个深色实底胶囊会造成头轻脚重、视觉压迫。
 * 2. 提供三套浅色手账系方案供评审比对：
 *    - duo-warm（推荐默认 · 微差暖调）：左 bg-primary-soft（主题奶茶浅底）+ 右 bg-surface-sunken（燕麦暖纸浅底），
 *      同属高明度浅色系，靠约 6% 的暖色饱和度微差自然区分「直接拍」与「传文件」。
 *    - twin-soft（同色对称）：左右均使用 bg-primary-soft + text-primary-ink，对称克制。
 *    - soft-outline（奶油描边）：左 bg-primary-soft + 右 bg-surface 带暖棕描边，右侧像一张贴纸小卡。
 */

export type SmartActionScheme = 'duo-warm' | 'twin-soft' | 'soft-outline'

export const SMART_IMAGE_ACCEPT = 'image/*'
export const SMART_UPLOAD_ACCEPT =
  'image/*,text/plain,text/html,text/markdown,text/csv,.txt,.html,.htm,.md,.csv'

// 在 Playbook 内跨组件共享当前选中的配色方案，默认采用负责人拍板的方案 C（soft-outline 奶油描边）
let currentScheme: SmartActionScheme = 'soft-outline'
const schemeListeners = new Set<() => void>()

export function setPlaybookSmartScheme(next: SmartActionScheme) {
  if (currentScheme === next) return
  currentScheme = next
  schemeListeners.forEach((l) => l())
}

export function usePlaybookSmartScheme(): SmartActionScheme {
  return useSyncExternalStore(
    (listener) => {
      schemeListeners.add(listener)
      return () => schemeListeners.delete(listener)
    },
    () => currentScheme,
    () => 'soft-outline',
  )
}

const pillBaseClass =
  'text-caption sm:text-body inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 font-semibold select-none ' +
  'transition-[transform,background-color,filter,border-color,box-shadow] duration-(--dur-fast) ease-spring ' +
  'active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50'

const schemeClass: Record<SmartActionScheme, { left: string; right: string; rightIcon: string }> = {
  'duo-warm': {
    left: 'bg-primary-soft text-primary-ink border border-primary/12 hover:brightness-[0.97]',
    right:
      'bg-surface-sunken text-foreground border border-border hover:bg-primary-soft/55 hover:text-primary-ink',
    rightIcon: 'text-primary-ink',
  },
  'twin-soft': {
    left: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
    right: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
    rightIcon: 'text-primary-ink',
  },
  'soft-outline': {
    left: 'bg-primary-soft text-primary-ink hover:brightness-[0.97]',
    right:
      'bg-surface text-primary-ink border border-border-strong shadow-soft hover:bg-surface-sunken',
    rightIcon: 'text-primary-ink',
  },
}

export interface SmartActionBarProps {
  captureLabel?: string
  uploadLabel?: string
  captureIcon?: IconName
  uploadIcon?: IconName
  scheme?: SmartActionScheme
  disabled?: boolean
  /** 是否接管原生文件选择框（默认 false，点击直接回调 onCapture / onUpload 跳往智能识别页或打开选件） */
  enableFileInputs?: boolean
  onCapture?: (file?: File) => void
  onUpload?: (files?: FileList) => void
  className?: string
}

export function SmartActionBar({
  captureLabel = '智能拍照',
  uploadLabel = '智能上传',
  captureIcon = 'camera',
  uploadIcon = 'sparkles',
  scheme,
  disabled = false,
  enableFileInputs = false,
  onCapture,
  onUpload,
  className,
}: SmartActionBarProps) {
  const inheritedScheme = usePlaybookSmartScheme()
  const activeScheme = scheme ?? inheritedScheme
  const styles = schemeClass[activeScheme]
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  function handleCaptureChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onCapture?.(file)
  }

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      onUpload?.(files)
    }
    e.target.value = ''
  }

  return (
    <div
      className={cn('grid w-full grid-cols-2 gap-2.5', className)}
      data-scheme={activeScheme}
      role="group"
      aria-label="智能打卡快捷操作"
    >
      {enableFileInputs && (
        <>
          <input
            ref={captureInputRef}
            type="file"
            accept={SMART_IMAGE_ACCEPT}
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleCaptureChange}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept={SMART_UPLOAD_ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleUploadChange}
          />
        </>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (enableFileInputs) {
            captureInputRef.current?.click()
          } else {
            onCapture?.()
          }
        }}
        className={cn(pillBaseClass, styles.left)}
      >
        <Icon name={captureIcon} size={20} className="shrink-0" />
        <span className="truncate">{captureLabel}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (enableFileInputs) {
            uploadInputRef.current?.click()
          } else {
            onUpload?.()
          }
        }}
        className={cn(pillBaseClass, styles.right)}
      >
        <Icon name={uploadIcon} size={20} className={cn('shrink-0', styles.rightIcon)} />
        <span className="truncate">{uploadLabel}</span>
      </button>
    </div>
  )
}

const schemeDescriptions: {
  id: SmartActionScheme
  title: string
  badge: string
  leftToken: string
  rightToken: string
  rationale: string
}[] = [
  {
    id: 'duo-warm',
    title: '方案 A · 微差暖调（默认推荐）',
    badge: '微差双浅色',
    leftToken: 'bg-primary-soft + text-primary-ink',
    rightToken: 'bg-surface-sunken + text-foreground + border-border',
    rationale:
      '左右同属 90%+ 明度的手账暖纸色系，杜绝深色实底的厚重压迫感。左侧「智能拍照」多约 6% 的奶茶焦糖暖度，右侧「智能上传」退为燕麦纸凹陷色，无需深色就能一眼区分左拍右传，且自动适配全站 5 套主题色。',
  },
  {
    id: 'twin-soft',
    title: '方案 B · 同色温润（完全一致）',
    badge: '同色双胶囊',
    leftToken: 'bg-primary-soft + text-primary-ink',
    rightToken: 'bg-primary-soft + text-primary-ink',
    rationale:
      '延续原单按钮「拍照记一餐」的 soft 浅底配色，一分为二后左右颜色完全一致，依靠相机与闪光图标区分语义，视觉秩序最纯粹对称。',
  },
  {
    id: 'soft-outline',
    title: '方案 C · 奶油描边（主次轻分）',
    badge: '浅底 + 纸面描边',
    leftToken: 'bg-primary-soft + text-primary-ink',
    rightToken: 'bg-surface + border-border-strong + shadow-soft',
    rationale:
      '左按钮保持主题浅色底，右按钮采用奶油白卡片底配暖棕描边，右侧像一张轻轻贴在底栏上的手账便签，对比度比方案 A 略鲜明一点。',
  },
]

export function SmartActionBarShowcase() {
  const activeScheme = usePlaybookSmartScheme()
  const [pickedSummary, setPickedSummary] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-caption font-semibold">切换打卡弹层底栏配色方案：</span>
          <Badge tone="primary">同步生效于下方「打开打卡弹层」</Badge>
        </div>
        <SegmentedControl
          size="sm"
          label="智能底栏配色方案"
          value={activeScheme}
          onValueChange={setPlaybookSmartScheme}
          options={[
            { value: 'duo-warm', label: 'A 微差暖调' },
            { value: 'twin-soft', label: 'B 同色温润' },
            { value: 'soft-outline', label: 'C 奶油描边' },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {schemeDescriptions.map((item) => {
          const selected = item.id === activeScheme
          return (
            <div
              key={item.id}
              data-ann={`playbook.components.smart-action-bar.${item.id}`}
              className={cn(
                'bg-surface flex flex-col justify-between gap-3 rounded-2xl border p-4 transition-all duration-(--dur-fast)',
                selected ? 'border-primary shadow-card' : 'border-border shadow-soft',
              )}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold">{item.title}</span>
                  <Badge tone={selected ? 'primary' : 'neutral'} dot={selected}>
                    {selected ? '当前预览' : item.badge}
                  </Badge>
                </div>
                <p className="text-tiny text-muted leading-relaxed">{item.rationale}</p>
                <div className="bg-surface-sunken/70 text-tiny text-muted mt-1 flex flex-col gap-0.5 rounded-xl px-2.5 py-1.5 font-mono">
                  <span>左：{item.leftToken}</span>
                  <span>右：{item.rightToken}</span>
                </div>
              </div>

              {/* 模拟 Sheet 底部栏环境 */}
              <div className="border-border bg-surface rounded-2xl border p-3">
                <p className="text-tiny text-subtle mb-2 text-center">
                  Sheet Footer 预览（360px 手机底栏比例）
                </p>
                <SmartActionBar
                  scheme={item.id}
                  enableFileInputs
                  onCapture={(file) => {
                    setPlaybookSmartScheme(item.id)
                    const msg = file
                      ? `已拍照/选图「${file.name}」，即将进入智能识别扫描镜`
                      : '触发智能拍照'
                    setPickedSummary(msg)
                    toast.info(msg)
                  }}
                  onUpload={(files) => {
                    setPlaybookSmartScheme(item.id)
                    const names = files
                      ? Array.from(files)
                          .map((f) => f.name)
                          .join('、')
                      : ''
                    const msg = names
                      ? `已上传附件「${names}」（支持图片 / HTML / TXT），即将进入智能识别扫描镜`
                      : '触发智能上传'
                    setPickedSummary(msg)
                    toast.info(msg)
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {pickedSummary && (
        <div
          role="status"
          className="border-primary/20 bg-primary-soft/50 text-primary-ink text-caption flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2"
        >
          <span className="flex items-center gap-2">
            <Icon name="sparkles" size={16} />
            <span>{pickedSummary}</span>
          </span>
          <button
            type="button"
            className="text-tiny underline"
            onClick={() => setPickedSummary(null)}
          >
            知道了
          </button>
        </div>
      )}
    </div>
  )
}
