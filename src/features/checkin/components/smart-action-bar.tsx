'use client'

import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { useMediaPicker } from '@/components/ui/use-media-picker'
import { cn } from '@/lib/cn'
import { setPendingSmartCapture } from '../smart-handoff'
import { SMART_UPLOAD_ACCEPT } from './smart-scanner'

/*
 * 打卡弹层底部双栏智能入口（正式业务组件 · 统一接入 useMediaPicker）：
 * - 左按钮「智能拍照」：
 *   - 网页端：同步触发系统摄像机 / 图片采集；
 *   - 安卓客户端：直接拉起原生高清相机（CameraTempFileProvider + EXIF 自动摆正）；
 * - 右按钮「智能上传」：
 *   - 网页端：同步触发操作系统原生文件管理器（支持多选图片或 TXT/HTML 文本，绝不弹安卓相册）；
 *   - 安卓客户端：打开流式缩略图无限下滑多选相册（与打卡页内完全同一个界面）；
 * - 选完后将完整 files 数组存入内存交接槽，跳往 /checkin/smart 扫描识别并原地挂载对应打卡板块核心。
 */

const pillBaseClass =
  'text-caption sm:text-body inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 font-semibold select-none ' +
  'transition-[transform,background-color,filter,border-color,box-shadow] duration-(--dur-fast) ease-spring ' +
  'active:scale-[0.96]'

const leftStyle = 'bg-primary-soft text-primary-ink hover:brightness-[0.97]'
const rightStyle =
  'bg-surface text-primary-ink border border-border-strong shadow-soft hover:bg-surface-sunken'

export interface SmartActionBarProps {
  captureHref?: string
  uploadHref?: string
  onNavigate?: () => void
  className?: string
}

export function SmartActionBar({
  captureHref = '/checkin/smart?action=capture',
  uploadHref = '/checkin/smart?action=upload',
  onNavigate,
  className,
}: SmartActionBarProps) {
  const router = useRouter()

  const mediaPicker = useMediaPicker({
    uploadAccept: SMART_UPLOAD_ACCEPT,
    maxSelect: 9,
    albumHintText:
      '点击右上角圆圈按 1、2、3 顺序多选照片（默认最多 9 张；单次识别自动上传前 2 张）',
    onFiles: (files, source) => {
      const first = files[0]
      if (!first) return
      const mode = source === 'capture' ? 'smart-capture' : 'smart-upload'
      const payload = setPendingSmartCapture({
        file: first,
        files,
        mode,
        requireSessionMatch: true,
      })
      onNavigate?.()
      const targetHref = source === 'capture' ? captureHref : uploadHref
      const sep = targetHref.includes('?') ? '&' : '?'
      router.push(`${targetHref}${sep}sid=${payload.id}`)
    },
  })

  return (
    <div
      className={cn('grid w-full grid-cols-2 gap-2.5', className)}
      role="group"
      aria-label="智能打卡快捷操作"
    >
      {mediaPicker.pickerNode}
      <button
        type="button"
        onClick={mediaPicker.openCapture}
        className={cn(pillBaseClass, leftStyle)}
      >
        <Icon name="camera" size={20} className="shrink-0" />
        <span className="truncate">智能拍照</span>
      </button>
      <button
        type="button"
        onClick={mediaPicker.openUpload}
        className={cn(pillBaseClass, rightStyle)}
      >
        <Icon name="sparkles" size={20} className="text-primary-ink shrink-0" />
        <span className="truncate">智能上传</span>
      </button>
    </div>
  )
}
