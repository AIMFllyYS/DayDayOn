'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, type ReactNode } from 'react'
import { InteractivePet } from '@/components/mascot/interactive-pet'
import { Mascot } from '@/components/mascot/mascot'
import { mascotCharacters } from '@/components/mascot/mascot-svg'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import type { SelectOption } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import type { Me, RemindMode, UpdatePreferences } from '@/features/me/schemas'
import { cn } from '@/lib/cn'
import {
  getNativePermissions,
  isNativeApp,
  openNativeNotificationSettings,
  requestNativePermission,
  sendNativeTestNotification,
  syncNativeReminder,
  type PermissionStateValue,
} from '@/lib/native'
import { themes } from '@/lib/theme'
import { DAY_START_OPTIONS } from '../units'
import { PermissionsManagerList } from './permissions-sheet'

/*
 * 「我的」页展示层（PRD 2.11，多级分组架构）：
 * - 一级页聚焦个人状态卡、AI 额度卡与清晰的三大设置分组入口，避免单页堆砌过多表单控件；
 * - 二级页（「打卡与提醒」「外观与陪伴」「权限管理」「数据与关于」「账号与安全」）按需深入，支持手机侧滑返回；
 * - 选择「手机提醒」时自动校验通知权限并同步安卓系统定时推送，支持一键发送测试通知。
 */

const SelectRemindMode = dynamic(
  () => import('@/components/ui/select').then((m) => m.Select<RemindMode>),
  { loading: () => <Skeleton className="h-12 w-full rounded-xl" /> },
)

const SelectDayStart = dynamic(
  () => import('@/components/ui/select').then((m) => m.Select<string>),
  { loading: () => <Skeleton className="h-10 w-32 rounded-xl" /> },
)

export type MeSubSection = 'checkin' | 'appearance' | 'permissions' | 'about' | 'account'

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
  /** 「数据与关于」里的检查更新（features/app-update）；不传就不显示这一行（Playbook 预览） */
  onCheckUpdate?: () => void
  checkingUpdate?: boolean
  /** 当前版本，显示在检查更新下面 */
  appVersion?: string
  exporting?: boolean
  thumb?: boolean
}

const REMIND_MODE_OPTIONS: readonly SelectOption<RemindMode>[] = [
  {
    value: 'in-app',
    label: '应用内提醒',
    description: '每天过提醒时间后，在主页顶部与消息中心温和提示',
  },
  {
    value: 'native',
    label: '手机提醒',
    description: '按设定时间向手机状态栏推送打卡提醒通知',
  },
  {
    value: 'off',
    label: '关闭提醒',
    description: '不展示打卡提醒横幅，也不推送系统通知',
  },
]

