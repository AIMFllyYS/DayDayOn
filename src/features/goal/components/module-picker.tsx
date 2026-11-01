import Link from 'next/link'
import { IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { moduleMeta } from '@/components/ui/tone'
import { MODULES, type Module } from '@/features/shared/schemas'
import { cn } from '@/lib/cn'
import { DEFAULT_GOALS } from '../defaults'
import { formatTarget } from '../format'

/** 每个板块一句说明：选板块时帮用户想清楚"这个板块记什么" */
const MODULE_HINT: Record<Module, string> = {
  exercise: '跑步、健身、散步，按时长累计',
  diet: '每餐记一次，可以拍照识别',
  sleep: '记入睡和起床时间，按睡眠时长算',
  study: '学了什么记一条',
  custom: '喝水、读书…字段自己定',
}

interface ModulePickerProps {
  /** 选中某个板块后去哪：/goals/new?module=… （刷新、返回键都能回到这一步） */
  hrefFor: (module: Module) => string
  className?: string
}

/** 新建目标第一步：选板块。每个板块一张可点卡片，副标题是默认目标量 */
export function ModulePicker({ hrefFor, className }: ModulePickerProps) {
  return (
    <ul className={cn('grid gap-3 @xl:grid-cols-2', className)}>
      {MODULES.map((m) => {
        const meta = moduleMeta[m]
        return (
          <li key={m}>
            <Link href={hrefFor(m)} className="block rounded-2xl">
              <Card variant="outline" interactive className="flex min-h-16 items-center gap-3">
                <IconTile icon={meta.icon} tone={m} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="text-subhead block font-bold">{meta.label}</span>
                  <span className="text-caption text-muted block">
                    {MODULE_HINT[m]} · 默认每天 {formatTarget(DEFAULT_GOALS[m].target)}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} className="text-subtle" />
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
