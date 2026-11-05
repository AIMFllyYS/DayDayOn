'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { Markdown } from '@/components/markdown'
import { toast } from '@/components/ui/toast'
import { APP_VERSION } from '@/lib/app-version'
import { errorMessage, isApiError } from '@/lib/api'
import { fetchAppUpdate } from '@/lib/api/queries/app-update'
import { nativeShellVersion } from '@/lib/native'
import type { AppUpdate } from '../schemas'

/*
 * 「我的 → 检查更新」（download/README.md）。
 * - 已是最新：复用 toast 提示一句；
 * - 有更新：复用居中确认弹窗（size=md），中间渲染更新日志 Markdown；
 *   reload = 网页更新了，点「刷新」；install = 安装包更新了，点「下载安装包」（自己服务器，下方附 GitHub 备用）。
 */

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

export function useCheckUpdate() {
  const [checking, setChecking] = useState(false)
  const [update, setUpdate] = useState<AppUpdate | null>(null)

  const check = useCallback(async () => {
    if (checking) return
    setChecking(true)
    try {
      const shell = nativeShellVersion(window.navigator.userAgent)
      const result = await fetchAppUpdate({ web: APP_VERSION, shell })
      if (result.kind === 'none') {
        toast.success(`已是最新版本 v${result.latest}`)
      } else {
        setUpdate(result)
      }
    } catch (e) {
      toast.error(isApiError(e) ? errorMessage(e) : '没能检查更新，稍后再试试')
    } finally {
      setChecking(false)
    }
  }, [checking])

  const dialog = update ? (
    <UpdateDialog update={update} onOpenChange={(open) => !open && setUpdate(null)} />
  ) : null

  return { check, checking, dialog }
}

export function UpdateDialog({
  update,
  onOpenChange,
}: {
  update: AppUpdate
  onOpenChange: (open: boolean) => void
}) {
  const install = update.kind === 'install'
  const title = install ? `新安装包 v${update.android.version}` : `发现新版本 v${update.latest}`
  const description = install
    ? `${update.required ? '当前安装包太旧，需要更新后才能继续使用。' : ''}安装包约 ${Math.max(1, Math.round(update.android.size / 1024))} KB，下载后点开安装即可。`
    : `更新于 ${update.publishedAt}，刷新一下就能用上。`

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      size="md"
      title={title}
      description={description}
      confirmLabel={install ? '下载安装包' : '刷新'}
      cancelLabel="稍后"
      onConfirm={() => {
        if (install) window.location.assign(update.android.url)
        else window.location.reload()
      }}
    >
      {update.notes && (
        <div className="border-border bg-surface-sunken/40 text-body max-h-[45dvh] overflow-y-auto rounded-2xl border px-4 py-3">
          <Markdown text={update.notes} />
        </div>
      )}
      {install && (
        <a
          href={update.android.fallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="text-caption text-muted hover:text-foreground self-start underline underline-offset-2"
        >
          下载不了？从 GitHub 下载
        </a>
      )}
    </ConfirmDialog>
  )
}
