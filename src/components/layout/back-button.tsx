'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { IconButton } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import {
  invokeSmartBackHandler,
  setUnconfirmedSmartRecord,
  useUnconfirmedSmartRecord,
} from '@/features/checkin/smart-handoff'
import { cn } from '@/lib/cn'

interface BackButtonProps {
  fallbackHref: string
  showText?: boolean
  className?: string
  onBeforeBack?: () => boolean
}

/**
 * 二级页面的返回按钮（routing.md 第 7 节）：有历史时 router.back()，
 * 从深链接直接打开（历史只有这一页）时跳到上一级路径。
 * - 若当前处于历史记录只读详情视图，优先由 invokeSmartBackHandler() 直接回退到历史记录列表；
 * - 仅当处于智能识别实时扫描未确认记录状态时，才弹出二次确认对话框，确认退出后提示可在右上角查看历史拍摄记录。
 */
export function BackButton({
  fallbackHref,
  showText = false,
  className,
  onBeforeBack,
}: BackButtonProps) {
  const router = useRouter()
  const unconfirmed = useUnconfirmedSmartRecord()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function navigateBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  function handleClick() {
    if (onBeforeBack && onBeforeBack()) {
      return
    }
    if (invokeSmartBackHandler()) {
      return
    }
    if (unconfirmed) {
      setConfirmOpen(true)
      return
    }
    navigateBack()
  }

  return (
    <>
      {showText ? (
        <button
          type="button"
          aria-label="返回"
          onClick={handleClick}
          className={cn(
            'text-muted hover:text-foreground text-caption -ml-1.5 flex items-center gap-0.5 py-1 pr-2 font-medium transition-colors select-none active:scale-95',
            className,
          )}
        >
          <Icon name="chevron-left" size={18} lineOnly />
          <span>返回</span>
        </button>
      ) : (
        <IconButton
          icon="chevron-left"
          label="返回"
          className={cn('-ml-2', className)}
          onClick={handleClick}
        />
      )}

      {confirmOpen && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="还没有确认记录，是否要退出？"
          description="当前识别出的打卡记录尚未确认入库。退出后，你可以在上传页面右上角查看历史拍摄记录。"
          cancelLabel="继续确认"
          confirmLabel="确认退出"
          buttonLayout="split"
          onConfirm={() => {
            setUnconfirmedSmartRecord(false)
            toast.info('你可以在我们的上传页面右上角查看历史拍摄记录')
            navigateBack()
          }}
        />
      )}
    </>
  )
}
