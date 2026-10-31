import type { Metadata } from 'next'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Mascot } from '@/components/mascot/mascot'
import { ProgressBar, ProgressRing, StepProgress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, moduleTones } from '@/components/ui/tone'
import {
  FieldDemo,
  MenuDemo,
  RatingDemo,
  SegmentedDemo,
  SheetDemo,
  SwitchDemo,
} from '../_components/component-demos'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'

export const metadata: Metadata = { title: '原子组件' }

export default function ComponentsPage() {
  return (
    <>
      <PageHeader
        title="原子组件"
        description="src/components/ui/ 下的无业务组件。页面只组合这些组件，不重新写按钮、卡片、进度条。"
        docRef="ui-design-system.md 第 6 节"
      />

      <Section ann="playbook.components.button" title="按钮">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.components.button.variants"
            label="变体"
            note="一个区域只放一个 primary；危险操作用 danger 并二次确认"
          >
            <Button>确认记录</Button>
            <Button variant="secondary">取消</Button>
            <Button variant="soft">稍后提醒</Button>
            <Button variant="ghost">跳过</Button>
            <Button variant="danger">删除</Button>
          </Specimen>
          <Specimen
            ann="playbook.components.button.sizes"
            label="尺寸与状态"
            note="md（44px）是默认；sm 只用于桌面密集区和卡片内的次要操作"
          >
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg</Button>
            <Button icon="camera" variant="secondary">
              拍照识别
            </Button>
            <Button loading>识别中</Button>
            <Button disabled>不可用</Button>
          </Specimen>
          <Specimen
            ann="playbook.components.button.icon"
            label="图标按钮"
            note="必须传 label；默认 ghost，实底只给唯一的主操作"
          >
            <IconButton icon="bell" label="提醒" />
            <IconButton icon="sliders" label="设置" variant="secondary" />
            <IconButton icon="plus" label="新建" variant="soft" />
            <IconButton icon="plus" label="新建（主操作）" variant="primary" />
            <IconButton icon="x" label="关闭" size="sm" />
          </Specimen>
          <Specimen
            ann="playbook.components.button.usage"
            label="一个区域里的搭配"
            note="主操作一个实底，其余退到 soft / secondary / ghost"
          >
            <div className="flex w-full flex-wrap items-center gap-2">
              <Button icon="check" className="flex-1">
                确认记录
              </Button>
              <Button variant="soft" icon="edit">
                修改
              </Button>
              <Button variant="ghost">稍后</Button>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.badge" title="徽章与图标底座">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen ann="playbook.components.badge.tones" label="Badge" note="soft 底 + ink 字">
            {moduleTones.map((t) => (
              <Badge key={t} tone={t} icon={moduleMeta[t].icon}>
                {moduleMeta[t].label}
              </Badge>
            ))}
            <Badge tone="primary" icon="flame">
              连续 12 天
            </Badge>
            <Badge tone="success" dot>
              已完成
            </Badge>
            <Badge tone="warning" dot>
              待确认
            </Badge>
            <Badge>草稿</Badge>
          </Specimen>
          <Specimen
            ann="playbook.components.badge.tile"
            label="IconTile"
            note="sm 32 / md 40 / lg 48"
          >
            {moduleTones.map((t, i) => (
              <IconTile
                key={t}
                icon={moduleMeta[t].icon}
                tone={t}
                size={(['sm', 'md', 'lg'] as const)[i % 3]}
              />
            ))}
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.card" title="卡片">
        <div className="bg-paper grid gap-4 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-ann="playbook.components.card.plain">
            <CardHeader title="plain" description="默认卡片" />
            <p className="text-caption text-muted">纸面 + card 阴影</p>
          </Card>
          <Card variant="sticker" data-ann="playbook.components.card.sticker">
            <CardHeader title="sticker" description="贴纸卡片" />
            <p className="text-caption text-muted">主页重点，每屏 ≤2 张</p>
          </Card>
          <Card variant="outline" data-ann="playbook.components.card.outline">
            <CardHeader title="outline" description="描边卡片" />
            <p className="text-caption text-muted">列表项、可选项</p>
          </Card>
          <Card variant="sunken" data-ann="playbook.components.card.sunken">
            <CardHeader title="sunken" description="凹陷区" />
            <p className="text-caption text-muted">卡片内分组</p>
          </Card>
        </div>
      </Section>

      <Section ann="playbook.components.progress" title="进度">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.components.progress.bar"
            label="ProgressBar"
            note="sm 6 / md 10 / lg 16px；active 表示正在进行"
          >
            <div className="grid w-full gap-3">
              {moduleTones.map((t, i) => (
                <ProgressBar
                  key={t}
                  value={[80, 66, 90, 40, 20][i] ?? 0}
                  tone={t}
                  label={moduleMeta[t].label}
                  size={(['sm', 'md', 'lg'] as const)[i % 3]}
                />
              ))}
              <ProgressBar value={55} active label="AI 识别中" />
            </div>
          </Specimen>
          <Specimen
            ann="playbook.components.progress.ring"
            label="ProgressRing / StepProgress"
            note="圆环用于完成度；分段用于一天多次的目标（3 餐、8 杯水）"
          >
            <ProgressRing value={75} label="今日完成度">
              <span className="font-display text-subhead font-semibold">75%</span>
            </ProgressRing>
            <ProgressRing value={6} max={8} tone="sleep" size={56} thickness={6} label="睡眠">
              <span className="font-display text-tiny font-semibold">6h</span>
            </ProgressRing>
            <div className="grid w-full gap-2">
              <StepProgress total={3} done={2} tone="diet" label="今日三餐" />
              <StepProgress total={8} done={5} tone="study" label="饮水" />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.form" title="表单">
        <div className="grid gap-3">
          <Specimen
            ann="playbook.components.form.field"
            label="Field / Input / Textarea"
            note="输入框字号固定 16px，避免 iOS 聚焦时放大页面"
          >
            <FieldDemo />
          </Specimen>
          <div className="grid gap-3 md:grid-cols-2">
            <Specimen ann="playbook.components.form.switch" label="Switch" note="外层 44px 触控区">
              <SwitchDemo />
            </Specimen>
            <Specimen
              ann="playbook.components.form.segmented"
              label="SegmentedControl"
              note="页面内视图切换；方向键可切换"
            >
              <SegmentedDemo />
            </Specimen>
          </div>
          <Specimen
            ann="playbook.components.form.rating"
            label="Rating"
            note="满意度 1–5，选中项用板块色。点一下有情绪反馈：很糟抖一下（手机轻震）、不太好摇一摇、一般波浪、不错 / 超棒撒彩纸"
          >
            <RatingDemo />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.menu" title="菜单列表">
        <MenuDemo />
      </Section>

      <Section ann="playbook.components.sheet" title="弹层">
        <Specimen
          ann="playbook.components.sheet.demo"
          label="Sheet"
          note="手机和桌面都从底部向上拉出（桌面收窄、离底 16px），像菜单列表；Esc、点遮罩、关闭按钮都带退场动画"
        >
          <SheetDemo />
        </Specimen>
      </Section>

      <Section ann="playbook.components.identity" title="头像、印章、吉祥物">
        <div className="grid gap-3 md:grid-cols-3">
          <Specimen
            ann="playbook.components.identity.avatar"
            label="Avatar / AvatarStack"
            note="ring 表示连续打卡中"
          >
            <Avatar name="小满" size="lg" ring />
            <Avatar name="阿柚" tone="exercise" />
            <AvatarStack names={['小满', '阿柚', '豆豆', '七七', '南风', '一一']} />
          </Specimen>
          <Specimen
            ann="playbook.components.identity.stamp"
            label="Stamp"
            note="打卡完成的标志，历史记录里静态显示"
            bg="paper"
          >
            <Stamp caption="10.31" />
            <Stamp caption="10.30" tone="sleep" size={72} />
            <Stamp text="补卡" caption="10.29" tone="diet" size={64} />
          </Specimen>
          <Specimen
            ann="playbook.components.identity.mascot"
            label="Mascot · 团团 / 墩墩"
            note="两个形象可选，表情共用；细节见「小宠物」页"
            bg="paper"
          >
            <Mascot mood="happy" size={64} />
            <Mascot mood="cheer" size={64} />
            <Mascot mood="happy" size={64} character="dun" />
            <Mascot mood="cheer" size={64} character="dun" />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.states" title="加载与空状态">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.components.states.skeleton"
            label="Skeleton"
            note="形状接近真实内容，不用转圈代替"
          >
            <div className="flex w-full items-center gap-3">
              <Skeleton className="size-12 rounded-2xl" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </Specimen>
          <Specimen
            ann="playbook.components.states.empty"
            label="空状态"
            note="吉祥物 + 一句话 + 一个主操作"
            bg="paper"
          >
            <div className="flex w-full flex-col items-center gap-2 py-2 text-center">
              <Mascot mood="sleepy" size={72} floating />
              <p className="font-semibold">今天还没有待办</p>
              <p className="text-caption text-muted">写下一件小事，完成后会盖一个章</p>
              <Button size="sm" icon="plus">
                新建待办
              </Button>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.components.rules" title="规则">
        <Rules
          dos={[
            '可点区域 ≥ 44×44px',
            '图标按钮、进度条、开关都有可读名称（label）',
            '颜色只从 tone 取，板块相关的地方用板块色',
            '新组件先加到本页，再用到页面',
          ]}
          donts={[
            '不要在页面里写新的按钮样式',
            '不要用 className 覆盖组件的颜色和尺寸（目前没有 tailwind-merge）',
            '不要只靠颜色区分状态，同时给文字或图标',
          ]}
        />
      </Section>
    </>
  )
}
