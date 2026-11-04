'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, type ChangeEvent } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { setPendingSmartCapture } from '../smart-handoff'

/*
 * 打卡弹层底部双栏智能入口（正式业务组件 · 采用定稿方案 C「soft-outline 奶油描边」）：
 *   - 左按钮：智能拍照（同步直接拉起系统摄像机 capture="environment"，拍完后存入内存交接槽并跳往 /checkin/smart?action=capture 直接进入扫描识别态）
 *   - 右按钮：智能上传（直接跳往 /checkin/smart?action=upload，在页面内上传图片或 TXT / HTML 文本）
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
  const captureInputRef = useRef<HTMLInputElement>(null)

  function handleCaptureFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingSmartCapture(file)
    onNavigate?.()
    router.push(captureHref)
  }

  return (
    <div
      className={cn('grid w-full grid-cols-2 gap-2.5', className)}
      role="group"
      aria-label="智能打卡快捷操作"
    >
      <input
        ref={captureInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCaptureFileChange}
      />
      <button
        type="button"
        onClick={() => captureInputRef.current?.click()}
        className={cn(pillBaseClass, leftStyle)}
      >
        <Icon name="camera" size={20} className="shrink-0" />
        <span className="truncate">智能拍照</span>
      </button>
      <Link href={uploadHref} onClick={onNavigate} className={cn(pillBaseClass, rightStyle)}>
        <Icon name="sparkles" size={20} className="text-primary-ink shrink-0" />
        <span className="truncate">智能上传</span>
      </Link>
    </div>
  )
}
