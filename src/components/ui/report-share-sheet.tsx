'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { softToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import {
  copyNativeShareImage,
  getNativeImageShareCapabilities,
  hasNativeBridge,
  saveNativeShareImage,
  shareNativeImage,
} from '@/lib/native'

/*
 * 原生报告图片分享弹层（含底部小 Dock 栏）：
 * - 默认渲染 16:9 横版手账跨页海报，支持一键切换 9:16 竖版；
 * - 底部拉出原生风格小 Dock 栏：
 *   - Android APK 壳（v0.1.12+ 原生桥接）：保存相册、复制图片、系统分享；
 *   - Android 旧版壳：零报错降级提示长按保存 + 兼容操作；
 *   - 网页端 / PWA：默认使用网页兼容方式（下载 PNG 主按钮，浏览器支持时附带复制图片 / 系统分享）。
 */

export type PosterOrientation = 'landscape' | 'portrait'

export interface GeneratedPosterAsset {
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

/** 将离屏 DOM 中的 <svg> 序列化为独立 data URL，自动解析内联 CSS 变量 */
export function serializeSvgElementToDataUrl(svgEl: SVGSVGElement | null): string | null {
  if (!svgEl || typeof window === 'undefined') return null
  try {
    const raw = new XMLSerializer().serializeToString(svgEl)
    const cs = window.getComputedStyle(document.documentElement)
    const resolved = raw.replace(/var\((--[a-zA-Z0-9-]+)\)/g, (_, name: string) => {
      const val = cs.getPropertyValue(name).trim()
      if (val) return val
      if (name === '--foreground') return '#4a3f35'
      if (name === '--surface') return '#fffdf9'
      if (name === '--border-strong') return '#dcc8b2'
      return '#4a3f35'
    })
    const withXmlns = resolved.includes('xmlns=')
      ? resolved
      : resolved.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withXmlns)}`
  } catch {
    return null
  }
}

export interface ReportShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 分享标题（用于系统分享标题与无障碍描述） */
  title: string
  /** 导出文件名（不含扩展名） */
  fileBaseName: string
  /** 可选离屏 SVG 节点（如当前陪伴宠物），组件自动序列化为 data URL 交给 renderPoster 绘入 Canvas */
  offscreenSvg?: ReactNode
  /** 当外部数据变化时触发重绘的键值 */
  renderKey?: string
  /** 海报渲染回调：收到比例与已解析的离屏 SVG dataUrl，返回 PNG 产物 */
  renderPoster: (opts: {
    orientation: PosterOrientation
    svgDataUrl: string | null
  }) => Promise<GeneratedPosterAsset>
}

interface DockAction {
  id: string
  label: string
  icon: IconName
  tone: Tone
  onClick: () => void | Promise<void>
}

interface EnvShareCapabilities {
  inNativeShell: boolean
  nativeSave: boolean
  nativeCopy: boolean
  nativeShare: boolean
  webCopy: boolean
  webShare: boolean
}

const DEFAULT_CAPS: EnvShareCapabilities = {
  inNativeShell: false,
  nativeSave: false,
  nativeCopy: false,
  nativeShare: false,
  webCopy: false,
  webShare: false,
}

let cachedCapsKey = ''
let cachedCaps: EnvShareCapabilities = DEFAULT_CAPS

function readEnvCaps(): EnvShareCapabilities {
  if (typeof window === 'undefined') return DEFAULT_CAPS
  const inNativeShell = hasNativeBridge()
  const nativeCaps = getNativeImageShareCapabilities()
  const webCopy =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.clipboard?.write) &&
    typeof ClipboardItem !== 'undefined'
  let webShare = false
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare === 'function') {
        const probe = new File([new Uint8Array([137, 80, 78, 71])], 'probe.png', {
          type: 'image/png',
        })
        webShare = navigator.canShare({ files: [probe] })
      }
    } catch {
      webShare = false
    }
  }
  const key = `${inNativeShell}-${nativeCaps.save}-${nativeCaps.copy}-${nativeCaps.share}-${webCopy}-${webShare}`
  if (key !== cachedCapsKey) {
    cachedCapsKey = key
    cachedCaps = {
      inNativeShell,
      nativeSave: nativeCaps.save,
      nativeCopy: nativeCaps.copy,
      nativeShare: nativeCaps.share,
      webCopy,
      webShare,
    }
  }
  return cachedCaps
}

export function ReportShareSheet({
  open,
  onOpenChange,
  title,
  fileBaseName,
  offscreenSvg,
  renderKey = '',
  renderPoster,
}: ReportShareSheetProps) {
  const [orientation, setOrientation] = useState<PosterOrientation>('landscape')
  const [renderState, setRenderState] = useState<{
    id: string
    asset: GeneratedPosterAsset | null
    error: string | null
  }>({ id: '', asset: null, error: null })
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const renderRef = useRef(renderPoster)
  useEffect(() => {
    renderRef.current = renderPoster
  })

  const caps = useSyncExternalStore(
    () => () => undefined,
    readEnvCaps,
    () => DEFAULT_CAPS,
  )

  const currentRenderId = `${orientation}:${renderKey}`
  const rendering = open && renderState.id !== currentRenderId
  const asset = renderState.id === currentRenderId ? renderState.asset : null
  const renderError = renderState.id === currentRenderId ? renderState.error : null

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      const svgEl = svgWrapRef.current?.querySelector('svg') ?? null
      const svgDataUrl = serializeSvgElementToDataUrl(svgEl)
      void renderRef
        .current({ orientation, svgDataUrl })
        .then((res) => {
          if (cancelled) return
          setRenderState({ id: currentRenderId, asset: res, error: null })
        })
        .catch(() => {
          if (cancelled) return
          setRenderState({ id: currentRenderId, asset: null, error: '海报生成失败，请重试' })
        })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [open, orientation, currentRenderId])

  const fileName = `${fileBaseName}-${orientation === 'landscape' ? '16x9' : '9x16'}.png`

  function triggerWebDownload(cur: GeneratedPosterAsset) {
    const url = URL.createObjectURL(cur.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    toast.success('PNG 报告图片已开始下载')
  }

  async function handleWebCopy(cur: GeneratedPosterAsset) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': cur.blob })])
      toast.success('报告图片已复制到剪贴板')
    } catch {
      toast.error('当前浏览器限制复制图片，已为你改为下载 PNG')
      triggerWebDownload(cur)
    }
  }

  async function handleWebShare(cur: GeneratedPosterAsset) {
    try {
      const file = new File([cur.blob], fileName, { type: 'image/png' })
      await navigator.share({ title, files: [file] })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      toast.error('系统分享未完成，已为你下载 PNG')
      triggerWebDownload(cur)
    }
  }

  async function runAction(id: string, fn: () => void | Promise<void>) {
    if (!asset || busyAction) return
    setBusyAction(id)
    try {
      await fn()
    } finally {
      setBusyAction(null)
    }
  }

  const actions: DockAction[] = []
  if (caps.inNativeShell && (caps.nativeSave || caps.nativeCopy || caps.nativeShare)) {
    if (caps.nativeSave) {
      actions.push({
        id: 'native-save',
        label: '保存相册',
        icon: 'download',
        tone: 'success',
        onClick: () =>
          runAction('native-save', () => {
            if (!asset) return
            const r = saveNativeShareImage(asset.dataUrl, fileName)
            if (r.ok) toast.success(r.message)
            else toast.error(r.message)
          }),
      })
    }
    if (caps.nativeCopy) {
      actions.push({
        id: 'native-copy',
        label: '复制图片',
        icon: 'copy',
        tone: 'primary',
        onClick: () =>
          runAction('native-copy', () => {
            if (!asset) return
            const r = copyNativeShareImage(asset.dataUrl, fileName)
            if (r.ok) toast.success(r.message)
            else toast.error(r.message)
          }),
      })
    }
    if (caps.nativeShare) {
      actions.push({
        id: 'native-share',
        label: '系统分享',
        icon: 'share',
        tone: 'diet',
        onClick: () =>
          runAction('native-share', () => {
            if (!asset) return
            const r = shareNativeImage(asset.dataUrl, fileName, title)
            if (!r.ok) toast.error(r.message)
          }),
      })
    }
  } else {
    // 网页端默认采用兼容方式：下载 PNG 为主，浏览器支持时附带复制图片与系统分享
    actions.push({
      id: 'web-download',
      label: '下载 PNG',
      icon: 'download',
      tone: 'primary',
      onClick: () =>
        runAction('web-download', () => {
          if (asset) triggerWebDownload(asset)
        }),
    })
    if (caps.webCopy && !caps.inNativeShell) {
      actions.push({
        id: 'web-copy',
        label: '复制图片',
        icon: 'copy',
        tone: 'success',
        onClick: () => runAction('web-copy', () => (asset ? handleWebCopy(asset) : undefined)),
      })
    }
    if (caps.webShare) {
      actions.push({
        id: 'web-share',
        label: '系统分享',
        icon: 'share',
        tone: 'diet',
        onClick: () => runAction('web-share', () => (asset ? handleWebShare(asset) : undefined)),
      })
    }
  }

  const isLegacyNativeShell =
    caps.inNativeShell && !caps.nativeSave && !caps.nativeCopy && !caps.nativeShare

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="分享分析报告"
      description="原生排版导出高清 PNG，附带 DayDayOn 推广二维码"
      footer={
        <div className="flex flex-col gap-2">
          {/* 底部原生风格小 Dock 栏 */}
          <div
            role="toolbar"
            aria-label="分享操作栏"
            className="border-border bg-surface-sunken/85 flex items-center justify-around gap-2 rounded-2xl border px-3 py-2.5"
          >
            {actions.map((act) => {
              const disabled = rendering || !asset || busyAction !== null
              return (
                <button
                  key={act.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void act.onClick()}
                  className={cn(
                    'ease-spring flex min-h-14 min-w-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 transition-all active:scale-95',
                    disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-surface/80',
                  )}
                >
                  <span
                    className={cn(
                      'shadow-soft grid size-11 place-items-center rounded-full',
                      softToneClass[act.tone],
                    )}
                  >
                    <Icon name={act.icon} size={20} />
                  </span>
                  <span className="text-tiny text-foreground font-semibold">{act.label}</span>
                </button>
              )
            })}
          </div>
          {isLegacyNativeShell && (
            <p className="text-tiny text-muted text-center">
              当前 App 壳版本较旧：可长按上方海报保存，更新至新版 App 可解锁一键存相册与系统分享
            </p>
          )}
        </div>
      }
    >
      {offscreenSvg && (
        <div
          ref={svgWrapRef}
          aria-hidden
          className="pointer-events-none fixed -top-[9999px] -left-[9999px] opacity-0"
        >
          {offscreenSvg}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-tiny text-muted font-semibold">海报比例</span>
          <SegmentedControl
            size="sm"
            label="海报比例"
            value={orientation}
            onValueChange={setOrientation}
            options={[
              { value: 'landscape', label: '横版 16:9' },
              { value: 'portrait', label: '竖版 9:16' },
            ]}
            className="w-48 shrink-0"
          />
        </div>

        {/* 海报预览画框 */}
        <div className="border-border bg-surface-sunken flex min-h-48 items-center justify-center overflow-hidden rounded-2xl border p-3">
          {rendering ? (
            <div className="flex w-full flex-col items-center gap-2 py-8">
              <Skeleton
                className={cn(
                  'rounded-xl',
                  orientation === 'landscape' ? 'aspect-video w-full' : 'aspect-[9/16] h-64',
                )}
              />
              <span className="text-tiny text-muted">正在绘制高清手账报告…</span>
            </div>
          ) : renderError ? (
            <p className="text-caption text-danger-ink py-10 text-center font-semibold">
              {renderError}
            </p>
          ) : asset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.dataUrl}
              alt={`${title} 报告海报预览`}
              className={cn(
                'shadow-card rounded-xl object-contain select-none',
                orientation === 'landscape'
                  ? 'max-h-[42vh] w-full'
                  : 'max-h-[40vh] w-auto md:max-h-[38vh]',
              )}
            />
          ) : null}
        </div>
      </div>
    </Sheet>
  )
}
