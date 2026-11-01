import type { Metadata } from 'next'
import { Badge, IconTile } from '@/components/ui/badge'
import { Icon, iconNames } from '@/components/ui/icon'
import { moduleMeta, moduleTones } from '@/components/ui/tone'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import { TokenValue } from '../_components/token-value'
import { PaletteRationale, ThemeGallery } from '../_components/theme-demos'

export const metadata: Metadata = { title: '色彩与字体' }

const neutrals = [
  { name: '--background', use: '页面底色（奶油纸）' },
  { name: '--surface', use: '卡片、弹层' },
  { name: '--surface-sunken', use: '凹陷区、进度槽、输入区' },
  { name: '--foreground', use: '正文、标题' },
  { name: '--muted', use: '辅助文字（对比度 ≥ 4.5）' },
  { name: '--subtle', use: '占位符、装饰，不用于正文' },
  { name: '--border', use: '分隔线、描边' },
  { name: '--border-strong', use: '次按钮描边、关闭态开关' },
] as const

const brand = [
  { name: '--primary', use: '主按钮、"＋"、当前态' },
  { name: '--primary-hover', use: '主按钮悬停' },
  { name: '--primary-soft', use: '主色浅底：选中项、徽章' },
  { name: '--primary-ink', use: '浅底上的主色文字' },
  { name: '--on-primary', use: '主色实底上的文字' },
] as const

const states = ['success', 'warning', 'danger'] as const

const typeScale = [
  { cls: 'text-display', name: 'display', spec: '32 / 40', use: '页面大标题、关键数字' },
  { cls: 'text-title', name: 'title', spec: '24 / 32', use: '页面标题（顶栏）' },
  { cls: 'text-heading', name: 'heading', spec: '20 / 28', use: '卡片标题、弹层标题' },
  { cls: 'text-subhead', name: 'subhead', spec: '17 / 26', use: '列表主文字、小节标题' },
  { cls: 'text-body', name: 'body', spec: '16 / 26', use: '正文、输入框（不小于 16）' },
  { cls: 'text-caption', name: 'caption', spec: '14 / 21', use: '辅助说明、次要信息' },
  { cls: 'text-tiny', name: 'tiny', spec: '12 / 17', use: '徽章、标签、时间戳' },
] as const

const radii = [
  { cls: 'rounded-sm', name: 'sm · 8' },
  { cls: 'rounded-md', name: 'md · 12' },
  { cls: 'rounded-lg', name: 'lg · 16' },
  { cls: 'rounded-xl', name: 'xl · 20' },
  { cls: 'rounded-2xl', name: '2xl · 24' },
  { cls: 'rounded-3xl', name: '3xl · 32' },
  { cls: 'rounded-full', name: 'full' },
] as const

const shadows = [
  { cls: 'shadow-soft', name: 'soft', use: '列表、次按钮' },
  { cls: 'shadow-card', name: 'card', use: '默认卡片' },
  { cls: 'shadow-float', name: 'float', use: '弹层、悬浮导航、悬停' },
  { cls: 'shadow-sticker', name: 'sticker', use: '贴纸卡片（每屏 ≤2）' },
  { cls: 'shadow-primary', name: 'primary', use: '主色按钮的彩色投影' },
] as const

const spacing = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const

