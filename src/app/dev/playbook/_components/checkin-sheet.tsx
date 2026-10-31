'use client'

import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { moduleMeta, moduleTones, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

// 演示数据：今天每个板块的状态
const todayStatus: Record<ModuleTone, { text: string; done: boolean }> = {
  exercise: { text: '已打卡 · 慢跑 32 分钟', done: true },
  diet: { text: '还差晚餐', done: false },
  sleep: { text: '已打卡 · 7.2 小时', done: true },
  study: { text: '1 / 2 项', done: false },
  custom: { text: '每天喝 8 杯水 · 5 / 8', done: false },
}

/**
 * 打卡入口弹层（演示）：从底部拉出的菜单列表，每个板块一行，右侧显示今天的状态。
 * 2026-11-01 评审：打卡弹层要像菜单列表一样从下往上拉，而不是宫格。
 * 正式实现放到 src/features/checkin/ 时沿用这个结构。
 */
export function CheckinSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const doneCount = moduleTones.filter((t) => todayStatus[t].done).length
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="记录点什么？"
      description={`今天完成了 ${doneCount} / ${moduleTones.length} 个板块`}
      footer={
        <Button variant="soft" icon="camera" className="w-full">
          拍照，让 AI 帮我识别
        </Button>
      }
    >
      <ProgressBar value={doneCount} max={moduleTones.length} label="今日完成板块" size="sm" />
      <ul className="divide-border bg-surface-sunken/60 mt-3 divide-y overflow-hidden rounded-2xl">
        {moduleTones.map((t, i) => {
          const s = todayStatus[t]
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="animate-fade-up hover:bg-surface active:bg-surface-sunken flex min-h-15 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-(--dur-fast)"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <IconTile icon={moduleMeta[t].icon} tone={t} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{moduleMeta[t].label}</span>
                  <span
                    className={cn(
                      'text-tiny block truncate',
                      s.done ? 'text-success-ink' : 'text-muted',
                    )}
                  >
                    {s.text}
                  </span>
                </span>
                {s.done ? (
                  <span className="bg-success-soft text-success-ink flex size-7 items-center justify-center rounded-full">
                    <Icon name="check" size={14} strokeWidth={2.6} label="已打卡" />
                  </span>
                ) : (
                  <Icon name="chevron-right" size={18} className="text-subtle" />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
