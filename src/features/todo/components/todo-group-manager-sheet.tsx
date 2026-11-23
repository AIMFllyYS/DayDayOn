'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError, newIdempotencyKey } from '@/lib/api'
import {
  useCreateTodoGroup,
  useDeleteTodoGroup,
  useReorderTodoGroups,
  useUpdateTodoGroup,
} from '@/lib/api/queries/todos'
import { cn } from '@/lib/cn'
import { TODO_GROUP_NAME_MAX, type TodoGroup } from '../schemas'
import { moveArrayItem, useLongPressReorder } from '../use-long-press-reorder'

/*
 * 管理分组抽屉（菜单 → 管理分组）：
 * - 新建、重命名、长按拖拽排序（同时提供上移/下移无障碍按钮）、删除自定义分组（二次确认，待办迁回「默认待办」）；
 * - 「默认待办」分组受保护不可删除或重命名，但支持调整展示顺序。
 */

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

interface TodoGroupManagerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: readonly TodoGroup[]
}

function messageOf(err: unknown): string {
  return errorMessage(isApiError(err) ? err : { code: 'INTERNAL' })
}

export function TodoGroupManagerSheet({ open, onOpenChange, groups }: TodoGroupManagerSheetProps) {
  const createGroup = useCreateTodoGroup()
  const updateGroup = useUpdateTodoGroup()
  const deleteGroup = useDeleteTodoGroup()
  const reorderGroups = useReorderTodoGroups()

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<TodoGroup | null>(null)

  const groupIds = groups.map((g) => g.id)
  const groupById = new Map(groups.map((g) => [g.id, g]))

  const drag = useLongPressReorder({
    ids: groupIds,
    enabled: groups.length > 1 && editingId === null,
    onReorder: (nextIds) => {
      reorderGroups.mutate({ groupIds: nextIds }, { onError: (err) => toast.error(messageOf(err)) })
    },
  })

  const orderedGroups = drag.orderedIds
    .map((id) => groupById.get(id))
    .filter((g): g is TodoGroup => g !== undefined)

  function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    createGroup.mutate(
      { input: { name: trimmed }, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: () => {
          setNewName('')
          toast.success(`已新建分组「${trimmed}」`)
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  function handleRename(group: TodoGroup) {
    const trimmed = editingName.trim()
    if (!trimmed || trimmed === group.name) {
      setEditingId(null)
      return
    }
    updateGroup.mutate(
      { groupId: group.id, input: { name: trimmed } },
      {
        onSuccess: () => {
          setEditingId(null)
          toast.success('分组名称已更新')
        },
        onError: (err) => toast.error(messageOf(err)),
      },
    )
  }

  function handleMove(index: number, delta: -1 | 1) {
    const next = moveArrayItem(groupIds, index, index + delta)
    reorderGroups.mutate({ groupIds: next }, { onError: (err) => toast.error(messageOf(err)) })
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title="管理待办分组"
        description="长按分组可拖拽调整顺序；删除分组时待办会安全移回「默认待办」"
      >
        <div className="flex flex-col gap-3">
          {/* 新建分组输入框 */}
          <div className="flex items-center gap-2">
            <Input
              aria-label="新分组名称"
              value={newName}
              maxLength={TODO_GROUP_NAME_MAX}
              placeholder="输入新分组名，例如：学习、生活"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreate()
                }
              }}
            />
            <Button
              size="sm"
              variant="soft"
              icon="plus"
              className="shrink-0"
              loading={createGroup.isPending}
              disabled={newName.trim().length === 0}
              onClick={handleCreate}
            >
              新建
            </Button>
          </div>

          {/* 分组有序列表 */}
          <ul className="divide-border border-border bg-surface divide-y rounded-xl border">
            {orderedGroups.map((group, idx) => {
              const isEditing = editingId === group.id
              const isDragging = drag.draggingId === group.id
              return (
                <li
                  key={group.id}
                  ref={drag.registerItem(group.id)}
                  style={
                    isDragging
                      ? {
                          transform: `translate3d(0, ${drag.dragOffsetY}px, 0) scale(1.015)`,
                          zIndex: 20,
                        }
                      : undefined
                  }
                  className={cn(
                    'flex min-h-12 items-center gap-1.5 px-2.5 py-1.5 select-none',
                    isDragging && 'bg-surface shadow-float ring-primary/40 rounded-xl ring-2',
                  )}
                  {...drag.bindItem(group.id)}
                >
                  <Icon name="grip" size={14} className="text-subtle shrink-0" />
                  {isEditing ? (
                    <div data-no-drag="true" className="flex min-w-0 flex-1 items-center gap-1.5">
                      <Input
                        aria-label="编辑分组名"
                        value={editingName}
                        maxLength={TODO_GROUP_NAME_MAX}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleRename(group)
                          } else if (e.key === 'Escape') {
                            setEditingId(null)
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="soft"
                        loading={updateGroup.isPending}
                        onClick={() => handleRename(group)}
                      >
                        保存
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-caption min-w-0 flex-1 truncate font-semibold">
                        {group.name}
                      </span>
                      {group.isDefault && <Badge tone="primary">默认</Badge>}
                      <span className="font-display text-tiny text-muted shrink-0 tabular-nums">
                        {group.openCount} 项
                      </span>
                      <div data-no-drag="true" className="flex shrink-0 items-center">
                        <IconButton
                          size="sm"
                          icon="chevron-up"
                          label={`上移分组：${group.name}`}
                          disabled={idx === 0 || reorderGroups.isPending}
                          onClick={() => handleMove(idx, -1)}
                        />
                        <IconButton
                          size="sm"
                          icon="chevron-down"
                          label={`下移分组：${group.name}`}
                          disabled={idx === orderedGroups.length - 1 || reorderGroups.isPending}
                          onClick={() => handleMove(idx, 1)}
                        />
                        {!group.isDefault && (
                          <>
                            <IconButton
                              size="sm"
                              icon="edit"
                              label={`重命名分组：${group.name}`}
                              onClick={() => {
                                setEditingId(group.id)
                                setEditingName(group.name)
                              }}
                            />
                            <IconButton
                              size="sm"
                              icon="trash"
                              label={`删除分组：${group.name}`}
                              onClick={() => setPendingDelete(group)}
                            />
                          </>
                        )}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </Sheet>

      {pendingDelete !== null && (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDelete(null)
          }}
          title={`删除分组「${pendingDelete.name}」？`}
          description="该分组里的待办不会丢失，会自动移回「默认待办」分组。"
          confirmLabel="确认删除"
          tone="danger"
          onConfirm={async () => {
            const target = pendingDelete
            if (!target) return
            try {
              await deleteGroup.mutateAsync(target.id)
              toast.success(`已删除分组「${target.name}」`)
              setPendingDelete(null)
            } catch (err) {
              toast.error(messageOf(err))
              throw err
            }
          }}
        />
      )}
    </>
  )
}
