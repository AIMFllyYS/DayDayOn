import type { Metadata } from 'next'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Mascot } from '@/components/mascot/mascot'
import { ProgressBar, ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, moduleTones, type ModuleTone } from '@/components/ui/tone'
import { PageHeader, Section } from './_components/section'

// 和 layout 同一层的 page 不套用 layout 的 title.template，所以写完整标题
export const metadata: Metadata = { title: { absolute: '总览 · Playbook · DayDayOn' } }

const principles = [
  {
    icon: 'study',
    tone: 'diet',
    title: '像手账一样温柔',
    body: '奶油纸底 + 点阵底纹，重点卡片像贴纸，打卡成功盖一个章。不用纯白、纯黑和硬阴影。',
  },
  {
    icon: 'custom',
    tone: 'custom',
    title: '一眼认出板块',
    body: '运动、饮食、睡眠、学习、自定义各有一种马卡龙色和图标，全站固定，不挪作他用。',
  },
  {
    icon: 'bolt',
    tone: 'exercise',
    title: '轻轻回弹',
    body: '按下缩小、松开回弹；进场淡入上浮。动效短（≤360ms），庆祝时刻才用长动画。',
  },
  {
    icon: 'bulb',
    tone: 'sleep',
    title: 'AI 只出草稿',
    body: 'AI 的推理和工具调用对用户可见；识别结果先是草稿，用户确认后才记录。',
  },
] as const

const today: { tone: ModuleTone; value: number; max: number; text: string }[] = [
  { tone: 'exercise', value: 32, max: 30, text: '32 / 30 分钟' },
  { tone: 'diet', value: 2, max: 3, text: '2 / 3 餐' },
  { tone: 'sleep', value: 7.2, max: 8, text: '7.2 / 8 小时' },
  { tone: 'study', value: 1, max: 2, text: '1 / 2 项' },
]

const layers = [
  {
    name: '设计 token',
    path: 'src/app/globals.css',
    body: '颜色、字号、圆角、阴影、缓动、动画预设',
  },
  { name: '原子组件', path: 'src/components/ui/', body: '无业务逻辑：按钮、卡片、进度、弹层…' },
  { name: '布局组件', path: 'src/components/layout/', body: '应用外壳：底栏、侧栏、顶栏' },
  {
    name: '领域组件',
    path: 'src/features/<领域>/components/',
    body: '带业务含义：Agent、打卡、目标…',
  },
  { name: '页面', path: 'src/app/(app)/…', body: '只做组合，不写样式细节' },
]

export default function PlaybookHomePage() {
  return (
    <>
      <PageHeader
        title="治愈手账"
        description="DayDayOn 的视觉方向：把每天的打卡做成一本和朋友一起写的手账。这里是全站可复用设计的唯一来源。"
        docRef="ui-design-system.md"
      />

      <Section ann="playbook.home.principles" title="设计原则">
        <div className="grid gap-3 sm:grid-cols-2">
          {principles.map((p, i) => (
            <Card
              key={p.title}
              className="animate-fade-up flex gap-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <IconTile icon={p.icon} tone={p.tone} />
              <div>
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-caption text-muted">{p.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        ann="playbook.home.preview"
        title="组合预览"
        description="用现有原子组件拼出的「今日」卡片，检验 token 和组件放在一起是否协调。"
      >
        <Card variant="sticker" className="relative max-w-md overflow-hidden">
          <div className="flex items-start gap-4">
            <ProgressRing value={3} max={4} size={84} thickness={9} label="今日完成度">
              <span className="font-display text-heading font-semibold">75%</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-tiny text-muted font-semibold">10 月 31 日 · 周六</p>
              <h3 className="text-heading font-bold">今天也在好好生活</h3>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone="primary" icon="flame">
                  连续 12 天
                </Badge>
                <AvatarStack names={['小满', '阿柚', '豆豆', '七七', '南风']} max={3} />
              </div>
            </div>
          </div>
          <ul className="mt-4 grid gap-2.5">
            {today.map((t) => (
              <li key={t.tone} className="flex items-center gap-2.5">
                <IconTile icon={moduleMeta[t.tone].icon} tone={t.tone} size="sm" />
                <span className="text-caption w-10 font-semibold">{moduleMeta[t.tone].label}</span>
                <ProgressBar
                  value={t.value}
                  max={t.max}
                  tone={t.tone}
                  label={moduleMeta[t.tone].label}
                  className="flex-1"
                />
                <span className="font-display text-tiny text-muted w-24 text-right">{t.text}</span>
              </li>
            ))}
          </ul>
          <Stamp caption="10.31" tone="exercise" size={76} className="absolute top-3 right-3" />
        </Card>
      </Section>

      <Section ann="playbook.home.modules" title="五个板块">
        <div className="flex flex-wrap gap-2">
          {moduleTones.map((t) => (
            <Badge key={t} tone={t} icon={moduleMeta[t].icon} size="md">
              {moduleMeta[t].label}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        ann="playbook.home.layers"
        title="组件分层"
        description="上层只能引用下层。页面里出现重复的样式组合时，先下沉成组件并在 Playbook 登记。"
      >
        <ol className="grid gap-2">
          {layers.map((l, i) => (
            <li
              key={l.name}
              className="bg-surface shadow-soft flex items-center gap-3 rounded-2xl p-3"
            >
              <span className="bg-primary-soft font-display text-primary-ink flex size-8 shrink-0 items-center justify-center rounded-full font-semibold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{l.name}</span>
                <span className="text-tiny text-muted ml-2 font-mono">{l.path}</span>
                <span className="text-caption text-muted block">{l.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section ann="playbook.home.workflow" title="设计迭代流程">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Mascot mood="cheer" size={88} floating />
          <ol className="text-caption grid flex-1 gap-2">
            {[
              '在 Playbook 里新增或修改组件演示',
              '点右下角「批注」，在区块上写修改意见',
              '在批注列表里「导出 JSON」，放进 docs/designs/reviews/',
              '按 JSON 逐条修改，修完在列表里标记解决',
              '定稿后再用到正式页面',
            ].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <Icon name="check" size={16} className={i < 4 ? 'text-success' : 'text-primary'} />
                {s}
              </li>
            ))}
          </ol>
        </div>
      </Section>
    </>
  )
}
