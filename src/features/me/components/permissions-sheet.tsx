'use client'

import { useEffect, useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { IconName } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import type { ModuleTone } from '@/components/ui/tone'
import {
  getNativePermissions,
  isNativeApp,
  isNativePhotosPartialAccess,
  openNativeAppSettings,
  openNativeNotificationSettings,
  reselectNativePhotos,
  requestNativePermission,
  type NativePermissionName,
  type NativePermissionsMap,
  type PermissionStateValue,
} from '@/lib/native'

/*
 * 「我的 → 权限管理」面板与弹层：
 * 面向普通用户清晰说明并管理 4 项系统授权（相机、相册、计步、通知），不暴露底层工程常量。
 */

interface PermissionMeta {
  key: NativePermissionName
  label: string
  description: string
  usageHint: string
  icon: IconName
  tone: ModuleTone | 'primary'
}

const PERMISSION_ITEMS: readonly PermissionMeta[] = [
  {
    key: 'camera',
    label: '相机拍摄',
    description: '智能拍照与饮食识别时，直接拍摄清晰照片供团团识别',
    usageHint: '仅在主动点击拍照时调用，照片不在磁盘或服务器原图落盘',
    icon: 'camera',
    tone: 'diet',
  },
  {
    key: 'photos',
    label: '相册与图片',
    description: '在选图面板中浏览并按顺序选择相册图片进行识别',
    usageHint: '仅读取你选中的图片并在内存中压缩，不会后台扫描隐私文件',
    icon: 'album',
    tone: 'study',
  },
  {
    key: 'steps',
    label: '运动与步数记录',
    description: '读取今日步数变化，在主页「今日步数」卡片实时同步进度',
    usageHint: '关闭后仍可随时手动填写今日步数',
    icon: 'footprints',
    tone: 'exercise',
  },
  {
    key: 'notifications',
    label: '系统通知提醒',
    description: '开启「手机提醒」后，在每天设定的时间推送打卡提醒通知',
    usageHint: '可随时在打卡与提醒设置中切换提醒方式或关闭',
    icon: 'bell',
    tone: 'sleep',
  },
]

function statusBadge(status: PermissionStateValue, partialPhotos = false) {
  if (partialPhotos) {
    return <Badge tone="primary">部分照片已授权</Badge>
  }
  switch (status) {
    case 'granted':
      return <Badge tone="success">已开启</Badge>
    case 'denied':
      return <Badge tone="danger">未开启</Badge>
    default:
      return <Badge tone="neutral">待授权</Badge>
  }
}

export function PermissionsManagerList({ active = true }: { active?: boolean }) {
  const [perms, setPerms] = useState<NativePermissionsMap>({
    camera: 'prompt',
    photos: 'prompt',
    steps: 'prompt',
    notifications: 'prompt',
  })
  const [partialPhotos, setPartialPhotos] = useState(false)
  const [requestingKey, setRequestingKey] = useState<NativePermissionName | null>(null)
  const native = isNativeApp()

  useEffect(() => {
    if (!active) return
    let cancelled = false
    async function refresh() {
      const next = await getNativePermissions()
      if (cancelled) return
      setPerms(next)
      setPartialPhotos(isNativePhotosPartialAccess())
    }
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [active])

  async function handleRequest(item: PermissionMeta) {
    setRequestingKey(item.key)
    try {
      const nextStatus = await requestNativePermission(item.key)
      setPerms((prev) => ({ ...prev, [item.key]: nextStatus }))
      setPartialPhotos(isNativePhotosPartialAccess())
      if (nextStatus === 'granted') {
        toast.success(`「${item.label}」已开启`)
      } else if (nextStatus === 'denied') {
        toast.error(`「${item.label}」暂未开启`, {
          description: native
            ? '可点击右侧「去设置」在系统设置中手动开启'
            : '请在浏览器地址栏左侧的站点权限中允许该权限',
        })
      }
    } finally {
      setRequestingKey(null)
    }
  }

  async function handleReselectPhotos() {
    setRequestingKey('photos')
    try {
      const nextStatus = await reselectNativePhotos()
      setPerms((prev) => ({ ...prev, photos: nextStatus }))
      setPartialPhotos(isNativePhotosPartialAccess())
    } finally {
      setRequestingKey(null)
    }
  }

  function openSystemPageFor(key: NativePermissionName) {
    if (key === 'notifications') {
      openNativeNotificationSettings()
    } else {
      openNativeAppSettings()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-sunken/70 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-3">
        <p className="text-caption text-muted min-w-0 flex-1 leading-relaxed">
          {native
            ? '遵循最小必要授权原则；关闭任意权限均不影响常规手动打卡与记录。'
            : '当前处于浏览器网页模式；在手机客户端内可完整管理相机、相册、计步与系统通知授权。'}
        </p>
        {native && (
          <Button size="sm" variant="secondary" onClick={() => openNativeAppSettings()}>
            打开系统设置
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {PERMISSION_ITEMS.map((item) => {
          const status = perms[item.key]
          const isBusy = requestingKey === item.key
          const isPartialPhotoItem = item.key === 'photos' && partialPhotos
          return (
            <div
              key={item.key}
              className="border-border bg-surface shadow-soft flex flex-col gap-2.5 rounded-2xl border p-4"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <IconTile icon={item.icon} tone={item.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-body font-bold">{item.label}</span>
                      {statusBadge(status, isPartialPhotoItem)}
                    </div>
                    <p className="text-caption text-muted mt-1 leading-relaxed">
                      {item.description}
                    </p>
                    <p className="text-tiny text-subtle mt-1 leading-relaxed">{item.usageHint}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {status === 'granted' ? (
                    <>
                      {isPartialPhotoItem && native && (
                        <Button
                          size="sm"
                          variant="soft"
                          disabled={isBusy}
                          onClick={() => void handleReselectPhotos()}
                        >
                          增选照片
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!native}
                        onClick={() => {
                          if (native) openSystemPageFor(item.key)
                        }}
                      >
                        {native ? '去设置' : '已开启'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant={status === 'denied' && native ? 'secondary' : 'soft'}
                      disabled={isBusy}
                      onClick={() => {
                        if (status === 'denied' && native) {
                          openSystemPageFor(item.key)
                        } else {
                          void handleRequest(item)
                        }
                      }}
                    >
                      {isBusy
                        ? '请求中…'
                        : status === 'denied' && native
                          ? '去设置开启'
                          : '立即开启'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface PermissionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PermissionsSheet({ open, onOpenChange }: PermissionsSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="权限管理"
      description="按需管理相机、相册、计步与系统通知授权"
    >
      <PermissionsManagerList active={open} />
    </Sheet>
  )
}
