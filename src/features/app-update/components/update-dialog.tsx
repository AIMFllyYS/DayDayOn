'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { APP_VERSION } from '@/lib/app-version'
import { errorMessage, isApiError } from '@/lib/api'
import { fetchAppUpdate } from '@/lib/api/queries/app-update'
import {
  getNativeApkUpdateStatus,
  hasNativeApkUpdater,
  installNativeDownloadedApk,
  isNativeApp,
  nativeShellVersion,
  startNativeApkUpdate,
  subscribeNativeApkUpdateProgress,
  type NativeApkUpdateStatus,
} from '@/lib/native'
import type { AppUpdate } from '../schemas'

/*
 * 「我的 → 检查更新」与启动自动检查（download/README.md）：
 * - 已是最新：手动检查时复用 toast 提示一句；
 * - 有更新：复用居中确认弹窗（size=md），中间渲染更新日志 Markdown；
 *   reload = 网页更新了，点「刷新」；
 *   install = 安装包更新了，在应用页面实时展示下载进度条、支持切入后台继续下载，下载完成后自动校验 SHA-256 并调起系统安装（含未知来源安装权限引导与自动续装）。
 * - 全链路只使用自有服务器 `/download/DayDayOn.apk`，彻底移除任何 GitHub 下载链接。
 */

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

const AUTO_CHECK_SESSION_KEY = 'daydayon:auto-update-checked:v1'

export function useCheckUpdate() {
  const [checking, setChecking] = useState(false)
  const [update, setUpdate] = useState<AppUpdate | null>(null)

  const check = useCallback(
    async (silent = false) => {
      if (checking) return
      setChecking(true)
      try {
        const shell = nativeShellVersion(window.navigator.userAgent) ?? undefined
        const result = await fetchAppUpdate({ web: APP_VERSION, shell })
        if (result.kind === 'none') {
          if (!silent) toast.success(`已是最新版本 v${result.latest}`)
        } else {
          setUpdate(result)
        }
      } catch (e) {
        if (!silent) {
          toast.error(isApiError(e) ? errorMessage(e) : '没能检查更新，稍后再试试')
        }
      } finally {
        setChecking(false)
      }
    },
    [checking],
  )

  const dialog = update ? (
    <UpdateDialog
      update={update}
      onOpenChange={(open) => {
        if (!open && update.required) return
        if (!open) setUpdate(null)
      }}
    />
  ) : null

  return { check, checking, dialog }
}

/**
 * 启动后静默检查一次更新（仅在安卓原生壳内或单次会话首次进入时延迟 1.8s 执行，不抢占首屏水合）。
 */
