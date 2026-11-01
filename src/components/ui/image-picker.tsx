'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './button'
import { Icon } from './icon'

/*
 * 图片选择：拍照（capture="environment"）或从相册选，压缩后交给调用方上传识别（PRD 2.6）。
 * - 压缩函数由调用方传入（一般是 src/lib/image/compress.ts），原子组件不依赖领域代码。
 * - 预览只在内存里：用压缩后的 Blob 生成 object URL，换图或卸载时立即 revoke。
 *   图片不落盘、不进任何缓存（ADR-0002 第 4 节）；预览只在本组件里出现，识别结果和历史里不展示。
 * - 状态：idle 等待选图 → compressing 压缩中 → recognizing 识别中（调用方控制）→ error 出错可重选。
 */

export type ImagePickerStatus = 'idle' | 'compressing' | 'recognizing' | 'error'

interface ImagePickerProps {
  /** 压缩：解码失败时抛错，组件显示 decodeErrorText */
  compress: (file: File) => Promise<Blob>
  /** 压缩完成：调用方在这里发起识别请求 */
  onImage: (image: Blob) => void
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
  const [compressing, setCompressing] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    },
    [],
  )

  function replacePreview(next: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
    setPreview(next)
  }

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 清空 value，同一张图可以再次选择
    e.target.value = ''
    if (!file) return
    const seq = ++pickSeq.current
    replacePreview(null)
    setLocalError(null)
    setCompressing(true)
    try {
      const blob = await compress(file)
      if (seq !== pickSeq.current) return
      replacePreview(URL.createObjectURL(blob))
      onImage(blob)
    } catch {
      if (seq !== pickSeq.current) return
      setLocalError(decodeErrorText)
    } finally {
      if (seq === pickSeq.current) setCompressing(false)
    }
  }

  function clear() {
    pickSeq.current++
    replacePreview(null)
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
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleChange}
      />

      <div
        className={cn(
          'border-border-strong bg-surface-sunken relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed',
          preview && 'border-solid border-transparent',
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- 内存里的 blob: 预览，不经过 next/image 优化
          <img src={preview} alt="待识别的照片预览" className="size-full object-cover" />
        ) : (
          <div className="text-muted flex flex-col items-center gap-2 px-6 text-center">
            <Icon name="camera" size={36} />
            <p className="text-caption">拍一张这餐的照片，团团帮你估算热量</p>
            <p className="text-tiny">照片只用来识别，识别后不保存</p>
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
          onClick={() => cameraRef.current?.click()}
        >
          {preview ? '重拍' : '拍照'}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          disabled={disabled || busy}
          onClick={() => albumRef.current?.click()}
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
