'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { Icon } from './icon'
import { toast } from './toast'
import { useMediaPicker } from './use-media-picker'

/*
 * 图片选择：拍照或选图，压缩后交给调用方上传识别（PRD 2.6）。
 * - 接入全站统一 useMediaPicker：
 *   - 网页端：直接同步拉起操作系统/浏览器多选文件管理器（绝不弹出安卓专属相册）；
 *   - 安卓客户端：拍照走原生高分辨率相机，从相册选走流式缩略图无限下滑多选相册；
 * - 支持同时上传 2 张图片（多选超过 2 张时自动取前 2 张并提示）；
 * - 预览只在内存里：用压缩后的 Blob 生成 object URL，换图或卸载时立即 revoke（ADR-0002 第 4 节）。
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
  const urlRef = useRef<string | null>(null)
  // 只处理最后一次选择的结果：连续选两张时，先选的那张压缩完成也丢弃
  const pickSeq = useRef(0)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageCount, setImageCount] = useState(1)
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
      replacePreview(URL.createObjectURL(blob1), picked.length)
      onImage(blob1, blob2)
    } catch {
      if (seq !== pickSeq.current) return
      setLocalError(decodeErrorText)
    } finally {
      if (seq === pickSeq.current) setCompressing(false)
    }
  }

  const mediaPicker = useMediaPicker({
    uploadAccept: 'image/*',
    maxSelect: 9,
    onFiles: (files) => {
      void handleFiles(files)
    },
  })

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
      {mediaPicker.pickerNode}

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
            <p className="text-caption">拍一张或从本地多选照片，团团帮你估算热量</p>
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
          onClick={mediaPicker.openCapture}
        >
          {preview ? '重拍' : '拍照'}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={disabled || busy}
          onClick={mediaPicker.openUpload}
        >
          上传图片
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