export function AutoUpdateChecker() {
  const { check, dialog } = useCheckUpdate()

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(AUTO_CHECK_SESSION_KEY)) return
      window.sessionStorage.setItem(AUTO_CHECK_SESSION_KEY, '1')
    } catch {
      return
    }
    const timer = window.setTimeout(() => {
      void check(true)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [check])

  return dialog
}

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function UpdateDialog({
  update,
  onOpenChange,
}: {
  update: AppUpdate
  onOpenChange: (open: boolean) => void
}) {
  const install = update.kind === 'install'
  const [dlStatus, setDlStatus] = useState<NativeApkUpdateStatus>(() => getNativeApkUpdateStatus())
  const [webBlobUrl, setWebBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!install) return
    const unsub = subscribeNativeApkUpdateProgress((next) => {
      setDlStatus(next)
    })
    return unsub
  }, [install])

  useEffect(() => {
    return () => {
      if (webBlobUrl) URL.revokeObjectURL(webBlobUrl)
    }
  }, [webBlobUrl])

  const startWebFallbackDownload = useCallback(async () => {
    if (dlStatus.state === 'downloading' || dlStatus.state === 'verifying') return
    if (dlStatus.state === 'ready' && webBlobUrl) {
      const a = document.createElement('a')
      a.href = webBlobUrl
      a.download = 'DayDayOn.apk'
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }

    setDlStatus({
      state: 'downloading',
      percent: 0,
      downloadedBytes: 0,
      totalBytes: update.android.size,
      version: update.android.version,
      canInstall: true,
    })

    try {
      const res = await fetch(update.android.url, { cache: 'no-store' })
      if (!res.ok || !res.body) {
        throw new Error(`下载响应异常 (${res.status})`)
      }
      const total =
        Number.parseInt(res.headers.get('content-length') ?? '', 10) || update.android.size
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          const pct =
            total > 0 ? Math.min(99, Math.max(1, Math.round((received * 100) / total))) : 50
          setDlStatus({
            state: 'downloading',
            percent: pct,
            downloadedBytes: received,
            totalBytes: total,
            version: update.android.version,
            canInstall: true,
          })
        }
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: 'application/vnd.android.package-archive',
      })
      const objectUrl = URL.createObjectURL(blob)
      setWebBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return objectUrl
      })
      setDlStatus({
        state: 'ready',
        percent: 100,
        downloadedBytes: received || total,
        totalBytes: received || total,
        version: update.android.version,
        canInstall: true,
      })

      if (isNativeApp()) {
        window.location.assign(update.android.url)
      } else {
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = 'DayDayOn.apk'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    } catch (e) {
      setDlStatus({
        state: 'error',
        percent: 0,
        downloadedBytes: 0,
        totalBytes: update.android.size,
        version: update.android.version,
        canInstall: true,
        error: e instanceof Error ? e.message : '下载未完成，请稍后重试',
      })
    }
  }, [dlStatus.state, update.android.size, update.android.url, update.android.version, webBlobUrl])

  const handleConfirm = useCallback(async () => {
    if (!install) {
      window.location.reload()
      return
    }

    if (hasNativeApkUpdater()) {
      if (dlStatus.state === 'ready' || dlStatus.state === 'permission') {
        installNativeDownloadedApk()
        return
      }
      if (dlStatus.state === 'downloading' || dlStatus.state === 'verifying') {
        toast.info('正在后台下载更新，完成后将自动调起安装')
        onOpenChange(false)
        return
      }
      const next = startNativeApkUpdate({
        url: update.android.url,
        sha256: update.android.sha256,
        version: update.android.version,
      })
      setDlStatus(next)
      return
    }

    await startWebFallbackDownload()
  }, [
    dlStatus.state,
    install,
    onOpenChange,
    startWebFallbackDownload,
    update.android.sha256,
    update.android.url,
    update.android.version,
  ])

  const title = install ? `新安装包 v${update.android.version}` : `发现新版本 v${update.latest}`
  const description = install
    ? `${update.required ? '当前安装包版本过低，请升级后继续使用。' : ''}安装包约 ${formatKb(update.android.size)}，支持后台下载，完成后自动调起安装。`
    : `更新于 ${update.publishedAt}，刷新一下就能用上。`

  const isDownloading = dlStatus.state === 'downloading' || dlStatus.state === 'verifying'
  const confirmLabel = !install
    ? '刷新'
    : isDownloading
      ? `后台继续下载 (${dlStatus.percent}%)`
      : dlStatus.state === 'permission'
        ? '去开启安装权限'
        : dlStatus.state === 'ready'
          ? '立即安装更新'
          : dlStatus.state === 'error'
            ? '重新下载更新'
            : '立即下载更新'

  const cancelLabel = !install ? '稍后' : isDownloading ? '收起至后台' : '稍后'

  return (
    <ConfirmDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isDownloading) {
          toast.info('正在后台继续下载更新，完成后将自动调起安装')
        }
        onOpenChange(nextOpen)
      }}
      size="md"
      closeOnConfirm={!install}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={handleConfirm}
    >
      {install && dlStatus.state !== 'idle' && (
        <div
          data-testid="apk-update-progress-card"
          className="border-border bg-surface-sunken/65 flex flex-col gap-2.5 rounded-2xl border p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-semibold">
              {dlStatus.state === 'downloading' && '正在下载更新包…'}
              {dlStatus.state === 'verifying' && '正在校验安装包完整性…'}
              {dlStatus.state === 'permission' && '等待开启「允许安装未知应用」权限'}
              {dlStatus.state === 'ready' && '更新包已就绪，正在调起安装'}
              {dlStatus.state === 'error' && '更新包下载未完成'}
            </span>
            <Badge
              tone={
                dlStatus.state === 'error'
                  ? 'danger'
                  : dlStatus.state === 'ready'
                    ? 'success'
                    : dlStatus.state === 'permission'
                      ? 'warning'
                      : 'primary'
              }
            >
              {dlStatus.percent}%
            </Badge>
          </div>

          <ProgressBar
            value={dlStatus.percent}
            max={100}
            size="md"
            label="安装包下载进度"
            active={isDownloading}
            tone={
              dlStatus.state === 'error'
                ? 'danger'
                : dlStatus.state === 'ready'
                  ? 'success'
                  : 'primary'
            }
          />

          <div className="text-tiny text-muted flex items-center justify-between gap-2">
            <span>
              {dlStatus.error
                ? dlStatus.error
                : dlStatus.state === 'permission'
                  ? '开启权限后返回应用将自动继续安装'
                  : dlStatus.state === 'ready'
                    ? '若系统安装界面未弹出，请点下方「立即安装更新」'
                    : '下载期间可随时收起弹窗或切到后台'}
            </span>
            {dlStatus.totalBytes > 0 && (
              <span className="shrink-0 font-mono">
                {formatKb(dlStatus.downloadedBytes)} / {formatKb(dlStatus.totalBytes)}
              </span>
            )}
          </div>
        </div>
      )}

      {update.notes && (
        <div className="border-border bg-surface-sunken/40 text-body max-h-[40dvh] overflow-y-auto rounded-2xl border px-4 py-3">
          <Markdown text={update.notes} />
        </div>
      )}
    </ConfirmDialog>
  )
}
