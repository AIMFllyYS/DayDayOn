'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '@/lib/cn'
import {
  isNativeApp,
  listNativeAlbumPhotos,
  requestNativePermission,
  resolveAlbumPhotoToFile,
  type NativeAlbumPhotoItem,
} from '@/lib/native'
import { Button } from './button'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { toast } from './toast'

/*
 * 微信风自定义多选相册组件（PhotoAlbumSheet）：
 * - 默认最多可选 9 张（maxSelect = 9）；
 * - 每张照片右上角带圆形选择框，点选后按先后顺序展示「1、2、3…」序号角标，取消某张后后续序号自动重排；
 * - 顶栏右上角提供「取消选择」按钮，一键清空当前已选图片；
 * - 安卓壳内优先请求相册权限并加载原生 MediaStore 缩略图列表，同时支持从系统文件选择器导入多张本地图片进入网格挑选；
 * - 严守 ADR-0002：所有缩略图与选中的 File 仅存在于客户端内存，绝不落服务端磁盘。
 */

interface AlbumGridItem {
  id: string
  fileName: string
  previewUrl: string
  createdAt: string
  /** 本地导入的真实 File；若来自原生相册则在点击「完成」时按 item 异步转成 File */
  file?: File
  nativeItem?: NativeAlbumPhotoItem
}

export interface PhotoAlbumSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 默认支持最多选 9 张（与微信相册一致） */
  maxSelect?: number
  /** 业务侧实际消费的上限提示（如识别接口一次最多上传 2 张时，可在副标题温和提示） */
  hintText?: string
  onConfirm: (files: File[]) => void
}

/** 生成内置轻量 SVG 演示图（供网页端或空相册快速体验微信式 1..9 顺序多选） */
function createSampleAlbumFile(
  title: string,
  subtitle: string,
  bgHex: string,
  accentHex: string,
  fileName: string,
): { file: File; previewUrl: string } {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
    <rect width="480" height="480" rx="36" fill="${bgHex}"/>
    <circle cx="380" cy="110" r="56" fill="${accentHex}" opacity="0.28"/>
    <circle cx="120" cy="360" r="72" fill="${accentHex}" opacity="0.18"/>
    <text x="44" y="230" font-family="sans-serif" font-size="34" font-weight="bold" fill="#2c2623">${title}</text>
    <text x="44" y="280" font-family="sans-serif" font-size="22" fill="#6e655f">${subtitle}</text>
  </svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const file = new File([blob], fileName, { type: 'image/svg+xml' })
  const previewUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  return { file, previewUrl }
}

function buildDefaultItems(): AlbumGridItem[] {
  const presets = [
    {
      id: 'sample-1',
      title: '减脂午餐便当',
      subtitle: '番茄炒蛋 + 杂粮饭 425 kcal',
      bg: '#FFF4EC',
      accent: '#F28B50',
      fileName: 'lunch_bento_01.jpg',
    },
    {
      id: 'sample-2',
      title: '傍晚慢跑 5km',
      subtitle: '配速 5:42 · 运动轨迹截图',
      bg: '#EEF8F3',
      accent: '#3FA67A',
      fileName: 'evening_run_02.jpg',
    },
    {
      id: 'sample-3',
      title: '早餐全麦三明治',
      subtitle: '无糖豆浆 + 水煮蛋 310 kcal',
      bg: '#FFF9EB',
      accent: '#E5A93C',
      fileName: 'breakfast_toast_03.jpg',
    },
    {
      id: 'sample-4',
      title: '睡眠监测报告',
      subtitle: '23:15 入睡 · 07:10 醒来',
      bg: '#F2F0FC',
      accent: '#7A6AD8',
      fileName: 'sleep_report_04.jpg',
    },
  ]
  return presets.map((p, idx) => {
    const { file, previewUrl } = createSampleAlbumFile(
      p.title,
      p.subtitle,
      p.bg,
      p.accent,
      p.fileName,
    )
    return {
      id: p.id,
      fileName: p.fileName,
      previewUrl,
      createdAt: new Date(Date.now() - idx * 3600_000).toISOString(),
      file,
    }
  })
}

