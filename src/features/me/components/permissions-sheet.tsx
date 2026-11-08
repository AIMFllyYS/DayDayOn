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
  openNativeAppSettings,
  requestNativePermission,
  type NativePermissionName,
  type NativePermissionsMap,
  type PermissionStateValue,
} from '@/lib/native'

/*
 * 「我的 → 权限管理」底部弹层（位于「隐私说明」与「注销账号」之间）：
 * 统一管理安卓手机端与 Web 端所需的 4 项核心权限：
 *   1. 相机权限（camera）：直接调用手机原生高分辨率相机拍照；
 *   2. 相册与媒体权限（photos）：自定义相册多选组件读取照片；
 *   3. 身体活动 / 计步器权限（steps）：读取硬件计步传感器并在主页展示「今日步数」；
 *   4. 通知与本地闹钟权限（notifications）：「手机提醒（手机端原生组件）」定时打卡提醒。
 */

interface PermissionMeta {
  key: NativePermissionName
  label: string
  description: string
  androidPermName: string
  icon: IconName
  tone: ModuleTone | 'primary'
}

const PERMISSION_ITEMS: readonly PermissionMeta[] = [
  {
    key: 'camera',
    label: '相机拍摄权限',
    description: '智能拍照与饮食识别时，直接调用手机原生相机拍摄高分辨率照片',
    androidPermName: 'android.permission.CAMERA',
    icon: 'camera',
    tone: 'diet',
  },
  {
    key: 'photos',
    label: '相册与媒体权限',
    description: '在自定义多选相册中预览并按顺序多选手机相册图片（仅内存压缩，不存原图）',
    androidPermName: 'READ_MEDIA_IMAGES',
    icon: 'sparkles',
    tone: 'study',
  },
  {
    key: 'steps',
    label: '身体活动与计步权限',
    description: '读取手机硬件计步传感器，在主页「今日步数」卡片实时统计步数',
    androidPermName: 'ACTIVITY_RECOGNITION',
    icon: 'footprints',
    tone: 'exercise',
  },
  {
    key: 'notifications',
    label: '通知与本地闹钟权限',
    description: '开启「手机提醒（手机端原生组件）」时，到点触发手机系统打卡提醒',
    androidPermName: 'POST_NOTIFICATIONS / SCHEDULE_EXACT_ALARM',
    icon: 'bell',
    tone: 'sleep',
  },
]

function statusBadge(status: PermissionStateValue) {
  switch (status) {
    case 'granted':
      return <Badge tone="success">已开启</Badge>
    case 'denied':
      return <Badge tone="danger">已拒绝</Badge>
    default:
      return <Badge tone="primary">可开启</Badge>
  }
}

export interface PermissionsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PermissionsSheet({ open, onOpenChange }: PermissionsSheetProps) {
  const [perms, setPerms] = useState<NativePermissionsMap>({
    camera: 'prompt',
    photos: 'prompt',
    steps: 'prompt',
    notifications: 'prompt',
  })
  const [requestingKey, setRequestingKey] = useState<NativePermissionName | null>(null)
  const native = isNativeApp()

  useEffect(() => {
    if (!open) return
    void getNativePermissions().then((next) => setPerms(next))
  }, [open])

  async function handleRequest(item: PermissionMeta) {
    setRequestingKey(item.key)
    try {
      const nextStatus = await requestNativePermission(item.key)
      setPerms((prev) => ({ ...prev, [item.key]: nextStatus }))
      if (nextStatus === 'granted') {
        toast.success(`「${item.label}」已开启`)
      } else if (nextStatus === 'denied') {
        toast.error(`「${item.label}」未授权`, {
          description: native
            ? '若系统不再弹出授权框，可点击下方「打开系统应用设置」手动开启'
            : '请在浏览器地址栏左侧的站点权限设置中允许该权限',
        })
      }
    } finally {
      setRequestingKey(null)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="权限管理"
      description={
        native
          ? '管理 DayDayOn 安卓客户端所需的硬件与系统权限，保障最小必要授权'
          : '当前为网页端模式；安装安卓客户端后可完整管理相机、相册、计步与闹钟权限'
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-tiny text-muted">
            遵循隐私最小化原则，关闭权限不影响基础手动打卡
          </span>
          {native ? (
            <Button size="sm" variant="secondary" onClick={() => openNativeAppSettings()}>
              系统应用设置
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
              我知道了
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-2.5 pt-1">
        {PERMISSION_ITEMS.map((item) => {
          const status = perms[item.key]
          const isBusy = requestingKey === item.key
          return (
            <div
              key={item.key}
              className="border-border bg-surface-sunken/55 flex flex-col gap-2.5 rounded-2xl border p-3.5"
            >
              <div className="flex min-w-0 items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <IconTile icon={item.icon} tone={item.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-caption font-bold">{item.label}</span>
                      {statusBadge(status)}
                    </div>
                    <p className="text-tiny text-muted mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                    <p className="text-tiny text-subtle mt-1 font-mono">{item.androidPermName}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {status === 'granted' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!native}
                      onClick={() => {
                        if (native) openNativeAppSettings()
                      }}
                    >
                      {native ? '去设置' : '已就绪'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={status === 'denied' && native ? 'secondary' : 'soft'}
                      disabled={isBusy}
                      onClick={() => {
                        if (status === 'denied' && native) {
                          openNativeAppSettings()
                        } else {
                          void handleRequest(item)
                        }
                      }}
                    >
                      {isBusy
                        ? '请求中…'
                        : status === 'denied' && native
                          ? '去系统开启'
                          : '立即开启'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
