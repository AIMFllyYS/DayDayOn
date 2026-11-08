'use client'

import { useState, type ReactNode } from 'react'
import { InteractivePet } from '@/components/mascot/interactive-pet'
import { Mascot } from '@/components/mascot/mascot'
import { mascotCharacters } from '@/components/mascot/mascot-svg'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { Popover } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import type { Me, RemindMode, UpdatePreferences } from '@/features/me/schemas'
import { cn } from '@/lib/cn'
import { isNativeApp, syncNativeReminder } from '@/lib/native'
import { themes } from '@/lib/theme'
import { DAY_START_OPTIONS } from '../units'
import { PermissionsSheet } from './permissions-sheet'

/*
 * 「我的」页的展示层（PRD 2.11，原型 MeScreen）。纯展示：数据和回调由 me-screen.tsx 传入，
 * Playbook 的页面预览用同一个组件配演示数据。
 * 互动版团团只出现在这一页；thumb（缩略图）时换成静态版。
 */

export interface MeViewProps {
  me: Me
  /** 额度卡的位置（D6 的 QuotaCard；Playbook 里放演示用的 QuotaMeter） */
  quota?: ReactNode
  onPreferencesChange: (patch: UpdatePreferences) => void
  /** 提醒时间输入框（受控、失焦保存），由容器提供 */
  remindControl?: ReactNode
  onExport: () => void
  onDelete: () => void
  onSignOut: () => void
  /** 「账号」里的检查更新（features/app-update）；不传就不显示这一行（Playbook 预览） */
  onCheckUpdate?: () => void
  checkingUpdate?: boolean
  /** 当前版本，显示在检查更新下面 */
  appVersion?: string
  exporting?: boolean
  thumb?: boolean
}

const REMIND_MODE_OPTIONS: {
  value: RemindMode
  label: string
  description: string
}[] = [
  {
    value: 'in-app',
    label: '应用内提醒',
    description: '每天过提醒时间后在主页与通知铃铛提示',
  },
  {
    value: 'native',
    label: '手机提醒（手机端原生组件）',
    description: '调用手机原生闹钟与系统通知定时提醒打卡',
  },
  {
    value: 'off',
    label: '关闭提醒',
    description: '不展示打卡提醒横幅，也不触发手机闹钟',
  },
]

