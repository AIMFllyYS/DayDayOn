'use client'

import { useState } from 'react'
import { InteractivePet } from '@/components/mascot/interactive-pet'
import { Mascot } from '@/components/mascot/mascot'
import { mascotCharacters, type MascotCharacter } from '@/components/mascot/mascot-svg'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { ThemePicker } from '@/components/ui/theme-picker'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { setTheme, useTheme } from '@/lib/theme'

/*
 * 我的：互动版吉祥物只出现在这一页（ui-design-system.md 第 9 节）。
 * 外观分组里可以选主题色和形象；这里改主题色会改整个 Playbook（演示用）。
 */
export function MeScreen({ thumb = false }: { thumb?: boolean }) {
  const theme = useTheme()
  const [character, setCharacter] = useState<MascotCharacter>('tuan')
  const [remind, setRemind] = useState(true)
  const [publicRank, setPublicRank] = useState(true)

  return (
    <div className="grid gap-4 @xl:grid-cols-[1fr_1.2fr] @xl:items-start">
      <div className="grid gap-3">
        <Card variant="sticker" className="flex flex-col items-center gap-1 pt-10 text-center">
          {thumb ? (
            <Mascot size={120} character={character} />
          ) : (
            <InteractivePet size={120} character={character} idleSleepMs={0} />
          )}
          <p className="text-heading mt-1 font-bold">小满</p>
          <p className="text-caption text-muted">和 5 位朋友一起打卡 · 第 46 天</p>
          <div className="mt-1.5 flex gap-1.5">
            <Badge tone="primary" icon="flame">
              连续 12 天
            </Badge>
            <Badge tone="success" dot>
              已上榜
            </Badge>
          </div>
        </Card>
        <QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} />
      </div>

      <div className="grid gap-4">
        <MenuList title="外观">
          <li className="flex flex-col gap-2 px-4 py-3">
            <span className="font-semibold">主题色</span>
            <ThemePicker value={theme} onValueChange={setTheme} />
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 font-semibold">陪伴的小伙伴</span>
            <SegmentedControl
              options={mascotCharacters.map((c) => ({ value: c.id, label: c.name }))}
              value={character}
              onValueChange={setCharacter}
              label="选择形象"
              size="sm"
              className="w-40"
            />
          </li>
        </MenuList>

        <MenuList title="偏好设置">
          <MenuItem
            icon="bell"
            tone="primary"
            label="打卡提醒"
            description="每天 21:00"
            trailing={<Switch checked={remind} onCheckedChange={setRemind} label="打卡提醒" />}
          />
          <MenuItem
            icon="trophy"
            tone="diet"
            label="公开到排行榜"
            description="只公开打卡天数"
            trailing={
              <Switch checked={publicRank} onCheckedChange={setPublicRank} label="公开到排行榜" />
            }
          />
          <MenuItem
            icon="user"
            tone="sleep"
            label="个人资料"
            description="身高、体重、时区"
            onClick={() => {}}
          />
        </MenuList>

        <MenuList title="账号">
          <MenuItem icon="download" label="导出我的数据" onClick={() => {}} />
          <MenuItem icon="x" label="退出登录" danger onClick={() => {}} />
        </MenuList>
      </div>
    </div>
  )
}
