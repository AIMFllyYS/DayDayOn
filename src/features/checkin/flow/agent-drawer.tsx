'use client'

import { AgentTurn } from '@/features/agent/components/agent-turn'
import { PetAvatar } from '@/features/agent/components/pet-avatar'
import type { AgentTurnView } from '@/features/agent/types'
import { PET_SIZE } from '@/features/agent/use-pet-drag'
import type { Verdict } from '@/features/referee/schemas'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 打卡页底部的 Agent 分析抽屉（Playbook phone-flow 的 AgentDrawer，接真实裁判流）。
 * 贴在操作条上方；折叠后缩成小宠物，点它再展开。思考与工具调用复用 <AgentTurn>，完成后追加评分结论卡。
 */

const STATIC_PET = {
  position: { left: 0, top: 0, edge: 'none' as const },
  swaying: false,
  spinning: false,
  peeking: false,
  dragging: false,
}

export type AgentPhase = 'analyzing' | 'done'

export function AgentDrawer({
  turn,
  phase,
  open,
  onToggle,
  verdict,
  notice,
}: {
  turn: AgentTurnView | null
  phase: AgentPhase
  open: boolean
  onToggle: () => void
  verdict: Verdict | null
  /** Agent 没能交卷、改用规则判定时的一行说明 */
  notice?: string | null
}) {
  const done = phase === 'done'
  if (!open) {
    return (
      <div className="pointer-events-auto flex justify-end px-3 pb-2">
        <button
          type="button"
          aria-label="展开 Agent 分析"
          onClick={onToggle}
          className="animate-fade-up relative active:scale-95"
          style={{ width: PET_SIZE, height: PET_SIZE }}
        >
          <PetAvatar pet={STATIC_PET} size={PET_SIZE} />
          <span
            className={cn(
              'ring-surface absolute top-0 right-0 size-3 rounded-full ring-2',
              done ? 'bg-success' : 'bg-primary animate-pulse',
            )}
          />
        </button>
      </div>
    )
  }
  return (
    <div className="pointer-events-auto px-3 pb-2">
      <div className="border-border bg-surface/90 shadow-float animate-fade-up rounded-xl border backdrop-blur-md">
        <button
          type="button"
          aria-expanded
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-2 px-3.5 py-2.5 text-left"
        >
          <span className="text-caption min-w-0 flex-1 truncate font-bold">Agent 分析</span>
          <Badge tone={done ? 'success' : 'primary'} icon={done ? 'check' : 'loader'}>
            {done ? '已完成' : '解析中'}
          </Badge>
          <span className="bg-surface-sunken text-muted grid size-7 shrink-0 place-items-center rounded-full">
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
        <div className="max-h-64 overflow-y-auto px-3.5 pb-3" aria-live="polite">
          <div className="flex [zoom:0.88] flex-col gap-2.5">
            {turn && <AgentTurn turn={turn} />}
            {notice && (
              <p className="text-tiny text-muted flex items-start gap-1.5">
                <Icon name="alert" size={13} className="mt-px shrink-0" />
                {notice}
              </p>
            )}
            {done && verdict && <VerdictCard verdict={verdict} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 评分结论卡：达标 = 绿，未达标 = 红；有分数时右侧放大显示 */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const passed = verdict.isValid
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        passed
          ? 'border-success/40 bg-success-soft text-success-ink'
          : 'border-danger/40 bg-danger-soft text-danger-ink',
      )}
    >
      <span
        className={cn(
          'text-on-primary grid size-8 shrink-0 place-items-center rounded-full',
          passed ? 'bg-success' : 'bg-danger',
        )}
      >
        <Icon name={passed ? 'check' : 'x'} size={16} lineOnly strokeWidth={2.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption font-bold">{passed ? '达标' : '未达标'}</span>
        <span className="text-tiny leading-snug opacity-90">{verdict.detail}</span>
      </span>
      {verdict.score !== null && (
        <span className="font-display flex shrink-0 flex-col items-end leading-none font-bold">
          <span className="text-heading tabular-nums">{verdict.score.toFixed(1)}</span>
          <span className="text-tiny mt-1 font-semibold opacity-80">
            / {verdict.scoreMax ?? 5} · 线 {String(verdict.metrics.passScore ?? 3)}
          </span>
        </span>
      )}
    </div>
  )
}

/** 内容区里报告前的分隔栏：两侧渐细的线 + 中间小标题 */
export function ReportDivider() {
  return (
    <div className="flex items-center gap-2.5 py-2" aria-hidden>
      <span className="bg-border h-[3px] flex-1 [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
      <span className="text-tiny text-muted font-bold">分析报告</span>
      <span className="bg-border h-[3px] flex-1 [clip-path:polygon(0_0,100%_50%,0_100%)]" />
    </div>
  )
}

/** 模块之间的分隔线：整行宽、很浅，中间略粗、两端渐细 */
export function SectionDivider() {
  return (
    <div
      aria-hidden
      className="bg-border mx-3.5 my-2 h-[3px] shrink-0 [clip-path:polygon(0_50%,50%_0,100%_50%,50%_100%)]"
    />
  )
}