export function MeView({
  me,
  quota,
  onPreferencesChange,
  remindControl,
  onExport,
  onDelete,
  onSignOut,
  onCheckUpdate,
  checkingUpdate = false,
  appVersion,
  thumb = false,
}: MeViewProps) {
  const { preferences: prefs, profile } = me
  const nickname = profile.nickname ?? '新朋友'
  const [themeSheetOpen, setThemeSheetOpen] = useState(false)
  const [mascotSheetOpen, setMascotSheetOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [remindMenuOpen, setRemindMenuOpen] = useState(false)
  const currentTheme = themes.find((t) => t.id === prefs.theme) ?? themes[0]
  const currentMascot = mascotCharacters.find((c) => c.id === prefs.mascot) ?? mascotCharacters[0]
  const currentRemindMode: RemindMode =
    prefs.remindMode ?? (prefs.remindAt !== null ? 'in-app' : 'off')
  const currentRemindLabel =
    REMIND_MODE_OPTIONS.find((o) => o.value === currentRemindMode)?.label ?? '关闭提醒'

  async function handleSelectRemindMode(nextMode: RemindMode) {
    setRemindMenuOpen(false)
    const nextTime = nextMode === 'off' ? null : (prefs.remindAt ?? '21:00')
    onPreferencesChange({ remindMode: nextMode, remindAt: nextTime })

    if (nextMode === 'native') {
      const ok = await syncNativeReminder({ enabled: true, remindAt: nextTime })
      if (ok && isNativeApp()) {
        toast.success(`已开启手机原生打卡提醒（每天 ${nextTime}）`)
      } else if (isNativeApp() && !ok) {
        toast.error('手机通知或闹钟权限未开启', {
          description: '请前往「我的 → 权限管理」开启通知与本地闹钟权限',
        })
      } else {
        toast.info('已切换为「手机提醒（手机端原生组件）」', {
          description: `在安卓客户端内将于每天 ${nextTime} 触发系统级打卡提醒`,
        })
      }
    } else if (nextMode === 'in-app') {
      await syncNativeReminder({ enabled: false, remindAt: nextTime })
      toast.success(`已开启应用内打卡提醒（每天 ${nextTime}）`)
    } else {
      await syncNativeReminder({ enabled: false, remindAt: null })
    }
  }

  return (
    <>
      <div className="grid w-full max-w-full min-w-0 gap-4 pb-6 @xl:grid-cols-[1fr_1.2fr] @xl:items-start">
        <div className="grid w-full min-w-0 gap-3">
          <Card variant="sticker" className="flex flex-col items-center gap-1 pt-10 text-center">
            {thumb ? (
              <Mascot size={120} character={prefs.mascot} />
            ) : (
              <InteractivePet size={120} character={prefs.mascot} idleSleepMs={0} />
            )}
            <div className="mt-1 flex max-w-full items-center gap-2 px-2">
              <Avatar name={nickname} avatar={profile.avatar} size="sm" />
              <p className="text-heading min-w-0 flex-1 truncate font-bold" title={nickname}>
                {nickname}
              </p>
            </div>
            <p className="text-caption text-muted break-all">{me.email}</p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
              <Badge tone="primary" icon="flame">
                {me.streak > 0 ? `连续 ${me.streak} 天` : '今天开始连续打卡'}
              </Badge>
              <Badge tone={prefs.leaderboardOptIn ? 'success' : 'neutral'} dot>
                {prefs.leaderboardOptIn ? '已上榜' : '未上榜'}
              </Badge>
            </div>
          </Card>
          {quota}
        </div>

        <div className="grid w-full min-w-0 gap-4">
          <MenuList title="外观">
            <MenuItem
              leading={
                <span
                  data-theme={prefs.theme}
                  className="bg-primary ring-border flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-2"
                >
                  <span className="size-2.5 rounded-full bg-white/60" />
                </span>
              }
              label="主题色"
              description={currentTheme.note}
              trailing={
                <span className="text-body text-muted flex items-center gap-1 font-normal">
                  <span>{currentTheme.label}</span>
                  <Icon name="chevron-right" size={16} className="text-subtle" />
                </span>
              }
              onClick={() => setThemeSheetOpen(true)}
            />
            <MenuItem
              leading={
                <span className="bg-surface-sunken ring-border flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
                  <Mascot size={32} character={prefs.mascot} />
                </span>
              }
              label="陪伴宠物"
              description={currentMascot.note}
              trailing={
                <span className="text-body text-muted flex items-center gap-1 font-normal">
                  <span>{currentMascot.name}</span>
                  <Icon name="chevron-right" size={16} className="text-subtle" />
                </span>
              }
              onClick={() => setMascotSheetOpen(true)}
            />
          </MenuList>

          <MenuList title="偏好设置">
            <MenuItem
              icon="trophy"
              tone="diet"
              label="加入排行榜"
              description="只公开昵称、头像和打卡天数"
              trailing={
                <Switch
                  checked={prefs.leaderboardOptIn}
                  onCheckedChange={(leaderboardOptIn) => onPreferencesChange({ leaderboardOptIn })}
                  label="加入排行榜"
                />
              }
            />
            <MenuItem
              icon="clock"
              tone="sleep"
              label="日切换时间"
              description="这个时间之前打卡算前一天"
              trailing={
                <Select
                  label="日切换时间"
                  options={DAY_START_OPTIONS}
                  value={String(prefs.dayStartHour)}
                  onValueChange={(v) => onPreferencesChange({ dayStartHour: Number(v) })}
                  className="text-caption h-10 w-28 shrink-0 px-2.5 sm:w-36 sm:px-3"
                />
              }
            />
            <MenuItem
              icon="bell"
              tone="primary"
              label="打卡提醒"
              description={
                currentRemindMode === 'native' && prefs.remindAt
                  ? `每天 ${prefs.remindAt} 手机原生闹钟与主页提醒`
                  : currentRemindMode === 'in-app' && prefs.remindAt
                    ? `每天 ${prefs.remindAt} 后在应用内提醒`
                    : '点击右侧选择「应用内提醒」或「手机提醒」'
              }
              onClick={() => setRemindMenuOpen((v) => !v)}
              trailing={
                <Popover
                  open={remindMenuOpen}
                  onOpenChange={setRemindMenuOpen}
                  side="bottom"
                  align="end"
                  clean
                  className="w-68 p-1.5"
                  trigger={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRemindMenuOpen((v) => !v)
                      }}
                      className="text-body text-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-normal transition-colors"
                    >
                      <span className="text-caption font-semibold">{currentRemindLabel}</span>
                      <Icon
                        name="chevron-right"
                        size={16}
                        className={cn(
                          'text-subtle transition-transform duration-150',
                          remindMenuOpen && 'rotate-90',
                        )}
                      />
                    </button>
                  }
                >
                  <div
                    role="menu"
                    aria-label="选择打卡提醒方式"
                    className="flex flex-col gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {REMIND_MODE_OPTIONS.map((opt) => {
                      const active = opt.value === currentRemindMode
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => void handleSelectRemindMode(opt.value)}
                          className={cn(
                            'flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors',
                            active
                              ? 'bg-primary-soft/75 text-primary-ink'
                              : 'hover:bg-surface-sunken text-foreground',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-caption font-bold">{opt.label}</p>
                            <p className="text-tiny text-muted mt-0.5">{opt.description}</p>
                          </div>
                          {active && (
                            <Icon
                              name="check"
                              size={15}
                              strokeWidth={2.5}
                              className="text-primary mt-0.5 shrink-0"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </Popover>
              }
            />
            {currentRemindMode !== 'off' && prefs.remindAt !== null && remindControl && (
              <li className="px-4 pt-1 pb-3">{remindControl}</li>
            )}
            <MenuItem
              icon="user"
              tone="exercise"
              label="个人资料"
              description="昵称、头像、身高、时区"
              href="/me/profile"
            />
            <MenuItem
              icon="custom"
              tone="custom"
              label="目标设置"
              description="打卡板块、人群档位与达标规则"
              href="/goals"
            />
          </MenuList>

          <MenuList title="账号">
            <MenuItem
              icon="download"
              label="导出我的数据"
              description="JSON 文件"
              onClick={onExport}
            />
            <MenuItem
              icon="heart"
              tone="custom"
              label="关于 DayDayOn"
              description="介绍页与 App 下载"
              href="/welcome"
            />
            {onCheckUpdate && (
              <MenuItem
                icon={checkingUpdate ? 'loader' : 'sparkles'}
                label={checkingUpdate ? '正在检查更新…' : '检查更新'}
                description={appVersion ? `当前版本 v${appVersion}` : undefined}
                onClick={onCheckUpdate}
              />
            )}
            <MenuItem icon="link" label="隐私说明" href="/privacy" />
            <MenuItem
              icon="shield"
              tone="exercise"
              label="权限管理"
              description="相机、相册、计步器与本地闹钟权限"
              onClick={() => setPermissionsOpen(true)}
            />
            <MenuItem icon="trash" label="注销账号" danger onClick={onDelete} />
            <MenuItem icon="x" label="退出登录" danger onClick={onSignOut} />
          </MenuList>
        </div>
      </div>

      <Sheet
        open={themeSheetOpen}
        onOpenChange={setThemeSheetOpen}
        title="选择主题色"
        description="切换应用全局主色调与强调色"
      >
        <MenuList>
          {themes.map((t) => {
            const active = t.id === prefs.theme
            return (
              <MenuItem
                key={t.id}
                leading={
                  <span
                    data-theme={t.id}
                    className="bg-primary text-on-primary ring-border flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-2"
                  >
                    {active ? (
                      <Icon name="check" size={14} strokeWidth={2.8} />
                    ) : (
                      <span className="size-2.5 rounded-full bg-white/60" />
                    )}
                  </span>
                }
                label={t.label}
                description={t.note}
                trailing={active ? <Badge tone="primary">使用中</Badge> : undefined}
                onClick={() => {
                  onPreferencesChange({ theme: t.id })
                  setThemeSheetOpen(false)
                }}
              />
            )
          })}
        </MenuList>
      </Sheet>

      <Sheet
        open={mascotSheetOpen}
        onOpenChange={setMascotSheetOpen}
        title="选择陪伴宠物"
        description="选一只喜欢的小伙伴陪你打卡"
      >
        <MenuList>
          {mascotCharacters.map((c) => {
            const active = c.id === prefs.mascot
            return (
              <MenuItem
                key={c.id}
                leading={
                  <span className="bg-surface-sunken ring-border flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
                    <Mascot size={36} character={c.id} />
                  </span>
                }
                label={c.name}
                description={c.note}
                trailing={active ? <Badge tone="primary">使用中</Badge> : undefined}
                onClick={() => {
                  onPreferencesChange({ mascot: c.id })
                  setMascotSheetOpen(false)
                }}
              />
            )
          })}
        </MenuList>
      </Sheet>

      <PermissionsSheet open={permissionsOpen} onOpenChange={setPermissionsOpen} />
    </>
  )
}
