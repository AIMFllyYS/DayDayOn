'use client'

import { useState } from 'react'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { Avatar } from '@/components/ui/avatar'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { moduleMeta, type ModuleTone } from '@/components/ui/tone'
import type { NotificationItem } from '@/features/notification/schemas'

function getModuleTone(mod: string): ModuleTone {
  if (mod in moduleMeta) {
    return mod as ModuleTone
  }
  return 'custom'
}

/**
 * 5 分钟滑动窗口聚合打卡卡片
 */
export function CheckinAggregateCard({
  notification,
  onGoToRoom,
}: {
  notification: NotificationItem
  onGoToRoom?: (actorId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const meta = notification.metadata ?? {}
  const checkins = Array.isArray(meta.checkins)
    ? (meta.checkins as Array<{ title: string; module: string; time: string }>)
    : []

  const timeStr = notification.createdAt
    ? new Date(notification.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const count = checkins.length > 0 ? checkins.length : 1
  const badgeLabel = count > 1 ? `5 分钟内连打 ${count} 项` : '完成今日打卡'

  return (
    <Card
      variant="outline"
      className="flex w-full max-w-full min-w-0 flex-col justify-between gap-3 overflow-hidden"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative shrink-0">
          <Avatar
            name={notification.actorNickname ?? '好友'}
            avatar={notification.actorAvatar ?? 'mascot:tuan:cheer:exercise'}
            size="md"
            ring
          />
          {!notification.readAt && (
            <span className="bg-danger ring-surface absolute -top-0.5 -left-0.5 size-2.5 rounded-full ring-2" />
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-caption truncate font-bold">
                {notification.actorNickname ?? '好友'}
              </span>
              <Badge tone="exercise" icon="check">
                {badgeLabel}
              </Badge>
            </div>
            <span className="text-tiny text-subtle shrink-0 font-mono">{timeStr}</span>
          </div>

          <p className="text-caption text-foreground mt-1 leading-relaxed [overflow-wrap:anywhere] break-words">
            {notification.content || notification.title}
          </p>

          {/* 聚合明细列表 */}
          {expanded && checkins.length > 0 && (
            <ul className="bg-surface-sunken mt-2.5 grid min-w-0 gap-1.5 overflow-hidden rounded-xl p-2.5">
              {checkins.map((item, idx) => {
                const tone = getModuleTone(item.module)
                return (
                  <li
                    key={`${item.title}-${idx}`}
                    className="flex min-w-0 items-center justify-between gap-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <IconTile icon={moduleMeta[tone].icon} tone={tone} size="sm" />
                      <span className="text-tiny truncate font-semibold">{item.title}</span>
                    </div>
                    <span className="text-tiny text-subtle shrink-0 font-mono">{item.time}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
        {checkins.length > 1 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-tiny text-muted hover:text-foreground font-semibold"
          >
            {expanded ? '收起打卡明细 ↑' : `展开全部 ${checkins.length} 项明细 ↓`}
          </button>
        ) : (
          <span />
        )}

        {notification.actorId && onGoToRoom && (
          <Button
            size="sm"
            variant="secondary"
            icon="sparkles"
            onClick={() => onGoToRoom(notification.actorId!)}
          >
            去ta小窝夸夸
          </Button>
        )}
      </div>
    </Card>
  )
}

/**
 * 宠物互动卡片（戳戳 / 提醒）
 */
export function PetInteractionCard({
  notification,
  onReplyPoke,
}: {
  notification: NotificationItem
  onReplyPoke?: (actorId: string) => void
}) {
  const [replied, setReplied] = useState(false)

  const timeStr = notification.createdAt
    ? new Date(notification.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <Card
      variant="outline"
      className="flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden"
    >
      <div className="relative shrink-0">
        <Avatar
          name={notification.actorNickname ?? '好友'}
          avatar={notification.actorAvatar ?? 'mascot:mian:sleepy:sleep'}
          size="md"
        />
        <span className="bg-surface shadow-soft absolute -right-1.5 -bottom-1 rounded-full p-0.5">
          <MascotSvg character="mian" mood="happy" size={22} />
        </span>
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-caption truncate font-bold">
              {notification.actorNickname ?? '好友'} · 伙伴
            </span>
            <Badge tone="sleep" icon="megaphone">
              打卡问候
            </Badge>
          </div>
          <span className="text-tiny text-subtle shrink-0 font-mono">{timeStr}</span>
        </div>

        <p className="text-caption text-foreground mt-1 leading-relaxed [overflow-wrap:anywhere] break-words">
          {notification.content || notification.title}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {notification.actorId && onReplyPoke && (
            <Button
              size="sm"
              variant={replied ? 'secondary' : 'primary'}
              icon={replied ? 'check' : 'hand'}
              onClick={() => {
                setReplied(true)
                onReplyPoke(notification.actorId!)
              }}
            >
              {replied ? '已回戳伙伴' : '回戳一下'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

/**
 * 24 小时静默造访足迹卡片
 */
export function VisitFootprintCard({ notification }: { notification: NotificationItem }) {
  return (
    <Card
      variant="sunken"
      className="flex w-full max-w-full min-w-0 items-center justify-between gap-3 overflow-hidden py-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <IconTile icon="footprints" tone="study" size="sm" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-caption font-semibold [overflow-wrap:anywhere] break-words">
            {notification.title}
          </p>
          <p className="text-tiny text-muted [overflow-wrap:anywhere] break-words">
            {notification.content}
          </p>
        </div>
      </div>
      <Badge tone="neutral" className="shrink-0">
        足迹
      </Badge>
    </Card>
  )
}

function formatAnnouncementTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

/**
 * 系统与官方公告卡片（支持数据库 announcements 表多行正文、标签、版本号与置顶态）
 */
export function SystemNoticeCard({ notification }: { notification: NotificationItem }) {
  const meta = notification.metadata ?? {}
  const tag = typeof meta.tag === 'string' && meta.tag.trim() ? meta.tag.trim() : '官方公告'
  const version =
    typeof meta.version === 'string' && meta.version.trim() ? meta.version.trim() : null
  const pinned = meta.pinned === true
  const unread = !notification.readAt

  return (
    <Card variant="outline" className="w-full max-w-full min-w-0 space-y-2.5 overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {unread && <span className="bg-danger size-2 shrink-0 rounded-full" aria-label="未读" />}
          <Badge tone="diet" icon="megaphone">
            {tag}
          </Badge>
          {version && (
            <Badge tone="primary">{version.startsWith('v') ? version : `v${version}`}</Badge>
          )}
          {pinned && <Badge tone="study">置顶</Badge>}
        </div>
        <span className="text-tiny text-subtle shrink-0 font-mono">
          {formatAnnouncementTime(notification.createdAt)}
        </span>
      </div>
      <h4 className="text-subhead leading-snug font-bold [overflow-wrap:anywhere] break-words">
        {notification.title}
      </h4>
      <p className="text-caption text-muted leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-line">
        {notification.content}
      </p>
    </Card>
  )
}
