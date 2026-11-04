'use client'

import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 打卡弹层底部双栏智能入口（正式业务组件 · 采用定稿方案 C「soft-outline 奶油描边」）：
 *   - 左按钮：智能拍照（bg-primary-soft + text-primary-ink，跳往 /checkin/smart?action=capture）
 *   - 右按钮：智能上传（bg-surface + text-primary-ink + border-border-strong + shadow-soft，跳往 /checkin/smart?action=upload）
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
  return (
    <div
      className={cn('grid w-full grid-cols-2 gap-2.5', className)}
      role="group"
      aria-label="智能打卡快捷操作"
    >
      <Link href={captureHref} onClick={onNavigate} className={cn(pillBaseClass, leftStyle)}>
        <Icon name="camera" size={20} className="shrink-0" />
        <span className="truncate">智能拍照</span>
      </Link>
      <Link href={uploadHref} onClick={onNavigate} className={cn(pillBaseClass, rightStyle)}>
        <Icon name="sparkles" size={20} className="text-primary-ink shrink-0" />
        <span className="truncate">智能上传</span>
      </Link>
    </div>
  )
}
