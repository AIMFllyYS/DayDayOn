import { AvatarStack } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressBar, ProgressRing, StepProgress } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'

/*
 * 主页（仪表盘，固定布局，ADR-0003 第 4 项）。演示数据，不接后端。
 * 区块顺序：今日总览（贴纸卡）→ 各板块进度 → 每日指标 → 朋友动态。
 */
const today: { tone: ModuleTone; value: number; max: number; text: string }[] = [
  { tone: 'exercise', value: 32, max: 30, text: '32 / 30 分钟' },
  { tone: 'diet', value: 2, max: 3, text: '2 / 3 餐' },
  { tone: 'sleep', value: 7.2, max: 8, text: '7.2 / 8 小时' },
  { tone: 'study', value: 1, max: 2, text: '1 / 2 项' },
]

const feed = [
  { name: '阿柚', tone: 'exercise', text: '完成了晨跑 5km', time: '07:42' },
  { name: '豆豆', tone: 'study', text: '背完 60 个单词', time: '09:15' },
  { name: '七七', tone: 'sleep', text: '连续早睡第 7 天', time: '昨天' },
] as const

export function HomeScreen() {
  return (
    <div className="grid gap-3 @xl:grid-cols-[1.25fr_1fr] @xl:gap-4">
      <div className="grid content-start gap-3">
        <Card variant="sticker" className="relative overflow-hidden">
          <div className="flex items-start gap-4">
            <ProgressRing value={3} max={4} size={84} thickness={9} label="今日完成度">
              <span className="font-display text-heading font-semibold">75%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1 pr-14">
              <h2 className="text-heading font-bold">今天也在好好生活</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="primary" icon="flame">
                  连续 12 天
                </Badge>
                <AvatarStack names={['小满', '阿柚', '豆豆', '七七', '南风']} max={3} />
              </div>
            </div>
          </div>
          <Stamp caption="11.01" tone="exercise" size={64} className="absolute top-3 right-3" />
        </Card>

        <Card>
          <CardHeader title="今日进度" description="点一项继续打卡">
            <Icon name="chevron-right" size={18} className="text-subtle" />
          </CardHeader>
          <ul className="grid gap-3">
            {today.map((t) => (
              <li key={t.tone} className="flex items-center gap-2.5">
                <IconTile icon={moduleMeta[t.tone].icon} tone={t.tone} size="sm" />
                <span className="text-caption w-10 shrink-0 font-semibold">
                  {moduleMeta[t.tone].label}
                </span>
                <ProgressBar
                  value={t.value}
                  max={t.max}
                  tone={t.tone}
                  label={moduleMeta[t.tone].label}
                  className="flex-1"
                />
                <span className="font-display text-tiny text-muted w-22 shrink-0 text-right tabular-nums">
                  {t.text}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid content-start gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Card className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">今日体重</span>
            <span className="font-display text-title font-semibold tabular-nums">
              52.4<span className="text-caption text-muted ml-0.5">kg</span>
            </span>
            <span className="text-tiny text-success-ink">比上周 −0.6</span>
          </Card>
          <Card className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">今日心情</span>
            <span className="font-display text-title font-semibold">不错</span>
            <span className="text-tiny text-muted">4 / 5 · 已记录</span>
          </Card>
        </div>

        <Card>
          <CardHeader title="饮水" description="自定义目标 · 每天 8 杯" />
          <StepProgress total={8} done={5} tone="custom" label="今日饮水" />
        </Card>

        <Card>
          <CardHeader title="朋友动态" />
          <ul className="grid gap-2.5">
            {feed.map((f) => (
              <li key={f.name} className="flex items-center gap-2.5">
                <IconTile icon={moduleMeta[f.tone].icon} tone={f.tone} size="sm" />
                <span className="text-caption min-w-0 flex-1 truncate">
                  <span className="font-semibold">{f.name}</span> {f.text}
                </span>
                <span className="text-tiny text-muted shrink-0">{f.time}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
