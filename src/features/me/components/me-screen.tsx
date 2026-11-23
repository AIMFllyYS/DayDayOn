'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Collapse } from '@/components/ui/collapse'
import { Field, Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/error-state'
import { Icon } from '@/components/ui/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { TimePicker } from '@/components/ui/time-picker'
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
import { cn } from '@/lib/cn'
import { useLazyMount } from '@/lib/lazy'
import { isThemeId, setTheme } from '@/lib/theme'
import { nativeShellVersion, syncNativeReminder } from '@/lib/native'
import { useCheckUpdate } from '@/features/app-update/components/update-dialog'
import { APP_VERSION } from '@/lib/app-version'
import { MeView } from './me-view'

/*
 * 「我的」页容器（PRD 2.11、7.1）：取 GET /me，偏好改动 PATCH /me/preferences（乐观更新），
 * 主题改动成功后 setTheme()；导出、注销、退出登录。
 */

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

function failToast(e: unknown) {
  toast.error(isApiError(e) ? errorMessage(e) : '网络好像不太稳，稍后再试试')
}

/** 退出登录：清会话 cookie、清内存里的查询缓存，再整页回到落地页 /welcome */
async function signOutAndLeave(clear: () => void) {
  await authClient.signOut().catch(() => undefined)
  clear()
  window.location.replace('/welcome')
}

export function MeScreen() {
  const queryClient = useQueryClient()
  const { data: me, isPending, isError, error, refetch, isRefetching } = useQuery(meQuery())
  const update = useUpdatePreferences()
  const remove = useDeleteAccount()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteLoaded = useLazyMount(deleteOpen)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const signOutLoaded = useLazyMount(signOutOpen)
  const [confirmText, setConfirmText] = useState('')
  const [remindPickerOpen, setRemindPickerOpen] = useState(false)
  const updates = useCheckUpdate()

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

  const remindValue = me.preferences.remindAt ?? '21:00'
  const shellVersion =
    typeof window !== 'undefined' ? nativeShellVersion(window.navigator.userAgent) : null
  const displayVersion = shellVersion ? `${APP_VERSION} · 客户端 v${shellVersion}` : APP_VERSION

  function updateRemindTime(nextTime: string) {
    const r = LocalTimeSchema.safeParse(nextTime)
    if (!r.success || r.data === me?.preferences.remindAt) return
    changePreferences({ remindAt: r.data })
    if (me?.preferences.remindMode === 'native') {
      void syncNativeReminder({ enabled: true, remindAt: r.data })
    }
  }

  return (
    <>
      {updates.dialog}
      <MeView
        me={me}
        onCheckUpdate={() => void updates.check()}
        checkingUpdate={updates.checking}
        appVersion={displayVersion}
        quota={<QuotaCard />}
        onPreferencesChange={changePreferences}
        remindControl={
          <div className="border-border bg-surface-sunken/60 flex flex-col gap-2 rounded-xl border p-3">
            <button
              type="button"
              aria-expanded={remindPickerOpen}
              onClick={() => setRemindPickerOpen((o) => !o)}
              className="flex w-full items-center gap-2 text-left"
            >
              <Icon name="clock" size={15} className="text-primary-ink shrink-0" lineOnly />
              <span className="text-caption font-semibold">提醒时间</span>
              <span className="font-display text-caption text-primary-ink ml-auto font-bold tabular-nums">
                {remindValue}
              </span>
              <Icon
                name="chevron-down"
                size={15}
                className={cn(
                  'text-subtle shrink-0 transition-transform duration-(--dur-base)',
                  remindPickerOpen && 'rotate-180',
                )}
              />
            </button>
            <Collapse open={remindPickerOpen} unmountOnCollapse>
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-end gap-1">
                  {(['08:00', '12:00', '20:00', '21:00'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateRemindTime(preset)}
                      className={cn(
                        'text-tiny rounded-full px-2 py-0.5 font-semibold tabular-nums transition-colors',
                        remindValue === preset
                          ? 'bg-primary text-on-primary'
                          : 'border-border bg-surface text-muted hover:text-foreground border',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <TimePicker
                  label="每日提醒时间"
                  value={remindValue}
                  onChange={updateRemindTime}
                  tone="primary"
                  className="bg-surface border-border border"
                />
              </div>
            </Collapse>
          </div>
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

      {signOutLoaded && (
        <ConfirmDialog
          open={signOutOpen}
          onOpenChange={setSignOutOpen}
          title="退出登录？"
          description="下次用邮箱验证码就能回来"
          confirmLabel="退出登录"
          onConfirm={() => signOutAndLeave(() => queryClient.clear())}
        />
      )}

      {deleteLoaded && (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          tone="danger"
          title="注销账号？"
          confirmLabel="注销"
          description="目标、打卡、体重、心情和待办会全部删除，没法恢复。需要的话先导出数据。"
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
        >
          <Field label='输入"注销"确认' htmlFor="me-delete-confirm">
            <Input
              id="me-delete-confirm"
              value={confirmText}
              autoComplete="off"
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}
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
