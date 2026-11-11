'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '@/lib/cn'
import {
  NATIVE_ALBUM_ALL_ID,
  NATIVE_ALBUM_ALL_LABEL,
  hasNativeSystemFilePicker,
  isNativeApp,
  listNativeAlbumBuckets,
  listNativeAlbumPhotosPage,
  normalizeAlbumBuckets,
  pickNativeSystemFiles,
  requestNativePermission,
  reselectNativePhotos,
  resolveAlbumPhotoToFile,
  sortAlbumPhotosNewestFirst,
  type NativeAlbumBucket,
  type NativeAlbumPhotoItem,
} from '@/lib/native'
import { Button } from './button'
import { EmptyState } from './empty-state'
import { Icon } from './icon'
import { Popover } from './popover'
import { Sheet } from './sheet'
import { Skeleton } from './skeleton'
import { toast } from './toast'

/*
 * 安卓客户端专属 · 流式缩略图无限下滑多选相册（PhotoAlbumSheet）：
 * - 仅在安卓客户端（isNativeApp()）内打开（Playbook 可通过 demoItems / demoBuckets 显式注入演示数据，正式生产代码零假图）；
 * - 严格按真实拍摄/创建时间倒序排列（Newest → Oldest）；
 * - 顶栏左上角以相册文件夹选择菜单取代原静态「选择照片」标题与辅助说明：保留手绘相册 SVG 图标与当前目录名，
 *   首项固定为「全部」，目录列表高度受限（max-h-56）并在条目超出时内部独立滚动，绝不撑高抽屉或顶出屏幕；
 * - 支持 1..maxSelect 跨目录顺序角标点选与重排、一键取消选择、Android 14+ 部分照片授权增选与可选文档附件导入。
 */

const PAGE_SIZE = 30

export interface AlbumGridItem {
  id: string
  fileName: string
  previewUrl: string
  createdAt: string
  /** 所属相册/文件夹 ID（MediaStore BUCKET_ID 或 Playbook 演示目录 ID） */
  albumId?: string
  /** 所属相册/文件夹显示名称 */
  albumName?: string
  /** 本地导入或 Playbook 演示的真实 File；若来自原生相册则在点击「完成」时按需读取 */
  file?: File
  nativeItem?: NativeAlbumPhotoItem
}

export interface PhotoAlbumSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 默认支持最多选 9 张 */
  maxSelect?: number
  /** 兼容保留：顶栏原辅助说明文案已按设计隐藏 */
  hintText?: string
  /** 可选系统文件导入 accept（如智能上传需支持 TXT/HTML 附件时传入） */
  fileAccept?: string
  /** 仅限 /dev/playbook 演示显式注入，正式环境严禁传假图 */
  demoItems?: readonly AlbumGridItem[]
  /** 仅限 /dev/playbook 演示显式注入相册目录列表，正式环境严禁传假目录 */
  demoBuckets?: readonly NativeAlbumBucket[]
  onConfirm: (files: File[]) => void
}

function mapNativeItems(list: readonly NativeAlbumPhotoItem[]): AlbumGridItem[] {
  return sortAlbumPhotosNewestFirst(
    list.map((n) => ({
      id: `native:${n.id}`,
      fileName: n.name || `photo_${n.id}.jpg`,
      previewUrl: n.previewUrl,
      createdAt: n.createdAt,
      albumId: n.albumId,
      albumName: n.albumName,
      nativeItem: n,
    })),
  )
}

function deriveDemoBuckets(
  demoItems?: readonly AlbumGridItem[],
  demoBuckets?: readonly NativeAlbumBucket[],
): NativeAlbumBucket[] {
  if (demoBuckets && demoBuckets.length > 0) {
    return normalizeAlbumBuckets(demoBuckets, demoItems?.length ?? 0)
  }
  if (!demoItems || demoItems.length === 0) {
    return [{ id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: 0 }]
  }
  const counts = new Map<string, { name: string; count: number }>()
  for (const item of demoItems) {
    if (!item.albumId) continue
    const prev = counts.get(item.albumId)
    if (prev) {
      prev.count += 1
    } else {
      counts.set(item.albumId, { name: item.albumName || item.albumId, count: 1 })
    }
  }
  const raw: NativeAlbumBucket[] = Array.from(counts.entries()).map(([id, info]) => ({
    id,
    name: info.name,
    count: info.count,
  }))
  return normalizeAlbumBuckets(raw, demoItems.length)
}

