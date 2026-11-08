'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '@/lib/cn'
import { captureNativeHighResPhoto, isNativeApp } from '@/lib/native'
import { Button } from './button'
import { Icon } from './icon'
import { PhotoAlbumSheet } from './photo-album-sheet'
import { toast } from './toast'

/*
 * 图片选择：拍照（优先直接调用安卓原生高分辨率相机，兜底 capture="environment"）或从自定义多选相册选，压缩后交给调用方上传识别（PRD 2.6）。
 * - 支持同时上传 2 张图片（相册默认支持 9 张多选，选超过 2 张时自动取前 2 张并提示）；
 * - 边界条件：前端默认只显示上传的第 1 张照片（附角标「共 2 张 · 默认展示首图」），但实际上传两张；
 * - 预览只在内存里：用压缩后的 Blob 生成 object URL，换图或卸载时立即 revoke。
 *   图片不落盘、不进任何缓存（ADR-0002 第 4 节）。
 */

export type ImagePickerStatus = 'idle' | 'compressing' | 'recognizing' | 'error'

interface ImagePickerProps {
  /** 压缩：解码失败时抛错，组件显示 decodeErrorText */
  compress: (file: File) => Promise<Blob>
  /** 压缩完成：调用方在这里发起识别请求（支持同时上传第 2 张图片） */
  onImage: (image: Blob, image2?: Blob) => void
  /** 识别请求进行中（调用方控制） */
  recognizing?: boolean
  /** 调用方的错误（例如识别失败），显示在预览下方 */
  error?: string | null
  /** 用户点"换一张"或清除时通知调用方（取消识别、清空草稿） */
  onClear?: () => void
  disabled?: boolean
  decodeErrorText?: string
  className?: string
}

export function ImagePicker({
  compress,
  onImage,
  recognizing = false,
  error,
  onClear,
  disabled = false,
  decodeErrorText = '这张图打不开，换一张或截个图试试',
  className,
}: ImagePickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const albumRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  // 只处理最后一次选择的结果：连续选两张时，先选的那张压缩完成也丢弃
  const pickSeq = useRef(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageCount, setImageCount] = useState(1)
  const [albumOpen, setAlbumOpen] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    },
    [],
  )

  function replacePreview(next: string | null, count = 1) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
    setPreview(next)
    setImageCount(count)
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    if (files.length > 2) {
      toast.info(`已选 ${files.length} 张照片，单次识别最多同时上传前 2 张～`)
    }
    const picked = files.slice(0, 2)
    const first = picked[0]
    if (!first) return
    const seq = ++pickSeq.current
    replacePreview(null, 1)
    setLocalError(null)
    setCompressing(true)
    try {
      const blob1 = await compress(first)
      const blob2 = picked[1] ? await compress(picked[1]) : undefined
      if (seq !== pickSeq.current) return
      // 前端默认只显示上传的第一张照片
      replacePreview(URL.createObjectURL(blob1), picked.length)
      onImage(blob1, blob2)
    } catch {
      if (seq !== pickSeq.current) return
      setLocalError(decodeErrorText)
    } finally {
      if (seq === pickSeq.current) setCompressing(false)
    }
  }

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : []
    // 清空 value，同一张图可以再次选择
    e.target.value = ''
    await handleFiles(list)
  }

  async function handleCameraClick() {
    if (isNativeApp()) {
      try {
        const file = await captureNativeHighResPhoto()
        if (file) {
          await handleFiles([file])
          return
        }
      } catch {
        toast.error('未开启相机权限，无法调用手机原生相机', {
          description: '请前往「我的 → 权限管理」开启相机权限',
        })
        return
      }
    }
    cameraRef.current?.click()
  }

  function clear() {
    pickSeq.current++
    replacePreview(null, 1)
    setCompressing(false)
    setLocalError(null)
    onClear?.()
  }

  const message = localError ?? error ?? null
  const status: ImagePickerStatus = compressing
    ? 'compressing'
    : recognizing
      ? 'recognizing'
      : message
        ? 'error'
        : 'idle'
  const busy = status === 'compressing' || status === 'recognizing'
  const statusText =
    status === 'compressing' ? '正在压缩照片…' : status === 'recognizing' ? '正在看照片…' : null

  return (
    <div className={cn('flex flex-col gap-3', className)} data-status={status}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleChange}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleChange}
      />
      <PhotoAlbumSheet
        open={albumOpen}
        onOpenChange={setAlbumOpen}
        maxSelect={9}
        onConfirm={(files) => {
          void handleFiles(files)
        }}
      />

      <div
        className={cn(
          'border-border-strong bg-surface-sunken relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed',
          preview && 'border-solid border-transparent',
        )}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- 内存里的首张图片 blob: 预览，不经过 next/image 优化 */}
            <img src={preview} alt="待识别的照片预览" className="size-full object-cover" />
            {imageCount > 1 && (
              <span className="bg-foreground/75 text-on-primary text-tiny absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 font-semibold backdrop-blur-xs">
                共 {imageCount} 张 · 默认展示首图
              </span>
            )}
          </>
        ) : (
          <div className="text-muted flex flex-col items-center gap-2 px-6 text-center">
            <Icon name="camera" size={36} />
            <p className="text-caption">拍一张或从相册多选照片，团团帮你估算热量</p>
            <p className="text-tiny">支持同时上传 2 张照片（默认展示首图），识别后不保存原图</p>
          </div>
        )}
        {busy && (
          <div className="bg-surface/70 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
            <Icon name="loader" size={28} className="animate-spin-slow text-primary-ink" />
            <span className="text-caption font-semibold">{statusText}</span>
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {statusText ?? ''}
      </p>
      {message && (
        <p role="alert" className="text-caption text-danger-ink flex items-start gap-1.5">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          icon="camera"
          variant={preview ? 'soft' : 'primary'}
          className="flex-1"
          disabled={disabled || busy}
          onClick={() => void handleCameraClick()}
        >
          {preview ? '重拍' : '拍照'}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={disabled || busy}
          onClick={() => setAlbumOpen(true)}
        >
          从相册选
        </Button>
        {(preview || message) && onClear && (
          <Button variant="ghost" icon="x" disabled={status === 'compressing'} onClick={clear}>
            清除
          </Button>
        )}
      </div>
    </div>
  )
}
