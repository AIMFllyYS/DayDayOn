'use client'

import { useState } from 'react'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { MeView } from '@/features/me/components/me-view'
import type { Me } from '@/features/me/schemas'
import { isThemeId, setTheme, useTheme } from '@/lib/theme'

/*
 * 我的：渲染正式组件 MeView（features/me），配演示数据。
 * 这里改主题色会改整个 Playbook（演示用）；其余操作只改本地状态。
 */
const DEMO: Me = {
  userId: 'demo',
  email: 'xiaoman@hust.edu.cn',
  role: 'user',
  twoFactorEnabled: false,
  onboarded: true,
  profile: {
    nickname: '小满',
    avatar: 'mascot:tuan:cheer:exercise',
    gender: null,
    birthYear: null,
    heightCm: null,
    timeZone: 'Asia/Shanghai',
  },
  preferences: {
    theme: 'caramel',
    mascot: 'tuan',
    leaderboardOptIn: true,
    dayStartHour: 4,
    remindAt: '21:00',
  },
  streak: 12,
  createdAt: '2026-09-16T00:00:00.000Z',
}

export function MeScreen({ thumb = false }: { thumb?: boolean }) {
  const theme = useTheme()
  const [me, setMe] = useState<Me>(DEMO)
  return (
    <MeView
      thumb={thumb}
      me={{ ...me, preferences: { ...me.preferences, theme } }}
      quota={<QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} />}
      onPreferencesChange={(patch) => {
        if (patch.theme && isThemeId(patch.theme)) setTheme(patch.theme)
        setMe((m) => ({ ...m, preferences: { ...m.preferences, ...patch } }))
      }}
      onExport={() => {}}
      onDelete={() => {}}
      onSignOut={() => {}}
    />
  )
}