function filterDemoItemsByBucket(
  demoItems: readonly AlbumGridItem[],
  bucketId: string,
): AlbumGridItem[] {
  const filtered =
    bucketId === NATIVE_ALBUM_ALL_ID
      ? demoItems
      : demoItems.filter((item) => item.albumId === bucketId)
  return sortAlbumPhotosNewestFirst(filtered)
}

interface AlbumBucketMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  buckets: readonly NativeAlbumBucket[]
  activeBucketId: string
  onSelectBucket: (bucketId: string) => void
}

function AlbumBucketMenu({
  open,
  onOpenChange,
  buckets,
  activeBucketId,
  onSelectBucket,
}: AlbumBucketMenuProps) {
  const activeBucketName =
    buckets.find((b) => b.id === activeBucketId)?.name ?? NATIVE_ALBUM_ALL_LABEL

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      align="start"
      sideOffset={6}
      clean
      positionerClassName="z-50"
      className="w-60 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl p-1.5"
      trigger={
        <button
          type="button"
          data-testid="photo-album-bucket-trigger"
          data-base-ui-swipe-ignore
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`切换相册文件夹，当前：${activeBucketName}`}
          className={cn(
            'text-foreground hover:bg-surface-sunken active:bg-surface-sunken inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 transition-colors outline-none',
            'border-border bg-surface-sunken/65 focus-visible:ring-ring focus-visible:ring-2',
          )}
        >
          <Icon name="album" size={18} className="text-primary shrink-0" />
          <span className="text-subhead truncate font-bold">{activeBucketName}</span>
          <Icon
            name="chevron-down"
            size={15}
            lineOnly
            className={cn(
              'text-muted shrink-0 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
      }
    >
      <div
        role="listbox"
        aria-label="相册文件夹列表"
        data-testid="photo-album-bucket-menu"
        data-base-ui-swipe-ignore
        className="max-h-56 overflow-y-auto overscroll-contain py-0.5"
      >
        {buckets.map((bucket) => {
          const active = bucket.id === activeBucketId
          return (
            <button
              key={bucket.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelectBucket(bucket.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-colors outline-none',
                'focus-visible:ring-ring focus-visible:ring-2',
                active
                  ? 'bg-primary-soft text-primary-ink font-semibold'
                  : 'text-foreground hover:bg-surface-sunken',
              )}
            >
              <span className="text-caption truncate">{bucket.name}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {bucket.count > 0 && (
                  <span
                    className={cn(
                      'text-tiny tabular-nums',
                      active ? 'text-primary-ink/80' : 'text-muted',
                    )}
                  >
                    {bucket.count}
                  </span>
                )}
                {active && (
                  <Icon name="check" size={15} lineOnly className="text-primary shrink-0" />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </Popover>
  )
}

export function PhotoAlbumSheet({
  open,
  onOpenChange,
  maxSelect = 9,
  fileAccept = 'image/*',
  demoItems,
  demoBuckets,
  onConfirm,
}: PhotoAlbumSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null)
  const knownItemsRef = useRef<Map<string, AlbumGridItem>>(new Map())
  const loadingPageRef = useRef(false)
  const requestSeqRef = useRef(0)

  const initialDemoBuckets = useMemo(
    () => deriveDemoBuckets(demoItems, demoBuckets),
    [demoItems, demoBuckets],
  )

  const [buckets, setBuckets] = useState<NativeAlbumBucket[]>(() => initialDemoBuckets)
  const [activeBucketId, setActiveBucketId] = useState<string>(NATIVE_ALBUM_ALL_ID)
  const [bucketMenuOpen, setBucketMenuOpen] = useState(false)
  const [items, setItems] = useState<AlbumGridItem[]>(() =>
    demoItems ? filterDemoItemsByBucket(demoItems, NATIVE_ALBUM_ALL_ID) : [],
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [nextOffset, setNextOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [partialAccess, setPartialAccess] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pickingSystemFiles, setPickingSystemFiles] = useState(false)

  useEffect(() => {
    for (const item of items) {
      knownItemsRef.current.set(item.id, item)
    }
  }, [items])

  const loadBucketFirstPage = useCallback(
    async (bucketId: string, refreshBuckets: boolean) => {
      const seq = ++requestSeqRef.current
      loadingPageRef.current = false

      if (demoItems && !isNativeApp()) {
        await Promise.resolve()
        if (seq !== requestSeqRef.current) return
        if (refreshBuckets) {
          setBuckets(deriveDemoBuckets(demoItems, demoBuckets))
        }
        const sortedDemo = filterDemoItemsByBucket(demoItems, bucketId)
        setItems((prev) => {
          const localOnly =
            bucketId === NATIVE_ALBUM_ALL_ID ? prev.filter((x) => x.id.startsWith('local-')) : []
          return sortAlbumPhotosNewestFirst([...localOnly, ...sortedDemo])
        })
        setHasMore(false)
        setNextOffset(sortedDemo.length)
        setPermissionDenied(false)
        return
      }

      if (!isNativeApp()) {
        await Promise.resolve()
        if (seq !== requestSeqRef.current) return
        setBuckets([{ id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: 0 }])
        setItems([])
        setHasMore(false)
        setNextOffset(0)
        return
      }

      loadingPageRef.current = true
      await Promise.resolve()
      if (seq !== requestSeqRef.current) return
      setLoadingInitial(true)
      setPermissionDenied(false)

      try {
        const perm = await requestNativePermission('photos')
        if (seq !== requestSeqRef.current) return
        if (perm !== 'granted') {
          setPermissionDenied(true)
          setBuckets([{ id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: 0 }])
          setItems((prev) => prev.filter((x) => x.id.startsWith('local-')))
          setHasMore(false)
          toast.error('需要开启「相册与媒体」权限才能读取手机相册', {
            description: '也可在「我的 → 权限管理」中开启',
          })
          return
        }

        const [fetchedBuckets, page] = await Promise.all([
          refreshBuckets ? listNativeAlbumBuckets() : Promise.resolve(null),
          listNativeAlbumPhotosPage(0, PAGE_SIZE, bucketId),
        ])
        if (seq !== requestSeqRef.current) return

        if (fetchedBuckets) {
          setBuckets(normalizeAlbumBuckets(fetchedBuckets, page.items.length))
        }
        const mapped = mapNativeItems(page.items)
        for (const item of mapped) {
          knownItemsRef.current.set(item.id, item)
        }
        setItems((prev) => {
          const localOnly =
            bucketId === NATIVE_ALBUM_ALL_ID ? prev.filter((x) => x.id.startsWith('local-')) : []
          return sortAlbumPhotosNewestFirst([...localOnly, ...mapped])
        })
        setNextOffset(page.nextOffset)
        setHasMore(page.hasMore)
        setPartialAccess(page.partialAccess)
      } finally {
        if (seq === requestSeqRef.current) {
          loadingPageRef.current = false
          setLoadingInitial(false)
        }
      }
    },
    [demoBuckets, demoItems],
  )

  const fetchNextPage = useCallback(async () => {
    if (!open || !hasMore || loadingPageRef.current || !isNativeApp()) return
    const seq = requestSeqRef.current
    const bucketId = activeBucketId
    loadingPageRef.current = true
    setLoadingMore(true)
    try {
      const page = await listNativeAlbumPhotosPage(nextOffset, PAGE_SIZE, bucketId)
      if (seq !== requestSeqRef.current) return
      const mapped = mapNativeItems(page.items)
      for (const item of mapped) {
        knownItemsRef.current.set(item.id, item)
      }
      setItems((prev) => {
        const existingIds = new Set(prev.map((x) => x.id))
        const deduped = mapped.filter((x) => !existingIds.has(x.id))
        return sortAlbumPhotosNewestFirst([...prev, ...deduped])
      })
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
      setPartialAccess(page.partialAccess)
    } finally {
      if (seq === requestSeqRef.current) {
        loadingPageRef.current = false
        setLoadingMore(false)
      }
    }
  }, [open, hasMore, nextOffset, activeBucketId])

  // 每次打开抽屉时重置到「全部」目录并异步拉取最新相册目录与第一页照片
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      setBucketMenuOpen(false)
      setActiveBucketId(NATIVE_ALBUM_ALL_ID)
      void loadBucketFirstPage(NATIVE_ALBUM_ALL_ID, true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open, loadBucketFirstPage])

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

  function handleSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setBucketMenuOpen(false)
    }
    onOpenChange(nextOpen)
  }

  function handleSelectBucket(bucketId: string) {
    setBucketMenuOpen(false)
    if (bucketId === activeBucketId) return
    setActiveBucketId(bucketId)
    const scrollRoot = sentinelEl?.closest('.overflow-y-auto') as HTMLElement | null
    if (scrollRoot) {
      scrollRoot.scrollTop = 0
    }
    void loadBucketFirstPage(bucketId, false)
  }

  async function handleReselectPartial() {
    const state = await reselectNativePhotos()
    if (state === 'granted') {
      await loadBucketFirstPage(activeBucketId, true)
    }
  }

  function toggleSelect(item: AlbumGridItem) {
    knownItemsRef.current.set(item.id, item)
    setSelectedIds((prev) => {
      const existingIdx = prev.indexOf(item.id)
      if (existingIdx !== -1) {
        return prev.filter((id) => id !== item.id)
      }
      if (prev.length >= maxSelect) {
        toast.info(`最多只能选择 ${maxSelect} 张照片`)
        return prev
      }
      return [...prev, item.id]
    })
  }

  function clearSelection() {
    setSelectedIds([])
  }

  function deliverPickedFiles(allFiles: File[]) {
    if (allFiles.length === 0) return
    if (allFiles.length > maxSelect) {
      toast.info(`单次最多选择 ${maxSelect} 个文件，已为你保留前 ${maxSelect} 个`)
    }
    const pickedFiles = allFiles.slice(0, maxSelect)
    if (pickedFiles.length === 0) return

    // 从左下角「系统文件 / 附件」选中任意图片或文本文件后，立即关闭面板并直传给 Agent 识别，避免停留在空状态
    setSelectedIds([])
    handleSheetOpenChange(false)
    onConfirm(pickedFiles)
  }

  function handleLocalFilesImport(e: ChangeEvent<HTMLInputElement>) {
    // 必须先快照动态 FileList 再清空 input.value，否则 Blink/WebView 会原地将 FileList 清空为 0
    const allFiles = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    deliverPickedFiles(allFiles)
  }

  function handleSystemFilesClick() {
    if (pickingSystemFiles || submitting) return
    if (hasNativeSystemFilePicker()) {
      setPickingSystemFiles(true)
      void pickNativeSystemFiles(fileAccept, maxSelect)
        .then((nativeFiles) => {
          if (nativeFiles === null) {
            fileInputRef.current?.click()
            return
          }
          if (nativeFiles.length > 0) {
            deliverPickedFiles(nativeFiles)
          }
        })
        .finally(() => {
          setPickingSystemFiles(false)
        })
      return
    }
    fileInputRef.current?.click()
  }

  async function handleConfirm() {
    if (selectedIds.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const resolvedFiles: File[] = []
      for (const id of selectedIds) {
        const item = items.find((x) => x.id === id) ?? knownItemsRef.current.get(id)
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
      setSelectedIds([])
      handleSheetOpenChange(false)
      onConfirm(resolvedFiles)
    } finally {
      setSubmitting(false)
    }
  }

  const supportsDocImport = fileAccept !== 'image/*'

  return (
    <Sheet
      open={open}
      onOpenChange={handleSheetOpenChange}
      title="选择照片"
      titleSlot={
        <AlbumBucketMenu
          open={bucketMenuOpen}
          onOpenChange={setBucketMenuOpen}
          buckets={buckets}
          activeBucketId={activeBucketId}
          onSelectBucket={handleSelectBucket}
        />
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
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              disabled={pickingSystemFiles || submitting}
              onClick={handleSystemFilesClick}
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
            title={
              permissionDenied
                ? '尚未开启相册访问权限'
                : activeBucketId === NATIVE_ALBUM_ALL_ID
                  ? '相册里暂时没有照片'
                  : '该相册文件夹暂无照片'
            }
            description={
              permissionDenied
                ? '开启相册权限后即可直接浏览手机照片，也可点左下角从系统文件管理选取'
                : activeBucketId === NATIVE_ALBUM_ALL_ID
                  ? '拍一张照片后再来，或点击左下角从系统文件管理选取'
                  : '可点击左上角相册菜单切回「全部」或其他文件夹浏览'
            }
            action={
              permissionDenied ? (
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() => void loadBucketFirstPage(activeBucketId, true)}
                >
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
                  onClick={() => toggleSelect(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleSelect(item)
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
