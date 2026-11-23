'use client'

import { useEffect, useState } from 'react'
import { Markdown } from '@/components/markdown'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon, type IconName } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import type { ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
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
import { PERMISSIONS_COVENANT_MD } from './permissions-covenant'

/*
 * 「我的 → 权限管理」精简面板与弹层：
 * - 顶部仅保留清爽的「权限使用公约」与「打开系统设置」双入口，不再堆砌长段提示文案；
 * - 每项权限采用单行紧凑列表呈现（图标 + 名称与简短说明 + 右侧操作态），已开启时直接以「已开启」按钮态表达，不再叠放多余状态标签；
 * - 点击「权限使用公约」以官方 Markdown 文档形式完整披露各项权限用途、内存即焚承诺与撤回权利。
 */

interface PermissionMeta {
  key: NativePermissionName
  label: string
  description: string
  icon: IconName
  tone: ModuleTone | 'primary'
}

const PERMISSION_ITEMS: readonly PermissionMeta[] = [
  {
    key: 'camera',
    label: '相机拍摄',
    description: '拍照识别饮食、运动等打卡内容',
    icon: 'camera',
    tone: 'diet',
  },
  {
    key: 'photos',
    label: '相册与图片',
    description: '从相册选择照片上传识别',
    icon: 'album',
    tone: 'study',
  },
  {
    key: 'steps',
    label: '运动与步数',
    description: '自动同步手机今日步数进度',
    icon: 'footprints',
    tone: 'exercise',
  },
  {
    key: 'notifications',
    label: '系统通知',
    description: '每日按时推送打卡提醒',
    icon: 'bell',
    tone: 'sleep',
  },
]

export interface PermissionsManagerListProps {
  active?: boolean
  /** 若外层已经在 Sheet 弹层内，传回调在同弹层内切到公约视图，避免弹层套弹层 */
  onOpenCovenant?: () => void
}

export function PermissionsManagerList({
  active = true,
  onOpenCovenant,
}: PermissionsManagerListProps) {
  const [perms, setPerms] = useState<NativePermissionsMap>({
    camera: 'prompt',
    photos: 'prompt',
    steps: 'prompt',
    notifications: 'prompt',
  })
  const [partialPhotos, setPartialPhotos] = useState(false)
  const [requestingKey, setRequestingKey] = useState<NativePermissionName | null>(null)
  const [covenantOpen, setCovenantOpen] = useState(false)
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
        toast.error(`「${item.label}」未开启`, {
          description: native ? '可点击「打开系统设置」手动开启' : '请在浏览器站点权限中开启',
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

  function handleOpenCovenant() {
    if (onOpenCovenant) onOpenCovenant()
    else setCovenantOpen(true)
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* 顶部精简操作条：左侧「权限使用公约」+ 右侧「打开系统设置」（网页端仅保留公约与精简状态） */}
        <div className={cn('grid gap-2', native ? 'grid-cols-2' : 'grid-cols-1')}>
          <Button
            size="sm"
            variant="soft"
            icon="shield"
            className="w-full"
            onClick={handleOpenCovenant}
          >
            权限使用公约
          </Button>
          {native && (
            <Button
              size="sm"
              variant="secondary"
              icon="sliders"
              className="w-full"
              onClick={() => openNativeAppSettings()}
            >
              打开系统设置
            </Button>
          )}
        </div>

        {/* 四项权限单行紧凑清单 */}
        <ul className="divide-border border-border bg-surface shadow-soft divide-y overflow-hidden rounded-2xl border">
          {PERMISSION_ITEMS.map((item) => {
            const status: PermissionStateValue = perms[item.key]
            const isBusy = requestingKey === item.key
            const isPartialPhotoItem = item.key === 'photos' && partialPhotos
            return (
              <li
                key={item.key}
                className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <IconTile icon={item.icon} tone={item.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-caption text-foreground truncate font-bold">
                        {item.label}
                      </span>
                      {isPartialPhotoItem && <Badge tone="primary">部分授权</Badge>}
                    </div>
                    <p className="text-tiny text-muted mt-0.5 truncate">{item.description}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {status === 'granted' ? (
                    <>
                      {isPartialPhotoItem && native && (
                        <Button
                          size="sm"
                          variant="soft"
                          disabled={isBusy}
                          onClick={() => void handleReselectPhotos()}
                        >
                          增选
                        </Button>
                      )}
                      <button
                        type="button"
                        disabled={!native}
                        onClick={() => {
                          if (native) openSystemPageFor(item.key)
                        }}
                        className={cn(
                          'bg-success-soft text-success-ink text-tiny inline-flex h-9 min-w-20 shrink-0 items-center justify-center gap-1 rounded-full px-3 font-semibold transition-opacity',
                          native ? 'hover:opacity-85 active:scale-95' : 'cursor-default',
                        )}
                      >
                        <Icon name="check" size={13} strokeWidth={2.5} lineOnly />
                        <span>已开启</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (status === 'denied' && native) {
                          openSystemPageFor(item.key)
                        } else {
                          void handleRequest(item)
                        }
                      }}
                      className={cn(
                        'ease-spring text-tiny inline-flex h-9 min-w-20 shrink-0 items-center justify-center rounded-full px-3 font-semibold transition-[transform,background-color,filter] duration-(--dur-fast) active:scale-95 disabled:opacity-50',
                        status === 'denied' && native
                          ? 'border-border-strong bg-surface text-foreground hover:bg-surface-sunken border'
                          : 'bg-primary-soft text-primary-ink hover:brightness-95',
                      )}
                    >
                      {isBusy ? '请求中…' : status === 'denied' && native ? '去设置' : '立即开启'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 官方权限使用与隐私公约（Markdown 渲染） */}
      {!onOpenCovenant && (
        <Sheet
          open={covenantOpen}
          onOpenChange={setCovenantOpen}
          title="权限使用与隐私公约"
          description="DayDayOn 官方权限说明文档"
        >
          <div className="text-caption pb-2">
            <Markdown text={PERMISSIONS_COVENANT_MD} />
          </div>
        </Sheet>
      )}
    </>
  )
}

export interface PermissionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PermissionsSheet({ open, onOpenChange }: PermissionsSheetProps) {
  const [viewingCovenant, setViewingCovenant] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) setViewingCovenant(false)
    onOpenChange(next)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      title={viewingCovenant ? '权限使用与隐私公约' : '权限管理'}
      description={viewingCovenant ? 'DayDayOn 官方权限说明文档' : undefined}
      footer={
        viewingCovenant ? (
          <Button
            variant="ghost"
            icon="chevron-left"
            className="w-full"
            onClick={() => setViewingCovenant(false)}
          >
            返回权限管理
          </Button>
        ) : undefined
      }
    >
      {viewingCovenant ? (
        <div className="text-caption pb-2">
          <Markdown text={PERMISSIONS_COVENANT_MD} />
        </div>
      ) : (
        <PermissionsManagerList active={open} onOpenCovenant={() => setViewingCovenant(true)} />
      )}
    </Sheet>
  )
}
