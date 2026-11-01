'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminUserRow } from '@/features/admin/schemas'
import { useQuery } from '@/lib/api'
import { adminUsersQuery } from '@/lib/api/queries/admin'
import { BUSINESS_TIME_ZONE, formatDateTime } from '@/lib/time'
import { formatYuan } from '../money'
import { Pager } from './pager'
import { AdminHeader, messageOf } from './shared'
import { UserActions, type UserAction } from './user-actions'

/*
 * 后台用户表（PRD 2.12、7.3）：自研简单表格，偏移分页，按邮箱搜索。
 * 列：昵称、邮箱、注册时间、注册 IP、同 IP 账号数、本周花费、调用次数、状态。
 * 操作：封号 / 解封（Better Auth admin 插件）、调整加购余额（/api/v1）。
 */

const PAGE_SIZE = 20

export function UsersPanel() {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const query = useQuery(adminUsersQuery({ q: q || undefined, offset, limit: PAGE_SIZE }))

  return (
    <div className="flex flex-col gap-4">
      <AdminHeader title="用户" description="本周 = 北京时间周一 00:00 起" />
      <form
        role="search"
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(draft.trim())
          setOffset(0)
        }}
      >
        <Input
          type="search"
          aria-label="按邮箱搜索"
          placeholder="按邮箱搜索，例如 qq.com"
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="secondary" icon="search">
          搜索
        </Button>
      </form>
      <Card className="p-0 md:p-0">
        {query.isPending ? (
          <TableSkeleton />
        ) : query.isError ? (
          <ErrorState
            message={messageOf(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            title={q ? '没找到这个邮箱' : '还没有用户'}
            description={q ? '换个关键词试试' : undefined}
          />
        ) : (
          <div className="px-4 pb-4 md:px-5">
            <UsersTable rows={query.data.items} />
            <Pager
              offset={offset}
              limit={PAGE_SIZE}
              total={query.data.total}
              onOffsetChange={setOffset}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="flex flex-col gap-3 p-5">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

const th = 'text-tiny text-muted px-3 py-3 text-left font-semibold whitespace-nowrap'
const td = 'text-caption px-3 py-3 align-middle whitespace-nowrap'

interface UsersTableProps {
  rows: readonly AdminUserRow[]
  /** Playbook 演示：操作只弹提示 */
  demo?: boolean
}

export function UsersTable({ rows, demo = false }: UsersTableProps) {
  const [action, setAction] = useState<UserAction | null>(null)
  return (
    <>
      <div className="-mx-4 overflow-x-auto md:-mx-5">
        <table className="w-full min-w-240 border-collapse">
          <caption className="sr-only">用户列表</caption>
          <thead className="border-border border-b">
            <tr>
              <th scope="col" className={th}>
                昵称 / 邮箱
              </th>
              <th scope="col" className={th}>
                注册时间
              </th>
              <th scope="col" className={th}>
                注册 IP
              </th>
              <th scope="col" className={`${th} text-right`}>
                同 IP 账号
              </th>
              <th scope="col" className={`${th} text-right`}>
                本周花费
              </th>
              <th scope="col" className={`${th} text-right`}>
                本周调用
              </th>
              <th scope="col" className={`${th} text-right`}>
                加购余额
              </th>
              <th scope="col" className={th}>
                状态
              </th>
              <th scope="col" className={th}>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((u) => (
              <tr key={u.userId}>
                <td className={`${td} max-w-64`}>
                  <p className="text-body truncate font-semibold">
                    {u.nickname ?? '（未完成引导）'}
                    {u.role === 'admin' && (
                      <Badge tone="primary" className="ml-2 align-middle">
                        管理员
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted truncate">{u.email}</p>
                </td>
                <td className={`${td} tabular-nums`}>
                  {formatDateTime(u.createdAt, BUSINESS_TIME_ZONE)}
                </td>
                <td className={`${td} font-mono`}>{u.signupIp ?? '—'}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {u.sameIpCount > 3 ? (
                    <Badge tone="warning">{u.sameIpCount}</Badge>
                  ) : (
                    u.sameIpCount
                  )}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatYuan(u.weekSpentMicros)}</td>
                <td className={`${td} text-right tabular-nums`}>{u.weekCalls}</td>
                <td className={`${td} text-right tabular-nums`}>{formatYuan(u.bonusMicros)}</td>
                <td className={td}>
                  {u.status === 'banned' ? (
                    <span className="flex flex-col gap-0.5">
                      <Badge tone="danger" dot className="self-start">
                        已停用
                      </Badge>
                      <span className="text-tiny text-muted max-w-40 truncate">
                        {u.banExpiresAt
                          ? `${formatDateTime(u.banExpiresAt, BUSINESS_TIME_ZONE)} 恢复`
                          : '永久'}
                        {u.banReason ? ` · ${u.banReason}` : ''}
                      </span>
                    </span>
                  ) : (
                    <Badge tone="success" dot>
                      正常
                    </Badge>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => setAction({ kind: 'quota', user: u })}>
                      调额度
                    </Button>
                    {u.role !== 'admin' &&
                      (u.status === 'banned' ? (
                        <Button
                          variant="ghost"
                          onClick={() => setAction({ kind: 'unban', user: u })}
                        >
                          解封
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          onClick={() => setAction({ kind: 'ban', user: u })}
                        >
                          封号
                        </Button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserActions action={action} onClose={() => setAction(null)} demo={demo} />
    </>
  )
}
