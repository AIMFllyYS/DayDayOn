import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import type {
  DraftField,
  TodoDeleteDraft,
  TodoDraftSnapshot,
  TodoGroupDraft,
  TodoUpdateDraft,
} from '@/features/agent/schemas'
import { TODO_PRIORITY_META } from '@/features/todo/rules'
import {
  TODO_DEFAULT_GROUP_NAME,
  TODO_GROUP_LIMIT,
  TODO_OPEN_LIMIT,
  type Todo,
  type TodoLifecycleStatus,
  type TodoPriority,
} from '@/features/todo/schemas'
import { formatDateTime } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { todoGroups, todos } from '@/server/db/schema'
import { getTodoById } from './index'

/*
 * Agent 待办草稿的只读预校验与预览快照（镜像 server/services/checkins/preview.ts）：
 * 绝不写数据库，只做归属/上限/默认分组保护预检，并构建改前改后对比与精确 confirmBody。
 */

const STATUS_LABEL: Record<TodoLifecycleStatus, string> = {
  open: '进行中',
  done: '已完成',
  abandoned: '已放弃',
}

function toSnapshot(t: Todo): TodoDraftSnapshot {
  return {
    title: t.title,
    status: t.status,
    groupName: t.groupName,
    priority: t.priority,
    dueAt: t.dueAt,
    tags: t.tags,
    note: t.note,
    abandonReason: t.abandonReason,
    isArchived: t.isArchived,
  }
}

async function countOpenTodos(db: DbOrTx, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.status, 'open')))
  return Number(row?.count ?? 0)
}

async function countUserGroups(db: DbOrTx, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(todoGroups)
    .where(eq(todoGroups.userId, userId))
  return Number(row?.count ?? 0)
}

async function findGroupById(db: DbOrTx, userId: string, groupId: string) {
  const [group] = await db
    .select({ id: todoGroups.id, name: todoGroups.name, isDefault: todoGroups.isDefault })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.id, groupId)))
    .limit(1)
  return group ?? null
}

async function findGroupByName(db: DbOrTx, userId: string, name: string) {
  const trimmed = name.trim()
  const [group] = await db
    .select({ id: todoGroups.id, name: todoGroups.name, isDefault: todoGroups.isDefault })
    .from(todoGroups)
    .where(and(eq(todoGroups.userId, userId), eq(todoGroups.name, trimmed)))
    .limit(1)
  return group ?? null
}

/** 新建待办前的只读上限预检 */
export async function previewTodoCreateLimits(
  db: DbOrTx,
  userId: string,
  creatingNewGroup: boolean,
): Promise<void> {
  const openCount = await countOpenTodos(db, userId)
  if (openCount >= TODO_OPEN_LIMIT) {
    throw new ApiError('TODO_LIMIT_REACHED', `进行中的待办最多 ${TODO_OPEN_LIMIT} 条`)
  }
  if (creatingNewGroup) {
    const groupCount = await countUserGroups(db, userId)
    if (groupCount >= TODO_GROUP_LIMIT) {
      throw new ApiError('TODO_GROUP_LIMIT_REACHED', `分组最多 ${TODO_GROUP_LIMIT} 个`)
    }
  }
}

export interface PreviewUpdateTodoInput {
  todoId: string
  title?: string
  note?: string | null
  dueAt?: string | null
  priority?: TodoPriority
  tags?: string[]
  groupName?: string
  status?: TodoLifecycleStatus
  abandonReason?: string | null
  reason: string
  timeZone: string
}

