import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 用户的一条消息：主色浅底，靠右。助手的回复用 <AgentTurn>。
 * - 当次会话内存中存在图片预览时（imageUrls），在气泡区域上方展示圆角缩略图（不落盘、不入库）；
 * - 若用户仅发送了图片而未输入文字（hasText === false），不渲染空壳文字气泡，只展示缩略图与底部说明。
 */
export function UserMessage({
  children,
  imageUrls,
  attachments,
  className,
}: {
  children?: ReactNode
  /** 当前浏览器会话内存中的压缩图片预览 URL（最多 2 张，刷新后自动释放） */
  imageUrls?: readonly string[]
  /** 附件说明，例如"1 张照片（识别后不保存）" */
  attachments?: string
  className?: string
}) {
  const hasImages = Boolean(imageUrls && imageUrls.length > 0)
  const hasText =
    children !== undefined &&
    children !== null &&
    children !== false &&
    (typeof children !== 'string' || children.trim().length > 0)

  return (
    <div className={cn('flex flex-col items-end gap-1.5', className)}>
      {hasImages && imageUrls && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5 md:max-w-[80%]">
          {imageUrls.map((url, idx) => (
            <div
              key={`${idx}-${url.slice(0, 32)}`}
              className="border-border bg-surface shadow-soft overflow-hidden rounded-2xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 当前会话内存压缩预览图，不落盘 */}
              <img
                src={url}
                alt={`已上传照片 ${idx + 1}`}
                className={cn(
                  'object-cover',
                  imageUrls.length > 1 ? 'size-28 sm:size-32' : 'max-h-48 max-w-56',
                )}
              />
            </div>
          ))}
        </div>
      )}
      {hasText && (
        <div className="bg-primary-soft text-primary-ink text-caption md:text-body max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 break-words whitespace-pre-wrap md:max-w-[80%] md:rounded-br-md md:px-4 md:py-2.5">
          {children}
        </div>
      )}
      {attachments && <span className="text-tiny text-muted">{attachments}</span>}
    </div>
  )
}
