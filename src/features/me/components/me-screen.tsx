'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Field, Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeField } from '@/components/ui/time-field'
import { toast } from '@/components/ui/toast'
import type { UpdatePreferences } from '@/features/me/schemas'
import { QuotaCard } from '@/features/quota/components/quota-card'
import { LocalTimeSchema } from '@/features/shared/schemas'
import { errorMessage, isApiError, useQuery, useQueryClient } from '@/lib/api'
import {
  ME_EXPORT_URL,
  meQuery,
  useDeleteAccount,
  useUpdatePreferences,
} from '@/lib/api/queries/me'
import { authClient } from '@/lib/auth-client'
import { isThemeId, setTheme } from '@/lib/theme'
import { MeView } from './me-view'

/*
 * 「我的」页容器（PRD 2.11、7.1）：取 GET /me，偏好改动 PATCH /me/preferences（乐观更新），
 * 主题改动成功后 setTheme()；导出、注销、退出登录。
 */

const ConfirmDialog = dynamic(() =>
  import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
)

function failToast(e: unknown) {
  toast.error(isApiError(e) ? errorMessage(e) : '网络好像不太稳，稍后再试试')
}

/** 退出登录：清会话 cookie、清内存里的查询缓存，再整页跳到登录页 */
async function signOutAndLeave(clear: () => void) {
  await authClient.signOut().catch(() => undefined)
  clear()
  window.location.replace('/login')
}

export function MeScreen() {
  const queryClient = useQueryClient()
  const { data: me, isPending, isError, error, refetch, isRefetching } = useQuery(meQuery())
  const update = useUpdatePreferences()
  const remove = useDeleteAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [remindDraft, setRemindDraft] = useState<string | null>(null)

  if (isPending) return <MeSkeleton />
  if (isError || !me) {
    return (
      <ErrorState
        title="没能加载你的信息"
        message={isApiError(error) ? errorMessage(error) : undefined}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }

  function changePreferences(patch: UpdatePreferences) {
    update.mutate(patch, {
      onSuccess: (next) => {
        if (patch.theme && isThemeId(next.preferences.theme)) setTheme(next.preferences.theme)
      },
      onError: failToast,
    })
  }

  const remindValue = remindDraft ?? me.preferences.remindAt ?? ''

  return (
    <>
      <MeView
        me={me}
        quota={<QuotaCard />}
        onPreferencesChange={changePreferences}
        remindControl={
          <TimeField
            label="提醒时间"
            id="me-remind"
            value={remindValue}
            onValueChange={setRemindDraft}
            onBlur={() => {
              if (remindDraft === null) return
              const r = LocalTimeSchema.safeParse(remindDraft)
              setRemindDraft(null)
              if (r.success && r.data !== me.preferences.remindAt)
                changePreferences({ remindAt: r.data })
            }}
            hint="过了这个时间还有没打卡的目标，主页顶部会提示一下"
          />
        }
        onExport={() => {
          window.location.assign(ME_EXPORT_URL)
          toast.info('开始下载你的数据')
        }}
        onDelete={() => {
          setConfirmText('')
          setDeleteOpen(true)
        }}
        onSignOut={() => setSignOutOpen(true)}
      />

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="退出登录？"
        description="下次用邮箱验证码就能回来"
        confirmLabel="退出登录"
        onConfirm={() => signOutAndLeave(() => queryClient.clear())}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title="注销账号？"
        confirmLabel="注销"
        description={
          <span className="flex flex-col gap-3">
            <span>目标、打卡、体重、心情和待办会全部删除，没法恢复。需要的话先导出数据。</span>
            <Field label='输入"注销"确认' htmlFor="me-delete-confirm">
              <Input
                id="me-delete-confirm"
                value={confirmText}
                autoComplete="off"
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </Field>
          </span>
        }
        onConfirm={async () => {
          if (confirmText.trim() !== '注销') {
            toast.error('请输入"注销"两个字')
            throw new Error('confirm mismatch')
          }
          try {
            await remove.mutateAsync('注销')
          } catch (e) {
            failToast(e)
            throw e
          }
          toast.success('账号已注销，谢谢你陪团团走过这一段')
          await signOutAndLeave(() => queryClient.clear())
        }}
      />
    </>
  )
}

function MeSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-4 @xl:grid-cols-[1fr_1.2fr]">
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  )
}
