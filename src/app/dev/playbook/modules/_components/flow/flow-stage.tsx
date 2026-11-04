'use client'

import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import type { FlowScenario } from './flow-types'

/** 打卡页各部分的默认展开状态：以此为最终呈现的默认状态，改动时同步更新 */
const DEFAULT_STATES: { name: string; state: string; open: boolean }[] = [
  { name: 'Agent 分析抽屉', state: '展开（可折叠成小宠物）', open: true },
  { name: '填写页分区（手动模式）', state: '第一项展开，其余折叠', open: true },
  { name: '填写页分区（智能模式）', state: '不展示分区，只有扫描镜', open: false },
  { name: '分析报告：前两张卡片', state: '展开', open: true },
  { name: '饮食 · 逐菜分析', state: '展开，每道菜折叠，指标点开才看', open: true },
  { name: '分析报告：校验清单', state: '折叠', open: false },
]

/**
 * 沙盒舞台：手机 + 场景控制台。
 * 桌面：手机在左、控制台在右；手机宽度：控制台收成一行场景标签排在手机上面。
 */
export function FlowStage({
  ann,
  phoneLabel,
  phone,
  scenarios,
  activeId,
  onSelect,
}: {
  ann: string
  phoneLabel: string
  phone: ReactNode
  scenarios: FlowScenario[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]
  return (
    <div
      data-ann={ann}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8"
    >
      <div className="flex justify-center max-lg:order-2" data-ann={`${ann}.phone`}>
        <PhoneFrame fluid label={phoneLabel} className="h-[780px]">
          {phone}
        </PhoneFrame>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24" data-ann={`${ann}.console`}>
        <Card className="flex flex-col gap-3 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-bold">场景样本</span>
            <span className="text-tiny text-muted">切换后手机载入该场景的识别结果</span>
          </div>
          <div role="tablist" aria-label="场景样本" className="grid grid-cols-4 gap-1.5">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === activeId}
                onClick={() => onSelect(s.id)}
                className={cn(
                  'text-caption flex min-h-11 items-center justify-center gap-1 rounded-xl border font-bold transition-colors',
                  s.id === activeId
                    ? 'border-primary bg-primary-soft text-primary-ink'
                    : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                )}
              >
                {s.code}
                <span
                  aria-hidden
                  className={cn('size-1.5 rounded-full', s.passed ? 'bg-success' : 'bg-warning')}
                />
              </button>
            ))}
          </div>
          {active && (
            <div className="bg-surface-sunken flex flex-col gap-1.5 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-bold">{active.title}</span>
                <Badge
                  tone={active.passed ? 'success' : 'warning'}
                  icon={active.passed ? 'check' : 'alert'}
                >
                  {active.passed ? '会盖章' : '仅存档'}
                </Badge>
              </div>
              <p className="text-tiny text-muted leading-relaxed">{active.description}</p>
            </div>
          )}
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2 p-3.5" data-ann={`${ann}.defaults`}>
          <span className="text-caption font-bold">默认展开 / 折叠（最终呈现状态）</span>
          <ul className="text-tiny text-muted flex flex-col gap-1.5 leading-relaxed">
            {DEFAULT_STATES.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3">
                <span>{s.name}</span>
                <span
                  className={cn('shrink-0 font-bold', s.open ? 'text-success-ink' : 'text-subtle')}
                >
                  {s.state}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-tiny text-muted flex items-start gap-2 px-1 leading-relaxed max-lg:hidden">
          <Icon name="bulb" size={14} className="text-primary-ink mt-0.5 shrink-0" />
          <span>
            手机里切到「手动填写」从空白开始，自己填也会触发同样的判定；打卡后弹窗点「查看分析」进入分析页。
          </span>
        </p>
      </div>
    </div>
  )
}
