import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Mascot } from '@/components/mascot/mascot'
import { Button } from './button'

interface ErrorStateProps {
  /** 出了什么问题，例如"加载失败了" */
  title?: string
  /** 原因 + 下一步，一般来自 errorMessage(err)（src/lib/api/error-messages.ts） */
  message?: string
  /** 传了就显示"重试"按钮 */
  onRetry?: () => void
  retryLabel?: string
  /** 正在重试：按钮转圈 */
  retrying?: boolean
  /** 重试以外的操作，例如"返回主页" */
  action?: ReactNode
  size?: 'md' | 'compact'
  className?: string
}

/**
 * 错误态：团团失落 + 原因 + 重试（PRD 7.1）。
 * 错误说明写在文字里，团团只表达情绪（ui-design-system.md 第 9 节）。
 */
export function ErrorState({
  title = '出了点小问题',
  message = '网络好像不太稳，稍后再试试',
  onRetry,
  retryLabel = '重试',
  retrying = false,
  action,
  size = 'md',
  className,
}: ErrorStateProps) {
  const compact = size === 'compact'
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'gap-2 py-4' : 'gap-3 py-8',
        className,
      )}
    >
      <Mascot mood="sad" size={compact ? 64 : 104} />
      <div className="flex max-w-xs flex-col gap-1">
        <p className={cn('font-bold', compact ? 'text-subhead' : 'text-heading')}>{title}</p>
        <p className="text-caption text-muted">{message}</p>
      </div>
      {(onRetry || action) && (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button
              variant="soft"
              icon="undo"
              size={compact ? 'sm' : 'md'}
              loading={retrying}
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