const SECTION_META: Record<MeSubSection, { title: string; subtitle: string }> = {
  checkin: {
    title: '打卡与提醒',
    subtitle: '设置每日打卡提醒方式、推送时间、作息切日与排行公开',
  },
  appearance: {
    title: '外观与陪伴',
    subtitle: '挑选顺眼的主题配色与陪你打卡的小伙伴',
  },
  permissions: {
    title: '权限管理',
    subtitle: '查看并管理相机、相册、运动步数与系统通知授权',
  },
  about: {
    title: '数据与关于',
    subtitle: '个人数据导出、版本检查更新与隐私承诺',
  },
  account: {
    title: '账号与安全',
    subtitle: '管理当前登录状态与账号数据生命周期',
  },
}

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
  const [activeSection, setActiveSection] = useState<MeSubSection | null>(null)
  const [notifPerm, setNotifPerm] = useState<PermissionStateValue>('prompt')
  const [testingPush, setTestingPush] = useState(false)

  const currentTheme = themes.find((t) => t.id === prefs.theme) ?? themes[0]
  const currentMascot = mascotCharacters.find((c) => c.id === prefs.mascot) ?? mascotCharacters[0]
  const currentRemindMode: RemindMode =
    prefs.remindMode ?? (prefs.remindAt !== null ? 'in-app' : 'off')
  const currentRemindOption =
    REMIND_MODE_OPTIONS.find((o) => o.value === currentRemindMode) ?? REMIND_MODE_OPTIONS[2]
  const remindSummary =
    currentRemindMode === 'off'
      ? '已关闭'
      : `${currentRemindOption?.label ?? '已开启'} · ${prefs.remindAt ?? '21:00'}`
  const shortVersion = appVersion ? `v${appVersion.split(' ')[0]}` : undefined

  // 二级菜单支持浏览器与手机端侧滑返回
  useEffect(() => {
    if (thumb) return
    function onPopState(e: PopStateEvent) {
      const state = e.state as { ddoMeSection?: MeSubSection } | null
      setActiveSection(state?.ddoMeSection ?? null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [thumb])

  // 进入「打卡与提醒」二级页或处于手机提醒模式时，实时同步通知权限状态
  useEffect(() => {
    if (thumb || (activeSection !== 'checkin' && currentRemindMode !== 'native')) return
    let cancelled = false
    async function refreshNotifPerm() {
      const perms = await getNativePermissions()
      if (!cancelled) setNotifPerm(perms.notifications)
    }
    void refreshNotifPerm()
    const onFocus = () => void refreshNotifPerm()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [activeSection, currentRemindMode, thumb])

  function openSection(next: MeSubSection) {
    setActiveSection(next)
    if (!thumb && typeof window !== 'undefined') {
      window.history.pushState({ ...(window.history.state ?? {}), ddoMeSection: next }, '')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }

  function closeSection() {
    const state =
      typeof window !== 'undefined'
        ? (window.history.state as { ddoMeSection?: string } | null)
        : null
    if (!thumb && state?.ddoMeSection) {
      window.history.back()
      return
    }
    setActiveSection(null)
  }

  async function handleSelectRemindMode(nextMode: RemindMode) {
    const nextTime = nextMode === 'off' ? null : (prefs.remindAt ?? '21:00')
    onPreferencesChange({ remindMode: nextMode, remindAt: nextTime })

    if (nextMode === 'native') {
      if (isNativeApp()) {
        const ok = await syncNativeReminder({ enabled: true, remindAt: nextTime })
        const perms = await getNativePermissions()
        setNotifPerm(perms.notifications)
        if (ok) {
          toast.success(`已开启手机打卡提醒（每天 ${nextTime}）`)
        } else {
          toast.error('通知权限未开启，暂时无法推送提醒', {
            description: '请点击下方「开启通知权限」允许系统通知后再试',
          })
        }
      } else {
        const perm = await requestNativePermission('notifications')
        setNotifPerm(perm)
        if (perm === 'denied') {
          toast.error('通知权限未开启', {
            description: '请在浏览器站点设置或手机客户端中允许通知权限',
          })
        } else {
          toast.info(`已设为手机提醒（每天 ${nextTime}）`, {
            description: '在安卓客户端内将按设定时间准时推送系统通知',
          })
        }
      }
    } else if (nextMode === 'in-app') {
      await syncNativeReminder({ enabled: false, remindAt: nextTime })
      toast.success(`已开启应用内提醒（每天 ${nextTime}）`)
    } else {
      await syncNativeReminder({ enabled: false, remindAt: null })
      toast.info('已关闭打卡提醒')
    }
  }

  async function handleEnableNotifPermission() {
    const native = isNativeApp()
    if (notifPerm === 'denied' && native) {
      openNativeNotificationSettings()
      return
    }
    const nextPerm = await requestNativePermission('notifications')
    setNotifPerm(nextPerm)
    if (nextPerm === 'granted') {
      const remindAt = prefs.remindAt ?? '21:00'
      await syncNativeReminder({ enabled: currentRemindMode === 'native', remindAt })
      toast.success('通知权限已开启')
    } else if (nextPerm === 'denied') {
      toast.error('通知权限仍未开启', {
        description: native
          ? '即将可在系统通知设置中手动打开'
          : '请在浏览器地址栏站点设置中开启通知',
      })
    }
  }

  async function handleTestPush() {
    setTestingPush(true)
    try {
      const sent = await sendNativeTestNotification(
        '团团提醒你打卡啦～',
        `这是一条测试提醒，每天 ${prefs.remindAt ?? '21:00'} 会这样提醒你打卡！`,
      )
      const perms = await getNativePermissions()
      setNotifPerm(perms.notifications)
      if (sent) {
        toast.success('测试通知已发送，请查看状态栏')
      } else if (!isNativeApp() && !('Notification' in window)) {
        toast.info('当前环境不支持系统通知，请在手机客户端内测试')
      } else {
        toast.error('未能发送通知，请先开启通知权限')
      }
    } finally {
      setTestingPush(false)
    }
  }

  const sectionMeta = activeSection ? SECTION_META[activeSection] : null

  return (
    <div className="grid w-full max-w-full min-w-0 gap-4 pb-6 @xl:grid-cols-[1fr_1.25fr] @xl:items-start">
      {/* 左侧个人卡片与额度概览：手机端进入二级菜单时自动收起，桌面宽屏常驻对照 */}
      <div className={cn('grid w-full min-w-0 gap-3', activeSection && 'hidden @xl:grid')}>
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

      {/* 右侧主区域：一级分组目录 <-> 二级设置详情页 */}
      <div className="grid w-full min-w-0 gap-4">
        {!activeSection ? (
          <>
            <MenuList title="打卡与目标">
              <MenuItem
                icon="custom"
                tone="custom"
                label="目标设置"
                description="打卡板块、人群档位与达标规则"
                href="/goals"
              />
              <MenuItem
                icon="bell"
                tone="primary"
                label="打卡与提醒"
                description="提醒方式、每日推送时间、日切换与排行"
                value={remindSummary}
                onClick={() => openSection('checkin')}
              />
            </MenuList>

            <MenuList title="个性化与资料">
              <MenuItem
                leading={
                  <span
                    data-theme={prefs.theme}
                    className="bg-primary ring-border flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-2"
                  >
                    <span className="size-2.5 rounded-full bg-white/60" />
                  </span>
                }
                label="外观与陪伴"
                description="全局主题配色与陪伴小伙伴"
                value={`${currentTheme.label} · ${currentMascot.name}`}
                onClick={() => openSection('appearance')}
              />
              <MenuItem
                icon="user"
                tone="exercise"
                label="个人资料"
                description="昵称、预设头像、身高与所在时区"
                href="/me/profile"
              />
            </MenuList>

            <MenuList title="系统、数据与账号">
              <MenuItem
                icon="shield"
                tone="study"
                label="权限管理"
                description="相机、相册、步数记录与系统通知授权"
                onClick={() => openSection('permissions')}
              />
              <MenuItem
                icon="heart"
                tone="sleep"
                label="数据与关于"
                description="导出个人数据、检查更新与隐私说明"
                value={shortVersion}
                onClick={() => openSection('about')}
              />
              <MenuItem
                icon="sliders"
                tone="neutral"
                label="账号与安全"
                description="登录账号信息、退出登录与账号注销"
                onClick={() => openSection('account')}
              />
            </MenuList>
          </>
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-4">
            {/* 二级页面统一返回导航栏 */}
            <div className="border-border bg-surface shadow-soft flex items-center gap-2.5 rounded-2xl border px-3 py-2.5">
              <IconButton
                icon="chevron-left"
                label="返回我的主页"
                variant="ghost"
                size="sm"
                onClick={closeSection}
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-subhead truncate font-bold">{sectionMeta?.title}</h2>
                {sectionMeta?.subtitle && (
                  <p className="text-tiny text-muted truncate">{sectionMeta.subtitle}</p>
                )}
              </div>
            </div>

            {activeSection === 'checkin' && (
              <>
                <Card className="flex flex-col gap-4 p-4">
                  <Field
                    label="打卡提醒方式"
                    htmlFor="me-remind-mode"
                    hint="选择「手机提醒」后，客户端将在每天设定时间推送系统通知"
                  >
                    <SelectRemindMode
                      id="me-remind-mode"
                      label="打卡提醒方式"
                      options={REMIND_MODE_OPTIONS}
                      value={currentRemindMode}
                      onValueChange={(nextMode) => void handleSelectRemindMode(nextMode)}
                    />
                  </Field>

                  {currentRemindMode !== 'off' && prefs.remindAt !== null && remindControl && (
                    <div>{remindControl}</div>
                  )}

                  {currentRemindMode === 'native' && (
                    <div className="border-border bg-surface-sunken/70 flex flex-col gap-2.5 rounded-xl border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon name="bell" size={16} className="text-primary shrink-0" />
                          <span className="text-caption font-semibold">系统通知状态</span>
                          {notifPerm === 'granted' ? (
                            <Badge tone="success">已授权</Badge>
                          ) : (
                            <Badge tone="warning">未开启</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {notifPerm !== 'granted' && (
                            <Button
                              size="sm"
                              variant="soft"
                              onClick={() => void handleEnableNotifPermission()}
                            >
                              {notifPerm === 'denied' && isNativeApp()
                                ? '去设置开启'
                                : '开启通知权限'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={testingPush}
                            onClick={() => void handleTestPush()}
                          >
                            发送测试通知
                          </Button>
                        </div>
                      </div>
                      <p className="text-tiny text-muted leading-relaxed">
                        {notifPerm === 'granted'
                          ? `通知通道已就绪，每天 ${prefs.remindAt ?? '21:00'} 将准时向状态栏推送提醒。`
                          : '需要先允许系统通知权限，手机才能在设定时间弹出打卡提醒。'}
                      </p>
                    </div>
                  )}
                </Card>

                <MenuList title="作息与排行">
                  <MenuItem
                    icon="clock"
                    tone="sleep"
                    label="日切换时间"
                    description="这个时间之前完成的打卡归入前一天"
                    control={
                      <SelectDayStart
                        label="日切换时间"
                        options={DAY_START_OPTIONS}
                        value={String(prefs.dayStartHour)}
                        onValueChange={(v) => onPreferencesChange({ dayStartHour: Number(v) })}
                        className="text-caption h-10 w-32 shrink-0 px-3 sm:w-36"
                      />
                    }
                  />
                  <MenuItem
                    icon="trophy"
                    tone="diet"
                    label="加入排行榜"
                    description="仅向好友与榜单展示昵称、头像和连续打卡天数"
                    control={
                      <Switch
                        checked={prefs.leaderboardOptIn}
                        onCheckedChange={(leaderboardOptIn) =>
                          onPreferencesChange({ leaderboardOptIn })
                        }
                        label="加入排行榜"
                      />
                    }
                  />
                </MenuList>
              </>
            )}

            {activeSection === 'appearance' && (
              <>
                <MenuList title="主题色">
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
                        onClick={() => onPreferencesChange({ theme: t.id })}
                      />
                    )
                  })}
                </MenuList>

                <MenuList title="陪伴伙伴">
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
                        onClick={() => onPreferencesChange({ mascot: c.id })}
                      />
                    )
                  })}
                </MenuList>
              </>
            )}

            {activeSection === 'permissions' && <PermissionsManagerList active />}

            {activeSection === 'about' && (
              <MenuList title="数据与客户端">
                <MenuItem
                  icon="download"
                  tone="study"
                  label="导出我的数据"
                  description="下载包含目标、打卡与指标记录的 JSON 文件"
                  onClick={onExport}
                />
                {onCheckUpdate && (
                  <MenuItem
                    icon={checkingUpdate ? 'loader' : 'sparkles'}
                    tone="primary"
                    label={checkingUpdate ? '正在检查更新…' : '检查版本更新'}
                    description={appVersion ? `当前版本 v${appVersion}` : undefined}
                    onClick={onCheckUpdate}
                  />
                )}
                <MenuItem
                  icon="heart"
                  tone="custom"
                  label="关于 DayDayOn"
                  description="产品介绍与安卓客户端下载"
                  href="/welcome"
                />
                <MenuItem
                  icon="link"
                  tone="sleep"
                  label="隐私说明"
                  description="了解数据存储边界与图片内存即焚机制"
                  href="/privacy"
                />
              </MenuList>
            )}

            {activeSection === 'account' && (
              <>
                <Card className="flex flex-col gap-1 p-4">
                  <span className="text-tiny text-muted font-semibold">当前登录邮箱</span>
                  <p className="text-body font-bold break-all">{me.email}</p>
                  <p className="text-tiny text-muted mt-0.5">
                    退出登录后，下次通过邮箱验证码即可随时回到当前账号。
                  </p>
                </Card>

                <MenuList title="账号操作">
                  <MenuItem
                    icon="x"
                    label="退出登录"
                    description="清除当前设备登录状态"
                    onClick={onSignOut}
                  />
                  <MenuItem
                    icon="trash"
                    label="注销账号"
                    description="永久删除所有目标、打卡、体重与待办数据，不可恢复"
                    danger
                    onClick={onDelete}
                  />
                </MenuList>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
