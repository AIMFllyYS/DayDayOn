'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError } from '@/lib/api'
import { useRemoveFriend } from '@/lib/api/queries/friends'
import { friendActions, useFriendStore, type UnfriendTarget } from '../friend-store'

/**
 * 解除好友二次确认对话框（Issue #21 · Decision #6）：
 * - 支持从顶栏右上角 `+` 菜单（位置 A）或顶栏左上角头像栈长按二级菜单触发
 * - 确认后原子删除双向好友关系、自动切回「我的主页」（viewingFriendId = null），并保留历史私聊为只读归档
 */
export function UnfriendConfirmDialog() {
  const pathname = usePathname()
  const isDemo = pathname.startsWith('/dev')
  const { unfriendTarget } = useFriendStore()
  const removeFriend = useRemoveFriend()

  // 退场动画期间保留最后一次目标信息，防止关闭瞬间昵称闪烁为空
  const [cachedTarget, setCachedTarget] = useState<UnfriendTarget | null>(unfriendTarget)
  if (unfriendTarget && unfriendTarget.userId !== cachedTarget?.userId) {
    setCachedTarget(unfriendTarget)
  }

  const displayTarget = unfriendTarget ?? cachedTarget
  const nickname = displayTarget?.nickname ?? '该好友'

  async function handleConfirm() {
    if (!displayTarget) return
    if (isDemo) {
      friendActions.handleUnfriend(displayTarget.userId)
      toast.success(`已解除与「${displayTarget.nickname}」的好友关系（演示）`)
      return
    }
    try {
      await removeFriend.mutateAsync(displayTarget.userId)
      toast.success(`已解除与「${displayTarget.nickname}」的好友关系`)
    } catch (err) {
      toast.error(isApiError(err) ? errorMessage(err) : '解除好友失败，请稍后再试')
      throw err
    }
  }

  return (
    <ConfirmDialog
      open={unfriendTarget !== null}
      onOpenChange={(next) => {
        if (!next) friendActions.cancelUnfriend()
      }}
      title={`确认解除与「${nickname}」的好友关系？`}
      description="解除好友后，双方将不再公开彼此的打卡主页并切回「我的空间」；历史私聊记录将转为只读归档，无法继续发送新消息。"
      tone="danger"
      buttonLayout="split"
      centered
      cancelLabel="再想想"
      confirmLabel="确认解除"
      onConfirm={handleConfirm}
    >
      {displayTarget && (
        <div className="bg-surface-sunken flex items-center justify-center gap-3 rounded-2xl px-4 py-3">
          <Avatar name={displayTarget.nickname} avatar={displayTarget.avatar ?? null} size="md" />
          <div className="min-w-0 text-left">
            <div className="text-body text-foreground truncate font-bold">
              {displayTarget.nickname}
            </div>
            <div className="text-tiny text-muted">解除后需重新通过 6 位邀请码配对</div>
          </div>
        </div>
      )}
    </ConfirmDialog>
  )
}