export function PhotoAlbumSheet({
  open,
  onOpenChange,
  maxSelect = 9,
  hintText,
  onConfirm,
}: PhotoAlbumSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const [items, setItems] = useState<AlbumGridItem[]>(() => buildDefaultItems())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loadingNative, setLoadingNative] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      for (const u of urls) URL.revokeObjectURL(u)
    }
  }, [])

  // 打开相册时：读取手机相册或内置演示相册缩略图
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadNative() {
      setLoadingNative(true)
      try {
        if (isNativeApp()) {
          const perm = await requestNativePermission('photos')
          if (perm !== 'granted') {
            toast.error('需要开启「相册与媒体」权限才能读取手机相册', {
              description: '也可在「我的 → 权限管理」中开启',
            })
            return
          }
        }
        const nativeList: NativeAlbumPhotoItem[] = await listNativeAlbumPhotos(36)
        if (cancelled || nativeList.length === 0) return
        const mapped: AlbumGridItem[] = nativeList.map((n) => ({
          id: `native:${n.id}`,
          fileName: n.name || `photo_${n.id}.jpg`,
          previewUrl: n.previewUrl,
          createdAt: n.createdAt,
          nativeItem: n,
        }))
        setItems((prev) => {
          const localOnly = prev.filter((x) => !x.nativeItem && x.id.startsWith('local-'))
          return [...localOnly, ...mapped]
        })
      } finally {
        if (!cancelled) setLoadingNative(false)
      }
    }
    void loadNative()
    return () => {
      cancelled = true
    }
  }, [open])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const existingIdx = prev.indexOf(id)
      if (existingIdx !== -1) {
        return prev.filter((item) => item !== id)
      }
      if (prev.length >= maxSelect) {
        toast.info(`最多只能选择 ${maxSelect} 张照片`)
        return prev
      }
      return [...prev, id]
    })
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function handleLocalFilesImport(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    e.target.value = ''
    if (!fileList || fileList.length === 0) return

    const imported: AlbumGridItem[] = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      imported.push({
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name || 'album_photo.jpg',
        previewUrl: url,
        createdAt: new Date(file.lastModified || Date.now()).toISOString(),
        file,
      })
    }
    if (imported.length === 0) return

    setItems((prev) => [...imported, ...prev])
    setSelectedIds((prev) => {
      const next = [...prev]
      for (const item of imported) {
        if (next.length < maxSelect) {
          next.push(item.id)
        }
      }
      return next
    })
  }

  async function handleConfirm() {
    if (selectedIds.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const resolvedFiles: File[] = []
      for (const id of selectedIds) {
        const item = items.find((x) => x.id === id)
        if (!item) continue
        if (item.file) {
          resolvedFiles.push(item.file)
        } else if (item.nativeItem) {
          const f = await resolveAlbumPhotoToFile(item.nativeItem)
          if (f) resolvedFiles.push(f)
        }
      }
      if (resolvedFiles.length === 0) {
        toast.error('未读取到所选照片，请重试')
        return
      }
      onConfirm(resolvedFiles)
      setSelectedIds([])
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="选择照片"
      description={
        hintText ?? `点击右上角圆圈可按顺序多选（最多 ${maxSelect} 张），再次点击可取消重排`
      }
      headerActions={
        selectedIds.length > 0 ? (
          <button
            type="button"
            onClick={clearSelection}
            className="text-primary-ink hover:bg-primary-soft/60 text-caption mr-1 rounded-full px-2.5 py-1 font-semibold transition-colors"
          >
            取消选择
          </button>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              onClick={() => fileInputRef.current?.click()}
            >
              从设备选图
            </Button>
            <span className="text-tiny text-muted truncate tabular-nums">
              已选 {selectedIds.length} / {maxSelect} 张
            </span>
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={selectedIds.length === 0 || submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting
              ? '读取中…'
              : selectedIds.length > 0
                ? `完成 (${selectedIds.length})`
                : '完成'}
          </Button>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleLocalFilesImport}
      />

      {loadingNative && (
        <div className="text-muted text-tiny mb-2.5 flex items-center gap-1.5">
          <Icon name="loader" size={14} className="animate-spin-slow text-primary" />
          <span>正在同步手机相册照片…</span>
        </div>
      )}

      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label="相册照片网格"
        className="grid grid-cols-3 gap-2 pt-1"
      >
        {items.map((item) => {
          const orderIndex = selectedIds.indexOf(item.id)
          const selected = orderIndex !== -1
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={selected}
              onClick={() => toggleSelect(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleSelect(item.id)
                }
              }}
              tabIndex={0}
              className={cn(
                'bg-surface-sunken border-border group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border transition-all select-none',
                selected && 'ring-primary ring-2',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 相册内存缩略图预览，不落盘 */}
              <img
                src={item.previewUrl}
                alt={item.fileName}
                className={cn(
                  'size-full object-cover transition-transform duration-150',
                  selected && 'scale-[0.96]',
                )}
              />

              {/* 选中时的半透明遮罩 */}
              {selected && (
                <div className="bg-foreground/15 pointer-events-none absolute inset-0" />
              )}

              {/* 右上角圆形序号选择器（1, 2, 3...） */}
              <span
                aria-label={selected ? `已选第 ${orderIndex + 1} 张` : '点击选择'}
                className={cn(
                  'font-display text-tiny absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border-2 font-bold shadow-sm transition-transform',
                  selected
                    ? 'bg-primary border-primary text-on-primary scale-105'
                    : 'bg-foreground/30 border-surface text-transparent group-hover:scale-105',
                )}
              >
                {selected ? orderIndex + 1 : ''}
              </span>

              {/* 底部文件名小条 */}
              <div className="from-foreground/55 pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent px-2 py-1">
                <p className="text-on-primary text-tiny truncate font-mono">{item.fileName}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
