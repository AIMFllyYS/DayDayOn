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
import { Select } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import type { Me, UpdatePreferences } from '@/features/me/schemas'
import { themes } from '@/lib/theme'
import { DAY_START_OPTIONS } from '../units'

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
  exporting?: boolean
  thumb?: boolean
}

export function MeView({
  me,
  quota,
  onPreferencesChange,
  remindControl,
  onExport,
  onDelete,
  onSignOut,
  thumb = false,
}: MeViewProps) {
  const { preferences: prefs, profile } = me
  const nickname = profile.nickname ?? '新朋友'
  const [themeSheetOpen, setThemeSheetOpen] = useState(false)
  const [mascotSheetOpen, setMascotSheetOpen] = useState(false)
  const currentTheme = themes.find((t) => t.id === prefs.theme) ?? themes[0]
  const currentMascot = mascotCharacters.find((c) => c.id === prefs.mascot) ?? mascotCharacters[0]

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
                prefs.remindAt ? `每天 ${prefs.remindAt} 后在主页提醒` : '只在应用里提示，不发消息'
              }
              trailing={
                <Switch
                  checked={prefs.remindAt !== null}
                  onCheckedChange={(on) => onPreferencesChange({ remindAt: on ? '21:00' : null })}
                  label="打卡提醒"
                />
              }
            />
            {prefs.remindAt !== null && remindControl && (
              <li className="px-4 pt-1 pb-3">{remindControl}</li>
            )}
            <MenuItem
              icon="user"
              tone="exercise"
              label="个人资料"
              description="昵称、头像、身高、时区"
              href="/me/profile"
            />
            <MenuItem icon="custom" tone="custom" label="我的目标" href="/goals" />
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
            <MenuItem icon="link" label="隐私说明" href="/privacy" />
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
    </>
  )
}
