'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { captureNativeHighResPhoto, isNativeApp } from '@/lib/native'
import { toast } from './toast'

/*
 * 全站唯一的平台自适应媒体选择调度器（useMediaPicker）：
 * - 严格隔离网页端与安卓客户端边界：
 *   1. 纯网页端 / PWA（!isNativeApp()）：
 *      - 拍照（openCapture）：直接同步触发 `<input type="file" accept="image/*" capture="environment">`，绝不乱抢 getUserMedia；
 *      - 上传（openUpload）：直接同步触发 `<input type="file" accept={uploadAccept} multiple>`，一步拉起系统文件管理器多选，
 *        绝不加载、绝不弹出安卓专属的 PhotoAlbumSheet！
 *   2. 安卓客户端壳内（isNativeApp()）：
 *      - 拍照（openCapture）：优先调用原生高分辨率相机（CameraTempFileProvider + EXIF 自动摆正）；
 *      - 上传（openUpload）：打开流式缩略图无限下滑多选相册 PhotoAlbumSheet。
 */

const LazyPhotoAlbumSheet = dynamic(
  () => import('./photo-album-sheet').then((m) => m.PhotoAlbumSheet),
  { loading: () => null },
)

export interface UseMediaPickerOptions {
  /** 上传文件允许的 MIME 列表（默认 'image/*'） */
  uploadAccept?: string
  /** 安卓相册最多点选张数（默认 9） */
  maxSelect?: number
  /** 安卓相册副标题提示文案 */
  albumHintText?: string
  /** 选中文件后的统一回调（完整透传多选数组） */
  onFiles: (files: File[], source: 'capture' | 'upload') => void
}

export interface MediaPickerController {
  /** 触发智能拍照 / 相机拍摄 */
  openCapture: () => void
  /** 触发相册选图 / 文件多选上传（网页端直拉系统多选文件框，安卓端开流式缩略图相册） */
  openUpload: () => void
  /** 直接拉起系统原生文件选择器（如「文本附件」快捷按钮） */
  openSystemFiles: () => void
  /** 挂载在组件树内的隐藏 input 与按需懒加载相册节点 */
  pickerNode: ReactNode
}

export function useMediaPicker({
  uploadAccept = 'image/*',
  maxSelect = 9,
  albumHintText,
  onFiles,
}: UseMediaPickerOptions): MediaPickerController {
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [albumLoaded, setAlbumLoaded] = useState(false)
  const [albumOpen, setAlbumOpen] = useState(false)

  function handleCaptureInputChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (list.length > 0) {
      onFiles(list, 'capture')
    }
  }

  function handleUploadInputChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (list.length > 0) {
      onFiles(list, 'upload')
    }
  }

  async function runCapture() {
    if (isNativeApp()) {
      try {
        const file = await captureNativeHighResPhoto()
        if (file) {
          onFiles([file], 'capture')
          return
        }
      } catch {
        toast.error('未开启相机权限，无法调用手机原生相机', {
          description: '请前往「我的 → 权限管理」开启相机权限',
        })
        return
      }
    }
    captureInputRef.current?.click()
  }

  function openCapture() {
    if (isNativeApp()) {
      void runCapture()
    } else {
      // 网页端保持纯同步用户手势栈，确保所有浏览器 100% 不拦截文件框弹出
      captureInputRef.current?.click()
    }
  }

  function openUpload() {
    if (isNativeApp()) {
      if (!albumLoaded) setAlbumLoaded(true)
      setAlbumOpen(true)
      return
    }
    // 网页端直接同步调起操作系统 / 浏览器原生多选文件管理器
    uploadInputRef.current?.click()
  }

  function openSystemFiles() {
    uploadInputRef.current?.click()
  }

  const pickerNode: ReactNode = (
    <>
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCaptureInputChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept={uploadAccept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleUploadInputChange}
      />
      {albumLoaded && (
        <LazyPhotoAlbumSheet
          open={albumOpen}
          onOpenChange={setAlbumOpen}
          maxSelect={maxSelect}
          hintText={albumHintText}
          fileAccept={uploadAccept}
          onConfirm={(files) => {
            if (files.length > 0) {
              onFiles(files, 'upload')
            }
          }}
        />
      )}
    </>
  )

  return {
    openCapture,
    openUpload,
    openSystemFiles,
    pickerNode,
  }
}
