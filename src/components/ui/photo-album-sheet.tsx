'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '@/lib/cn'
import {
  isNativeApp,
  listNativeAlbumPhotosPage,
  requestNativePermission,
  reselectNativePhotos,
  resolveAlbumPhotoToFile,
  type NativeAlbumPhotoItem,
} from '@/lib/native'
import { Button } from './button'
import { EmptyState } from './empty-state'
import { Icon } from './icon'
import { Sheet } from './sheet'
import { Skeleton } from './skeleton'
import { toast } from './toast'

/*
 * 安卓客户端专属 · 流式缩略图无限下滑多选相册（PhotoAlbumSheet）：
 * - 仅在安卓客户端（isNativeApp()）内打开（Playbook 可通过 demoItems 显式注入演示卡片，正式生产代码零假图）；
 * - 性能优化核心：
 *   1. 首屏及每次触底仅查询 MediaStore 分页元数据（PAGE_SIZE = 30，耗时 < 5ms），弹窗动画 0 卡顿；
 *   2. 缩略图统一走 `/__native__/media/thumb/{id}`（系统硬件 loadThumbnail + LruCache）配合 `<img loading="lazy" decoding="async">`；
 *   3. 底部挂载 IntersectionObserver 哨兵，下滑接近底部时自动无感续拉下一页，支持数千张照片无限顺滑浏览；
 * - 支持 1..maxSelect 顺序角标点选与重排、一键取消选择、Android 14+ 部分照片授权增选与可选文档附件导入。
 */

const PAGE_SIZE = 30

export interface AlbumGridItem {
  id: string
  fileName: string
  previewUrl: string
  createdAt: string
  /** 本地导入或 Playbook 演示的真实 File；若来自原生相册则在点击「完成」时按需读取 */
  file?: File
  nativeItem?: NativeAlbumPhotoItem
}

export interface PhotoAlbumSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 默认支持最多选 9 张 */
  maxSelect?: number
  /** 业务侧实际消费的上限提示 */
  hintText?: string
  /** 可选系统文件导入 accept（如智能上传需支持 TXT/HTML 附件时传入） */
  fileAccept?: string
  /** 仅限 /dev/playbook 演示显式注入，正式环境严禁传假图 */
  demoItems?: readonly AlbumGridItem[]
  onConfirm: (files: File[]) => void
}

function mapNativeItems(list: readonly NativeAlbumPhotoItem[]): AlbumGridItem[] {
  return list.map((n) => ({
    id: `native:${n.id}`,
    fileName: n.name || `photo_${n.id}.jpg`,
    previewUrl: n.previewUrl,
    createdAt: n.createdAt,
    nativeItem: n,
  }))
}