export default function FoundationsPage() {
  return (
    <>
      <PageHeader
        title="色彩与字体"
        description="所有组件只引用这里的 token。色值在 src/app/globals.css 里修改，本页实时读取。"
        docRef="ui-design-system.md 第 2–4 节"
      />

      <Section ann="playbook.foundations.neutrals" title="底色与文字">
        <SwatchGrid items={neutrals} />
      </Section>

      <Section
        ann="playbook.foundations.brand"
        title="品牌主色 · 跟随主题"
        description="默认主题是奶茶焦糖。主色是低饱和的深色，实底上用奶油色字；用左侧的主题色切换，本页色值实时更新。"
      >
        <SwatchGrid items={brand} />
      </Section>

      <Section
        ann="playbook.foundations.palette-why"
        title="为什么这样配色"
        description="2026-11-01 评审：珊瑚实底按钮显得廉价，而徽章、图标很舒服。对比两者的差别，得出下面三条。"
      >
        <PaletteRationale />
      </Section>

      <Section
        ann="playbook.foundations.themes"
        title="主题色"
        description="用户可以在「我的 → 外观」里选。只换主色这一组，板块色、状态色、底色固定，保证板块一眼认得出。"
      >
        <ThemeGallery />
      </Section>

      <Section
        ann="playbook.foundations.modules"
        title="板块色"
        description="每个板块三档：base 用于图形和进度，soft 用于底色，ink 用于 soft 底上的文字。"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleTones.map((t) => (
            <div
              key={t}
              data-ann={`playbook.foundations.module.${t}`}
              className="border-border bg-surface overflow-hidden rounded-2xl border"
            >
              <div className="flex h-16">
                {(['', '-soft', '-ink'] as const).map((suffix) => (
                  <span
                    key={suffix}
                    className="flex-1"
                    style={{ background: `var(--${t}${suffix})` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <Badge tone={t} icon={moduleMeta[t].icon} size="md">
                  {moduleMeta[t].label}
                </Badge>
                <span className="flex flex-col items-end">
                  <TokenValue name={`--${t}`} />
                  <TokenValue name={`--${t}-soft`} />
                  <TokenValue name={`--${t}-ink`} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section ann="playbook.foundations.states" title="状态色">
        <div className="flex flex-wrap gap-2">
          {states.map((s) => (
            <Badge key={s} tone={s} dot size="md">
              {s === 'success'
                ? '成功 / 已完成'
                : s === 'warning'
                  ? '提醒 / 把握不大'
                  : '错误 / 危险操作'}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        ann="playbook.foundations.fonts"
        title="字体"
        description="拉丁字母和数字用圆体 webfont（各约 30KB，只含拉丁字符）；中文用系统字体，不下载中文 webfont。"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Specimen
            ann="playbook.foundations.font.display"
            label="font-display · Fredoka"
            note="品牌字、大数字、徽章里的数字"
          >
            <p className="font-display text-display font-semibold">DayDayOn 1234</p>
          </Specimen>
          <Specimen
            ann="playbook.foundations.font.sans"
            label="font-sans · Nunito + 系统中文"
            note="默认字体：正文、界面文字"
          >
            <p className="text-subhead">
              今天也在好好生活 <br />
              Hello, 30 kcal
            </p>
          </Specimen>
          <Specimen
            ann="playbook.foundations.font.mono"
            label="font-mono · 系统等宽"
            note="只用于调试信息和工具调用的参数"
          >
            <p className="text-caption font-mono">{'{ "kcal": 320 }'}</p>
          </Specimen>
        </div>
        <div className="border-border bg-surface mt-3 rounded-2xl border p-4">
          <p className="text-tiny text-muted mb-2 font-semibold">
            数字对比：统计数字用 font-display + tabular-nums
          </p>
          <div className="flex flex-wrap items-baseline gap-6">
            <span className="font-display text-title font-semibold tabular-nums">12,580 步</span>
            <span className="text-title font-semibold tabular-nums">12,580 步</span>
          </div>
        </div>
      </Section>

      <Section ann="playbook.foundations.type-scale" title="字号阶梯">
        <ul className="divide-border border-border bg-surface divide-y rounded-2xl border">
          {typeScale.map((t) => (
            <li
              key={t.name}
              className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-6"
            >
              <span className="text-tiny text-muted w-36 shrink-0 font-mono">
                {t.cls} · {t.spec}
              </span>
              <span className={`${t.cls} min-w-0 flex-1 truncate font-bold`}>今天也在好好生活</span>
              <span className="text-tiny text-muted md:w-44 md:text-right">{t.use}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Rules
            dos={[
              '一张卡片内最多三种字号',
              '标题用 bold，正文用 regular，强调用 semibold',
              '数字统计用 font-display',
            ]}
            donts={[
              '不要用 text-sm / text-lg 这类非语义字号',
              '不要用小于 12px 的字',
              '不要整段使用 muted 色',
            ]}
          />
        </div>
      </Section>

      <Section ann="playbook.foundations.radius" title="圆角">
        <div className="flex flex-wrap gap-4">
          {radii.map((r) => (
            <div key={r.cls} className="flex flex-col items-center gap-1.5">
              <span className={`${r.cls} border-primary bg-primary-soft size-16 border-2`} />
              <span className="text-tiny text-muted font-mono">{r.name}</span>
            </div>
          ))}
        </div>
        <p className="text-caption text-muted mt-3">
          卡片 2xl，弹层 3xl，输入框 xl，按钮和徽章 full，图标底座 lg–2xl。
        </p>
      </Section>

      <Section ann="playbook.foundations.shadow" title="阴影">
        <div className="bg-paper grid gap-5 rounded-2xl p-6 sm:grid-cols-3 lg:grid-cols-5">
          {shadows.map((s) => (
            <div key={s.cls} className="flex flex-col items-center gap-2">
              <span className={`${s.cls} bg-surface size-20 rounded-2xl`} />
              <span className="text-tiny font-mono">{s.name}</span>
              <span className="text-tiny text-muted text-center">{s.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        ann="playbook.foundations.spacing"
        title="间距"
        description="沿用 Tailwind 的 4px 栅格。页面左右边距：手机 16px，桌面 32px；卡片内边距 16 / 20px；卡片之间 12px。"
      >
        <ul className="grid gap-1.5">
          {spacing.map((n) => (
            <li key={n} className="flex items-center gap-3">
              <span className="text-tiny text-muted w-16 font-mono">
                {n} · {n * 4}px
              </span>
              <span className="bg-primary h-3 rounded-full" style={{ width: n * 4 }} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        ann="playbook.foundations.icons"
        title="图标"
        description="手账“错版印刷”风格：2px 圆头描边 + 向右下错开 1px 的 22% 同色色块。小于 16px 时只画描边。全部手绘，不用通用图标库的路径。"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Specimen
            ann="playbook.foundations.icons.modules"
            label="板块图标"
            note="放在 IconTile 里，跟随板块色"
          >
            {moduleTones.map((t) => (
              <IconTile key={t} icon={moduleMeta[t].icon} tone={t} size="lg" />
            ))}
          </Specimen>
          <Specimen ann="playbook.foundations.icons.sizes" label="尺寸" note="14 / 20 / 28 / 40">
            {[14, 20, 28, 40].map((s) => (
              <Icon key={s} name="home" size={s} className="text-primary-ink" />
            ))}
          </Specimen>
        </div>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {iconNames.map((n) => (
            <li
              key={n}
              className="bg-surface shadow-soft flex flex-col items-center gap-1.5 rounded-xl py-3"
            >
              <Icon name={n} size={28} />
              <span className="text-muted text-tiny font-mono">{n}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        ann="playbook.foundations.paper"
        title="点阵底纹"
        description="bg-paper 只用于应用背景，像手账的点阵纸。卡片内部保持纯色，保证文字清楚。"
      >
        <div className="bg-paper border-border h-32 rounded-2xl border" />
      </Section>
    </>
  )
}

function SwatchGrid({ items }: { items: readonly { name: `--${string}`; use: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((c) => (
        <li
          key={c.name}
          data-ann={`playbook.foundations.color.${c.name.slice(2)}`}
          className="border-border bg-surface overflow-hidden rounded-2xl border"
        >
          <span className="block h-14" style={{ background: `var(${c.name})` }} />
          <div className="p-3">
            <p className="text-tiny font-mono font-semibold">{c.name}</p>
            <TokenValue name={c.name} />
            <p className="text-tiny text-muted">{c.use}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
