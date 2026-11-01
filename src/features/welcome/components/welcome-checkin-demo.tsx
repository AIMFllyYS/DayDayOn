'use client'

import { useState } from 'react'
import { WeekHeatmap, type WeekHeatmapRow } from '@/components/charts/week-heatmap'
import { Mascot } from '@/components/mascot/mascot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import { useWelcomeMascot } from './mascot-context'
import { WelcomeSection } from './welcome-section'

/*
 * "试着打一次卡"演示：每点一次，热力图按顺序亮一格、盖一个章、团团欢呼。
 * 演示用固定的一周（不取当前日期，避免服务端和浏览器渲染出不同的日子），状态只在组件里。
 */

const DAYS = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
] as const
const ROWS: ModuleTone[] = ['exercise', 'diet', 'sleep', 'study']

/** 第 n 次打卡点亮哪一格：先一列一列往后走，像真的一天天坚持下来 */
function cellOf(n: number): { row: number; day: number } {
  return { row: n % ROWS.length, day: Math.floor(n / ROWS.length) }
}

const TOTAL = ROWS.length * DAYS.length

export function WelcomeCheckinDemo() {
  const { character } = useWelcomeMascot()
  const [count, setCount] = useState(0)

  const rows: WeekHeatmapRow[] = ROWS.map((module, r) => ({
    module,
    cells: DAYS.map((_, d) => (d * ROWS.length + r < count ? 1 : 0)),
  }))
  const next = cellOf(count)
  const nextModule = ROWS[next.row] ?? 'exercise'
  const full = count >= TOTAL
  const streak = Math.floor(count / ROWS.length)

  return (
    <WelcomeSection
      id="checkin"
      ann="welcome.checkin"
      eyebrow="试一试"
      title="打卡就像在手账上盖个章"
      description="完成一项就点一下。热力图一格格亮起来，连续天数往上涨。"
    >
      <Card variant="sticker" className="grid gap-5 @2xl:grid-cols-[220px_1fr] @2xl:items-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <Mascot mood={count > 0 ? 'cheer' : 'happy'} size={96} character={character} />
            {count > 0 && (
              <Stamp
                key={count}
                animate
                size={56}
                tone={ROWS[cellOf(count - 1).row]}
                caption={`11.${2 + cellOf(count - 1).day}`}
                className="absolute -top-2 -right-10"
              />
            )}
          </div>
          <Badge tone="primary" icon="flame">
            {streak > 0 ? `连续 ${streak} 天全勤` : '还没有开始'}
          </Badge>
          {full ? (
            <Button variant="soft" icon="undo" onClick={() => setCount(0)}>
              再来一遍
            </Button>
          ) : (
            <Button icon="check" onClick={() => setCount((c) => c + 1)}>
              打卡：{moduleMeta[nextModule].label}
            </Button>
          )}
        </div>
        <WeekHeatmap days={DAYS} rows={rows} label="演示：本周打卡热力图" />
      </Card>
    </WelcomeSection>
  )
}