export function PhotoAlbumSheet({
  open,
  onOpenChange,
  maxSelect = 9,
  hintText,
  fileAccept = 'image/*',
  demoItems,
  onConfirm,
}: PhotoAlbumSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const loadingPageRef = useRef(false)

  const [items, setItems] = useState<AlbumGridItem[]>(() => (demoItems ? [...demoItems] : []))
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [partialAccess, setPartialAccess] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      for (const u of urls) URL.revokeObjectURL(u)
    }
  }, [])

  const fetchInitialPage = useCallback(async () => {
    if (demoItems && !isNativeApp()) {
      await Promise.resolve()
      setItems([...demoItems])
      setHasMore(false)
      setNextOffset(demoItems.length)
      setPermissionDenied(false)
      return
    }
    if (!isNativeApp()) {
      await Promise.resolve()
      setItems([])
      setHasMore(false)
      setNextOffset(0)
      return
    }

    loadingPageRef.current = true
    await Promise.resolve()
    setLoadingInitial(true)
    setPermissionDenied(false)
    try {
      const perm = await requestNativePermission('photos')
      if (perm !== 'granted') {
        setPermissionDenied(true)
        setItems((prev) => prev.filter((x) => x.id.startsWith('local-')))
        setHasMore(false)
        toast.error('需要开启「相册与媒体」权限才能读取手机相册', {
          description: '也可在「我的 → 权限管理」中开启',
        })
        return
      }
      const page = await listNativeAlbumPhotosPage(0, PAGE_SIZE)
      const mapped = mapNativeItems(page.items)
      setItems((prev) => {
        const localOnly = prev.filter((x) => x.id.startsWith('local-'))
        return [...localOnly, ...mapped]
      })
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
      setPartialAccess(page.partialAccess)
    } finally {
      loadingPageRef.current = false
      setLoadingInitial(false)
    }
  }, [demoItems])

  const fetchNextPage = useCallback(async () => {
    if (!open || !hasMore || loadingPageRef.current || !isNativeApp()) return
    loadingPageRef.current = true
    setLoadingMore(true)
    try {
      const page = await listNativeAlbumPhotosPage(nextOffset, PAGE_SIZE)
      const mapped = mapNativeItems(page.items)
      setItems((prev) => {
        const existingIds = new Set(prev.map((x) => x.id))
        const deduped = mapped.filter((x) => !existingIds.has(x.id))
        return [...prev, ...deduped]
      })
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
      setPartialAccess(page.partialAccess)
    } finally {
      loadingPageRef.current = false
      setLoadingMore(false)
    }
  }, [open, hasMore, nextOffset])

  // 每次打开时异步同步第一页元数据
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      void fetchInitialPage()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open, fetchInitialPage])

  // 触底无限下滑监听：使用 callback ref 感知 Sheet Portal 延迟挂载，绑定 scroll 距离阈值 + IntersectionObserver
  useEffect(() => {
    if (!open || !hasMore || loadingInitial || loadingMore || !sentinelEl) return
    const scrollRoot = sentinelEl.closest('.overflow-y-auto') as HTMLElement | null

    const checkNearBottom = () => {
      if (!scrollRoot) return
      if (
        scrollRoot.clientHeight > 0 &&
        scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight <= 320
      ) {
        void fetchNextPage()
      }
    }

    scrollRoot?.addEventListener('scroll', checkNearBottom, { passive: true })
    const rafId = window.requestAnimationFrame(checkNearBottom)

    let observer: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            void fetchNextPage()
          }
        },
        {
          root: scrollRoot,
          rootMargin: '0px 0px 300px 0px',
        },
      )
      observer.observe(sentinelEl)
    }

    return () => {
      window.cancelAnimationFrame(rafId)
      scrollRoot?.removeEventListener('scroll', checkNearBottom)
      observer?.disconnect()
    }
  }, [open, hasMore, loadingInitial, loadingMore, fetchNextPage, items.length, sentinelEl])

  async function handleReselectPartial() {
    const state = await reselectNativePhotos()
    if (state === 'granted') {
      await fetchInitialPage()
    }
  }

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

    const allFiles = Array.from(fileList)
    const nonImages = allFiles.filter((f) => !f.type.startsWith('image/'))
    // 若导入的是 TXT / HTML 等非图片文档附件，直接确认返回给调用方处理
    if (nonImages.length > 0 && allFiles.every((f) => !f.type.startsWith('image/'))) {
      onConfirm(nonImages)
      setSelectedIds([])
      onOpenChange(false)
      return
    }

    const imported: AlbumGridItem[] = []
    for (const file of allFiles) {
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

  const supportsDocImport = fileAccept !== 'image/*'

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="选择照片"
      description={
        hintText ?? `点击右上角圆圈可按顺序多选（最多 ${maxSelect} 张），向下滑动自动加载更多`
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
              {supportsDocImport ? '系统文件 / 附件' : '系统文件管理'}
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
        accept={fileAccept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleLocalFilesImport}
      />

      {partialAccess && (
        <div className="bg-primary-soft/60 border-primary/20 mb-2.5 flex items-center justify-between gap-2 rounded-2xl border px-3 py-2">
          <span className="text-tiny text-primary-ink">当前仅展示你授权访问的选定照片</span>
          <button
            type="button"
            onClick={() => void handleReselectPartial()}
            className="text-tiny text-primary-ink shrink-0 font-bold underline"
          >
            增选更多照片
          </button>
        </div>
      )}

      {loadingInitial && items.length === 0 ? (
        <div className="grid grid-cols-3 gap-2 pt-1" aria-label="正在加载相册缩略图">
          {Array.from({ length: 9 }).map((_, idx) => (
            <Skeleton key={idx} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8">
          <EmptyState
            size="compact"
            title={permissionDenied ? '尚未开启相册访问权限' : '相册里暂时没有照片'}
            description={
              permissionDenied
                ? '开启相册权限后即可直接浏览手机照片，也可点左下角从系统文件管理选取'
                : '拍一张照片后再来，或点击左下角从系统文件管理选取'
            }
            action={
              permissionDenied ? (
                <Button size="sm" variant="soft" onClick={() => void fetchInitialPage()}>
                  重新授权读取
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
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
                    'bg-surface-sunken border-border group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border transition-transform duration-150 select-none',
                    selected && 'ring-primary ring-2',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 相册轻量流式缩略图预览，按视口懒加载 */}
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                      'size-full object-cover transition-transform duration-150',
                      selected && 'scale-[0.96]',
                    )}
                  />

                  {selected && (
                    <div className="bg-foreground/15 pointer-events-none absolute inset-0" />
                  )}

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
                </div>
              )
            })}
          </div>

          <div ref={setSentinelEl} className="flex min-h-8 items-center justify-center py-2">
            {loadingMore ? (
              <span className="text-tiny text-muted inline-flex items-center gap-1.5">
                <Icon name="loader" size={13} className="animate-spin-slow text-primary" />
                正在加载更多照片…
              </span>
            ) : !hasMore && items.length >= PAGE_SIZE ? (
              <span className="text-tiny text-subtle">已加载全部 {items.length} 张照片</span>
            ) : null}
          </div>
        </>
      )}
    </Sheet>
  )
}
