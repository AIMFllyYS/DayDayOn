import type { Metadata } from 'next'
import Link from 'next/link'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, softToneClass } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import { deckClass } from './_components/deck'
import { MODULE_SPECS, SHARED_INPUT_MODES } from './_data/module-specs'

export const metadata: Metadata = { title: '打卡板块总览' }

export default function ModulesOverviewPlaybookPage() {
  return (
    <>
      <PageHeader
        title="打卡板块"
        description="五个板块共用一套手账底座：三态输入、AI 科学裁判，以及「达标盖章 / 诚实存档」双轨。差别只在各板块的填充表单和裁判门槛。"
        docRef="ui-design-system.md · ADR-0002 · ADR-0003"
      />

      <Section
        ann="playbook.modules.overview.architecture-banner"
        title="共用底座"
        description="所有板块都有这三种记录方式，结果分两条轨道。"
      >
        <ul
          data-ann="playbook.modules.overview.input-modes"
          className="mb-4 grid grid-cols-3 gap-2"
          aria-label="三态输入"
        >
          {SHARED_INPUT_MODES.map((m) => (
            <li
              key={m.mode}
              className="border-border bg-surface flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-center"
            >
              <Icon name={m.icon} size={18} className="text-primary-ink" />
              <span className="text-caption font-bold">{m.mode}</span>
              <span className="text-tiny text-muted max-sm:hidden">{m.detail}</span>
            </li>
          ))}
        </ul>

        <div className={deckClass}>
          <Specimen
            ann="playbook.modules.overview.valid-stamp"
            label="达标盖章"
            note="通过裁判门槛，连击 +1"
            bg="paper"
          >
            <div className="border-success/30 bg-surface shadow-soft flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Mascot mood="cheer" size={52} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="success" dot>
                      有效打卡 · 连击 +1
                    </Badge>
                    <Badge tone="sleep" icon="sleep">
                      早点睡
                    </Badge>
                  </div>
                  <p className="text-caption mt-1 font-bold">23:15 入睡 · 7小时55分</p>
                </div>
              </div>
              <Stamp text="已达标" caption="有效卡" tone="sleep" size={58} />
            </div>
          </Specimen>

          <Specimen
            ann="playbook.modules.overview.archive-only"
            label="诚实存档"
            note="未达门槛仍照常记录，只是不盖章"
            bg="paper"
          >
            <div className="border-warning/35 bg-surface shadow-soft flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Mascot mood="sleepy" size={52} />
                <div className="min-w-0">
                  <Badge tone="warning" icon="alert">
                    仅记录 · 未达红线
                  </Badge>
                  <p className="text-caption mt-1 font-bold">02:15 入睡 · 8小时15分</p>
                </div>
              </div>
              <span className="bg-warning-soft text-warning-ink font-display text-tiny shrink-0 rounded-xl border border-dashed border-current px-2.5 py-2 text-center font-bold">
                已存档
                <br />
                未盖章
              </span>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.modules.overview.cards"
        title="五个板块"
        description="点进去看整页设计稿、判例对比和规则设计。"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_SPECS.map((mod) => (
            <Link
              key={mod.slug}
              href={`/dev/playbook/modules/${mod.slug}`}
              data-ann={`playbook.modules.overview.card.${mod.slug}`}
              className="border-border bg-surface shadow-soft group flex min-w-0 flex-col gap-3 rounded-3xl border p-4 transition-all duration-(--dur-fast) hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <IconTile icon={moduleMeta[mod.tone].icon} tone={mod.tone} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-subhead truncate font-bold">{mod.title}</h3>
                  <p className="text-tiny text-muted truncate">{mod.tagline}</p>
                </div>
                <Icon
                  name="chevron-right"
                  size={18}
                  className="text-subtle group-hover:text-foreground shrink-0 transition-colors"
                />
              </div>
              <p className="text-caption text-muted line-clamp-2 leading-snug">{mod.threshold}</p>
              <div className="border-border flex flex-col gap-1.5 border-t border-dashed pt-2.5 max-sm:hidden">
                <p className="text-tiny flex items-start gap-1.5 leading-snug">
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 font-bold',
                      softToneClass.success,
                    )}
                  >
                    盖章
                  </span>
                  <span className="text-muted line-clamp-1">{mod.pass}</span>
                </p>
                <p className="text-tiny flex items-start gap-1.5 leading-snug">
                  <span
                    className={cn(
                      'shrink-0 rounded-md px-1.5 py-0.5 font-bold',
                      softToneClass.warning,
                    )}
                  >
                    存档
                  </span>
                  <span className="text-muted line-clamp-1">{mod.block}</span>
                </p>
              </div>
            </Link>
          ))}

          <Link
            href="/dev/playbook/smart-checkin"
            data-ann="playbook.modules.overview.card.smart-hub"
            className="border-border-strong bg-surface-sunken group flex min-w-0 flex-col gap-3 rounded-3xl border border-dashed p-4 transition-all duration-(--dur-fast) hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <IconTile icon="sparkles" tone="primary" size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="text-subhead truncate font-bold">智能打卡底座</h3>
                <p className="text-tiny text-muted truncate">扫描镜 · 三态 Tab · 裁判反馈卡</p>
              </div>
              <Icon
                name="chevron-right"
                size={18}
                className="text-subtle group-hover:text-foreground shrink-0 transition-colors"
              />
            </div>
            <p className="text-caption text-muted line-clamp-2 leading-snug">
              五个板块共享的原子组件；图片只在内存压缩，不落盘。
            </p>
          </Link>
        </div>
      </Section>

      <Section ann="playbook.modules.overview.rules" title="通用守则">
        <details className="group" data-ann="playbook.modules.overview.rules-details">
          <summary className="text-caption text-primary-ink inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold select-none">
            展开守则
            <Icon
              name="chevron-down"
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="mt-2">
            <Rules
              dos={[
                '三态 Tab 统一放在每个打卡页顶部',
                '未达标也照常保存，只是不盖有效章，保护好友连击公平',
                'AI 反馈保持团团的温柔口吻，讲清科学原因',
              ]}
              donts={[
                '不要「只要填了数据就算打卡成功」',
                '不要因为未达标就报错拒绝保存',
                '不要写死 hex 色值，统一用各板块 soft / ink 语义 token',
              ]}
            />
          </div>
        </details>
      </Section>
    </>
  )
}
