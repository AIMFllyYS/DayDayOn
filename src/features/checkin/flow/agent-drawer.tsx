'use client'

import { AgentTurn } from '@/features/agent/components/agent-turn'
import type { AgentTurnView } from '@/features/agent/types'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { VerdictCard } from '@/features/referee/components/verdict-card'
import type { Verdict } from '@/features/referee/schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 打卡页的 Agent 分析（接真实裁判流）。全局只有一个 Agent 形象：这里不画宠物，
 * 收起后由悬浮宠物身上的状态点表示「分析中 / 已完成」，点宠物再展开（pet-binding.ts）。
 * - drawer：窄屏贴在操作条上方的抽屉；
 * - inline：宽屏右栏，常开、占满高度。
 * 思考与工具调用复用 <AgentTurn>，完成后追加评分结论卡；「接着问」打开同一个会话的对话框。
 */

export type AgentPhase = 'analyzing' | 'done'

export function AgentDrawer({
  turn,
  phase,
  open,
  onToggle,
  verdict,
  notice,
  character,
  petName,
  onAsk,
  variant = 'drawer',
}: {
  turn: AgentTurnView | null
  phase: AgentPhase
  open: boolean
  onToggle: () => void
  verdict: Verdict | null
  /** Agent 没能交卷、改用规则判定时的一行说明 */
  notice?: string | null
  character: MascotCharacter
  petName: string
  /** 打开对话框接着问（分析就在那个会话里） */
  onAsk?: () => void
  variant?: 'drawer' | 'inline'
}) {
  const done = phase === 'done'
  const inline = variant === 'inline'
  if (!inline && !open) return null

  const header = (
    <>
      <span className="text-caption min-w-0 flex-1 truncate font-bold">{petName}分析</span>
      <Badge tone={done ? 'success' : 'primary'} icon={done ? 'check' : 'loader'}>
        {done ? '已完成' : '解析中'}
      </Badge>
    </>
  )

  const body = (
    <div className={cn('flex flex-col gap-2.5', !inline && '[zoom:0.88]')}>
      {turn && <AgentTurn turn={turn} character={character} />}
      {notice && (
        <p className="text-tiny text-muted flex items-start gap-1.5">
          <Icon name="alert" size={13} className="mt-px shrink-0" />
          {notice}
        </p>
      )}
      {done && verdict && <VerdictCard verdict={verdict} />}
      {done && onAsk && (
        <Button variant="soft" size="sm" icon="chat" className="self-start" onClick={onAsk}>
          接着问{petName}
        </Button>
      )}
    </div>
  )

  if (inline) {
    return (
      <section aria-label={`${petName}分析`} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 items-center gap-2 px-4 py-2.5">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6" aria-live="polite">
          {body}
        </div>
      </section>
    )
  }

  return (
    <div className="pointer-events-auto px-3 pb-2">
      <div className="border-border bg-surface/90 shadow-float animate-fade-up rounded-xl border backdrop-blur-md">
        <button
          type="button"
          aria-expanded
          aria-label={`收起${petName}分析`}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-2 px-3.5 py-2.5 text-left"
        >
          {header}
          <span className="bg-surface-sunken text-muted grid size-7 shrink-0 place-items-center rounded-full">
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
        <div className="max-h-64 overflow-y-auto px-3.5 pb-3" aria-live="polite">
          {body}
        </div>
      </div>
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
