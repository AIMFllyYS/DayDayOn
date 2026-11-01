import { Button } from '@/components/ui/button'

/** 偏移分页（后台表格）：上一页 / 下一页 + "第 x–y 条，共 n 条" */
export function Pager({
  offset,
  limit,
  total,
  onOffsetChange,
}: {
  offset: number
  limit: number
  total: number
  onOffsetChange: (offset: number) => void
}) {
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(total, offset + limit)
  return (
    <nav aria-label="分页" className="flex items-center justify-between gap-3 pt-3">
      <p className="text-caption text-muted tabular-nums">
        第 {from}–{to} 条，共 {total} 条
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          icon="chevron-left"
          disabled={offset === 0}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          上一页
        </Button>
        <Button
          variant="secondary"
          disabled={offset + limit >= total}
          onClick={() => onOffsetChange(offset + limit)}
        >
          下一页
        </Button>
      </div>
    </nav>
  )
}
