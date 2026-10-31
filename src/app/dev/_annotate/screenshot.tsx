'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/*
 * 截图批注：用浏览器的"共享标签页"拿到当前页面的真实画面，再按用户框选的区域裁剪。
 * 不引入 html2canvas 一类的 DOM 重绘库：它们对 color-mix、backdrop-filter 等新 CSS 支持不全，截出来和真实页面不一样。
 * 代价是每次截图浏览器都会询问一次共享哪个标签页（选"当前标签页"）。
 * 截图只存在本机浏览器里，随批注导出；这是开发者自己的界面截图，和用户上传的图片无关。
 */

export interface Region {
  x: number
  y: number
  w: number
  h: number
}

/** 截图最长边上限（像素），控制 localStorage 占用 */
const MAX_SIDE = 1600

type DisplayMediaOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean
  selfBrowserSurface?: 'include' | 'exclude'
}

/** 请求共享当前标签页。用户取消或浏览器不支持时抛错 */
export async function startTabCapture(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('当前浏览器不支持页面截图')
  const options: DisplayMediaOptions = {
    video: { displaySurface: 'browser', frameRate: 30 },
    audio: false,
    // Chrome 会优先提供"当前标签页"
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  }
  return navigator.mediaDevices.getDisplayMedia(options)
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))

/**
 * 从共享流里取一帧并裁剪。调用前必须先把选框和批注工具都隐藏，
 * 这里再等两帧 + 250ms，让隐藏后的画面传到共享流里。
 */
export async function captureRegion(stream: MediaStream, region: Region): Promise<string> {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  try {
    await video.play()
    await nextFrame()
    await nextFrame()
    await wait(250)
    // 共享画面的分辨率 ≈ 视口 × DPR；按实际比例换算，兼容浏览器自动缩放
    const sx = video.videoWidth / window.innerWidth
    const sy = video.videoHeight / window.innerHeight
    const srcW = region.w * sx
    const srcH = region.h * sy
    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(srcW * scale))
    canvas.height = Math.max(1, Math.round(srcH * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.drawImage(
      video,
      region.x * sx,
      region.y * sy,
      srcW,
      srcH,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    const webp = canvas.toDataURL('image/webp', 0.85)
    // Safari 不支持导出 WebP 时会退回 PNG，改用 JPEG 控制体积
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    stream.getTracks().forEach((t) => t.stop())
    video.srcObject = null
  }
}

/** 全屏框选层：拖出一个矩形，松手确认；Esc 或右键取消 */
export function RegionSelector({
  onSelect,
  onCancel,
}: {
  onSelect: (region: Region) => void
  onCancel: () => void
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<Region | null>(null)
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    layer.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const toRect = (a: { x: number; y: number }, b: { x: number; y: number }): Region => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  })

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return onCancel()
    e.currentTarget.setPointerCapture(e.pointerId)
    setStart({ x: e.clientX, y: e.clientY })
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (start) setRect(toRect(start, { x: e.clientX, y: e.clientY }))
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start) return
    const r = toRect(start, { x: e.clientX, y: e.clientY })
    setStart(null)
    // 太小的框当作误触，重新框
    if (r.w < 12 || r.h < 12) {
      setRect(null)
      return
    }
    onSelect(r)
  }

  return (
    <div
      ref={layer}
      data-annotator-ui=""
      tabIndex={-1}
      role="dialog"
      aria-label="框选截图区域"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onContextMenu={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="fixed inset-0 z-[2147483603] cursor-crosshair touch-none outline-none select-none"
      style={{ background: rect ? 'transparent' : 'rgb(74 63 53 / 0.35)' }}
    >
      {rect ? (
        // 选框外的区域用超大阴影压暗
        <div
          className="border-primary pointer-events-none absolute rounded-sm border-2"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            boxShadow: '0 0 0 9999px rgb(74 63 53 / 0.35)',
          }}
        >
          <span className="bg-foreground text-tiny text-surface absolute -top-7 left-0 rounded-md px-1.5 py-0.5 font-mono whitespace-nowrap">
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </span>
        </div>
      ) : (
        <p className="bg-foreground text-caption text-surface shadow-float pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 font-semibold">
          拖动鼠标框选要截图的区域 · Esc 取消
        </p>
      )}
    </div>
  )
}
