'use client'

import { useState, type ReactElement } from 'react'
import { Icon } from '@/components/ui/icon'
import { Popover } from '@/components/ui/popover'
import { toast } from '@/components/ui/toast'
import { useAgentConversations, useDeleteConversation } from '@/lib/api/queries/agent'
import { cn } from '@/lib/cn'
import { calendarDateOf, formatMonthDay } from '@/lib/time'
import { useAgentUi, useAgentUiState } from '../agent-store'

interface ConversationHistoryPopoverProps {
  timeZone: string
  /** 删除当前正打开的对话后新建会话时是否保持弹窗打开 */
  openPanelOnReset: boolean
  renderTrigger: (open: boolean) => ReactElement
}

export function ConversationHistoryPopover({
  timeZone,
  openPanelOnReset,
  renderTrigger,
}: ConversationHistoryPopoverProps) {
  const { conversationId } = useAgentUiState()
  const ui = useAgentUi()
  const [open, setOpen] = useState(false)
  const conversations = useAgentConversations()
  const deleteConv = useDeleteConversation()

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="end"
      sideOffset={6}
      positionerClassName="z-[60]"
      clean
      className="shadow-float max-h-72 w-64 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
      trigger={renderTrigger(open)}
    >
      {conversations.data?.items.length === 0 && (
        <p className="text-caption text-subtle px-2 py-3 text-center">还没有对话</p>
      )}
      {conversations.data?.items.map((c) => (
        <div
          key={c.id}
          className={cn(
            'group flex w-full items-center gap-1 rounded-xl pr-1 transition-colors',
            c.id === conversationId
              ? 'bg-primary-soft text-foreground'
              : 'text-muted hover:bg-surface-sunken hover:text-foreground',
          )}
        >
          <button
            type="button"
            onClick={() => {
              ui.setConversation(c.id)
              setOpen(false)
            }}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 text-left"
          >
            <span className="text-caption min-w-0 flex-1 truncate font-medium">{c.title}</span>
            <span className="text-tiny text-subtle shrink-0">
              {formatMonthDay(calendarDateOf(c.lastMessageAt, timeZone))}
            </span>
          </button>
          <button
            type="button"
            aria-label={`删除对话 ${c.title}`}
            onClick={() => {
              deleteConv.mutate(c.id, {
                onSuccess: () => {
                  if (c.id === conversationId) {
                    ui.newConversation({ openPanel: openPanelOnReset })
                  }
                  toast.success('已删除对话')
                },
              })
            }}
            className="text-subtle hover:text-danger-ink flex size-7 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <Icon name="trash" size={13} lineOnly />
          </button>
        </div>
      ))}
    </Popover>
  )
}
