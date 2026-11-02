import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 用户的一条消息：主色浅底，靠右。助手的回复用 <AgentTurn> */
export function UserMessage({
  children,
  attachments,
  className,
}: {
  children: ReactNode
  /** 附件说明，例如"1 张照片（识别后不保存）" */
  attachments?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <div className="bg-primary-soft text-primary-ink text-caption md:text-body max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 md:max-w-[80%] md:rounded-br-md md:px-4 md:py-2.5">
        {children}
      </div>
      {attachments && <span className="text-tiny text-muted">{attachments}</span>}
    </div>
  )
}