/** 预览修改待办（编辑字段 / 移组 / 完成 / 放弃 / 恢复含归档） */
export async function previewUpdateTodo(
  db: DbOrTx,
  userId: string,
  input: PreviewUpdateTodoInput,
  now: Date,
): Promise<TodoUpdateDraft> {
  const current = await getTodoById(db, userId, input.todoId, now)
  const confirmBody: Record<string, unknown> = {}
  const changes: DraftField[] = []

  let nextTitle = current.title
  if (input.title !== undefined && input.title !== current.title) {
    nextTitle = input.title
    confirmBody.title = nextTitle
    changes.push({ label: '标题', value: nextTitle })
  }

  let nextNote = current.note
  if (input.note !== undefined) {
    const normalized = input.note && input.note.trim().length > 0 ? input.note.trim() : null
    if (normalized !== current.note) {
      nextNote = normalized
      confirmBody.note = nextNote
      changes.push({
        label: '备注',
        value: nextNote
          ? nextNote.length > 48
            ? `${nextNote.slice(0, 48)}…`
            : nextNote
          : '清空备注',
      })
    }
  }

  let nextDueAt = current.dueAt
  if (input.dueAt !== undefined && input.dueAt !== current.dueAt) {
    nextDueAt = input.dueAt
    confirmBody.dueAt = nextDueAt
    changes.push({
      label: '截止',
      value: nextDueAt ? formatDateTime(nextDueAt, input.timeZone) : '取消截止时间',
    })
  }

  let nextPriority = current.priority
  if (input.priority !== undefined && input.priority !== current.priority) {
    nextPriority = input.priority
    confirmBody.priority = nextPriority
    changes.push({
      label: '优先级',
      value: `${TODO_PRIORITY_META[current.priority].label} → ${TODO_PRIORITY_META[nextPriority].label}`,
    })
  }

  let nextTags = current.tags
  if (input.tags !== undefined) {
    const unique = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))]
    if (JSON.stringify(unique) !== JSON.stringify(current.tags)) {
      nextTags = unique
      confirmBody.tags = unique
      changes.push({
        label: '标签',
        value: unique.length > 0 ? unique.join(' · ') : '清空标签',
      })
    }
  }

  let nextGroupName = current.groupName
  let isNewGroup = false
  if (input.groupName !== undefined && input.groupName.trim() !== current.groupName) {
    const targetName = input.groupName.trim()
    const found = await findGroupByName(db, userId, targetName)
    if (found) {
      if (found.id !== current.groupId) {
        nextGroupName = found.name
        confirmBody.groupId = found.id
        changes.push({ label: '分组', value: `${current.groupName} → ${found.name}` })
      }
    } else if (targetName !== TODO_DEFAULT_GROUP_NAME) {
      const groupCount = await countUserGroups(db, userId)
      if (groupCount >= TODO_GROUP_LIMIT) {
        throw new ApiError('TODO_GROUP_LIMIT_REACHED', `分组最多 ${TODO_GROUP_LIMIT} 个`)
      }
      nextGroupName = targetName
      isNewGroup = true
      confirmBody.newGroupName = targetName
      changes.push({ label: '分组', value: `${current.groupName} → ${targetName}（将新建）` })
    }
  }

  let nextStatus = current.status
  let nextAbandonReason = current.abandonReason
  let action: TodoUpdateDraft['action'] = 'edit'

  if (input.status !== undefined && input.status !== current.status) {
    if (input.status === 'open' && current.status !== 'open') {
      const openCount = await countOpenTodos(db, userId)
      if (openCount >= TODO_OPEN_LIMIT) {
        throw new ApiError('TODO_LIMIT_REACHED', `进行中的待办最多 ${TODO_OPEN_LIMIT} 条`)
      }
      action = 'reopen'
      nextAbandonReason = null
    } else if (input.status === 'done') {
      action = 'complete'
      nextAbandonReason = null
    } else if (input.status === 'abandoned') {
      action = 'abandon'
    }
    nextStatus = input.status
    confirmBody.status = nextStatus
    changes.push({
      label: '状态',
      value: `${current.isArchived ? '已归档' : STATUS_LABEL[current.status]} → ${STATUS_LABEL[nextStatus]}`,
    })
  }

  if (input.abandonReason !== undefined && nextStatus === 'abandoned') {
    const trimmed = input.abandonReason?.trim() || null
    if (trimmed !== current.abandonReason || confirmBody.status === 'abandoned') {
      nextAbandonReason = trimmed
      confirmBody.abandonReason = nextAbandonReason
      if (nextAbandonReason) {
        changes.push({ label: '放弃原因', value: nextAbandonReason })
      }
    }
  }

  if (Object.keys(confirmBody).length === 0) {
    throw new ApiError('VALIDATION_FAILED', '这条待办和当前内容完全一致，没有需要修改的项目')
  }

  const before = toSnapshot(current)
  const after: TodoDraftSnapshot = {
    title: nextTitle,
    status: nextStatus,
    groupName: nextGroupName,
    priority: nextPriority,
    dueAt: nextDueAt,
    tags: nextTags,
    note: nextNote,
    abandonReason: nextAbandonReason,
    isArchived: nextStatus === 'open' ? false : current.isArchived,
  }

  return {
    kind: 'todo-update',
    todoId: current.id,
    action,
    reason: input.reason,
    before,
    after,
    isNewGroup: isNewGroup || undefined,
    changes,
    confirmBody,
  }
}

/** 预览删除一条待办（过程时间轴保留删除快照） */
export async function previewDeleteTodo(
  db: DbOrTx,
  userId: string,
  todoId: string,
  reason: string,
  now: Date,
): Promise<TodoDeleteDraft> {
  const current = await getTodoById(db, userId, todoId, now)
  return {
    kind: 'todo-delete',
    todoId: current.id,
    reason,
    before: toSnapshot(current),
  }
}

export interface PreviewTodoGroupInput {
  action: 'create' | 'rename' | 'delete'
  groupId?: string
  name?: string
  newName?: string
  reason?: string
}

/** 预览新建 / 重命名 / 删除自定义分组 */
export async function previewTodoGroup(
  db: DbOrTx,
  userId: string,
  input: PreviewTodoGroupInput,
): Promise<TodoGroupDraft> {
  if (input.action === 'create') {
    const name = (input.newName ?? input.name ?? '').trim()
    if (!name) {
      throw new ApiError('VALIDATION_FAILED', '请提供要新建的分组名称')
    }
    const existing = await findGroupByName(db, userId, name)
    if (existing) {
      throw new ApiError('TODO_GROUP_NAME_EXISTS', `分组「${name}」已存在`)
    }
    const count = await countUserGroups(db, userId)
    if (count >= TODO_GROUP_LIMIT) {
      throw new ApiError('TODO_GROUP_LIMIT_REACHED', `分组最多 ${TODO_GROUP_LIMIT} 个`)
    }
    return {
      kind: 'todo-group',
      action: 'create',
      name,
      reason: input.reason,
      confirmBody: { name },
    }
  }

  const target = input.groupId
    ? await findGroupById(db, userId, input.groupId)
    : input.name
      ? await findGroupByName(db, userId, input.name)
      : null
  if (!target) {
    throw new ApiError('TODO_GROUP_NOT_FOUND', '没有找到这个待办分组')
  }
  if (target.isDefault) {
    throw new ApiError(
      'TODO_DEFAULT_GROUP_PROTECTED',
      `「${TODO_DEFAULT_GROUP_NAME}」是系统默认分组，不能重命名或删除`,
    )
  }

  if (input.action === 'rename') {
    const newName = (input.newName ?? '').trim()
    if (!newName) {
      throw new ApiError('VALIDATION_FAILED', '请提供新的分组名称')
    }
    if (newName === target.name) {
      throw new ApiError('VALIDATION_FAILED', '新分组名与原名称相同')
    }
    const conflict = await findGroupByName(db, userId, newName)
    if (conflict) {
      throw new ApiError('TODO_GROUP_NAME_EXISTS', `分组「${newName}」已存在`)
    }
    return {
      kind: 'todo-group',
      action: 'rename',
      groupId: target.id,
      name: target.name,
      newName,
      reason: input.reason,
      confirmBody: { name: newName },
    }
  }

  // delete: 统计组内待办数（删除时后端事务会把组内待办安全迁回默认分组）
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.groupId, target.id)))
  return {
    kind: 'todo-group',
    action: 'delete',
    groupId: target.id,
    name: target.name,
    affectedTodoCount: Number(row?.count ?? 0),
    reason: input.reason,
  }
}
