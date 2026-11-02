import 'server-only'
import { and, count, desc, eq, isNull, lt, or } from 'drizzle-orm'
import type {
  ChatHistoryQuery,
  ChatHistoryResponse,
  ChatMessageDto,
  ChatThreadDto,
  ChatThreadsResponse,
  MarkChatReadResponse,
  SendChatMessageInput,
  SendChatMessageResponse,
} from '@/features/chat/schemas'
import { ApiError } from '@/server/api/errors'
import { db as defaultDb, type DbOrTx } from '@/server/db/client'
import { chatMessages, friendships, profiles, user } from '@/server/db/schema'
import { assertTextClean } from '@/server/moderation'
import { createNotification } from '@/server/services/notifications'

/**
 * 获取当前用户的私聊会话列表（Issue #25 · #26 · M6 · Decision #4 & #6）
 * 包含所有当前好友，以及曾有过聊天记录的前好友（标记 isFrozen: true）
 */
export async function getChatThreads(
  db: DbOrTx = defaultDb,
  currentUserId: string,
): Promise<ChatThreadsResponse> {
  // 1. 查询当前用户的全部有效好友关系
  const activeFriendships = await db
    .select({
      friendId: friendships.friendId,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .where(eq(friendships.userId, currentUserId))

  const activeFriendIdSet = new Set(activeFriendships.map((f) => f.friendId))

  // 2. 查询与当前用户有过私聊往来的全部用户 ID（包含已解除好友的前好友）
  const messagePartners = await db
    .select({
      senderId: chatMessages.senderId,
      recipientId: chatMessages.recipientId,
    })
    .from(chatMessages)
    .where(
      or(eq(chatMessages.senderId, currentUserId), eq(chatMessages.recipientId, currentUserId)),
    )

  const allPartnerIds = new Set<string>()
  for (const f of activeFriendships) {
    allPartnerIds.add(f.friendId)
  }
  for (const m of messagePartners) {
    if (m.senderId === currentUserId && m.recipientId !== currentUserId) {
      allPartnerIds.add(m.recipientId)
    } else if (m.recipientId === currentUserId && m.senderId !== currentUserId) {
      allPartnerIds.add(m.senderId)
    }
  }

  if (allPartnerIds.size === 0) {
    return { threads: [] }
  }

  const partnerIdList = Array.from(allPartnerIds)

  // 3. 对每个对话方并行构建会话概要
  const threadPromises = partnerIdList.map(async (partnerId): Promise<ChatThreadDto> => {
    const isFrozen = !activeFriendIdSet.has(partnerId)

    // 对方公开资料
    const [partnerUser] = await db
      .select({
        name: user.name,
        nickname: profiles.nickname,
        avatar: profiles.avatar,
        mascot: profiles.mascot,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(eq(user.id, partnerId))
      .limit(1)

    // 双方最新一条私聊消息
    const [lastMsg] = await db
      .select()
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.senderId, currentUserId), eq(chatMessages.recipientId, partnerId)),
          and(eq(chatMessages.senderId, partnerId), eq(chatMessages.recipientId, currentUserId)),
        ),
      )
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(1)

    // 对方发给我且未读的消息数量
    const [unreadResult] = await db
      .select({ unreadCount: count() })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.senderId, partnerId),
          eq(chatMessages.recipientId, currentUserId),
          isNull(chatMessages.readAt),
        ),
      )

    const nickname = partnerUser?.nickname?.trim() || partnerUser?.name?.trim() || '好友'

    return {
      friendUserId: partnerId,
      friend: {
        userId: partnerId,
        nickname,
        avatar: partnerUser?.avatar ?? null,
        mascot: partnerUser?.mascot ?? null,
      },
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            createdAt: lastMsg.createdAt.toISOString(),
            senderId: lastMsg.senderId,
          }
        : null,
      unreadCount: Number(unreadResult?.unreadCount ?? 0),
      isFrozen,
    }
  })

  const threads = await Promise.all(threadPromises)

  // 4. 排序规则：最新有消息的会话排在前面，若无消息则靠后
  threads.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return (
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
      )
    }
    if (a.lastMessage) return -1
    if (b.lastMessage) return 1
    return 0
  })

  return { threads }
}

/**
 * 获取指定好友的 1v1 私聊历史记录（支持基于游标的分页）
 * 严格履行 Decision #6：解除好友后历史聊天记录可供只读查阅（isFrozen: true）
 */
export async function getChatHistory(
  db: DbOrTx = defaultDb,
  currentUserId: string,
  friendUserId: string,
  options: Partial<ChatHistoryQuery> = {},
  now: Date = new Date(),
): Promise<ChatHistoryResponse> {
  const limit = options.limit ?? 30
  const cursor = options.cursor

  // 1. 检查双方好友关系
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, currentUserId), eq(friendships.friendId, friendUserId)))
    .limit(1)

  let isFrozen = false

  if (!friendship) {
    // 双方已非好友：检查是否有历史私聊记录
    const [historicalMsg] = await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.senderId, currentUserId), eq(chatMessages.recipientId, friendUserId)),
          and(eq(chatMessages.senderId, friendUserId), eq(chatMessages.recipientId, currentUserId)),
        ),
      )
      .limit(1)

    if (!historicalMsg) {
      // 既非好友也无历史消息
      throw new ApiError('FRIEND_NOT_FOUND', '未找到该好友关系')
    }

    // 存在历史消息：进入 Decision #6 只读归档模式
    isFrozen = true
  }

  // 2. 加载目标好友公开昵称、头像与陪伴形象
  const [friendUser] = await db
    .select({
      name: user.name,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
      mascot: profiles.mascot,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, friendUserId))
    .limit(1)

  const friendNickname = friendUser?.nickname?.trim() || friendUser?.name?.trim() || '好友'
  const friendAvatar = friendUser?.avatar ?? null
  const friendMascot = friendUser?.mascot ?? null

  // 3. 构建私聊记录查询条件
  const conditions = [
    or(
      and(eq(chatMessages.senderId, currentUserId), eq(chatMessages.recipientId, friendUserId)),
      and(eq(chatMessages.senderId, friendUserId), eq(chatMessages.recipientId, currentUserId)),
    ),
  ]

  // 处理基于游标的分页
  if (cursor) {
    const [cursorMsg] = await db
      .select({ createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.id, cursor))
      .limit(1)

    if (cursorMsg) {
      conditions.push(lt(chatMessages.createdAt, cursorMsg.createdAt))
    } else {
      const cursorDate = new Date(cursor)
      if (!Number.isNaN(cursorDate.getTime())) {
        conditions.push(lt(chatMessages.createdAt, cursorDate))
      }
    }
  }

  // 4. 查询 limit + 1 条判断下一页
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const resultRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore && resultRows.length > 0 ? resultRows[resultRows.length - 1].id : null

  // 5. 将对方发送给我的未读消息批量标记为已读
  await db
    .update(chatMessages)
    .set({ readAt: now })
    .where(
      and(
        eq(chatMessages.senderId, friendUserId),
        eq(chatMessages.recipientId, currentUserId),
        isNull(chatMessages.readAt),
      ),
    )

  const messages: ChatMessageDto[] = resultRows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    recipientId: r.recipientId,
    content: r.content,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt.toISOString(),
    readAt: r.readAt ? r.readAt.toISOString() : null,
    isMine: r.senderId === currentUserId,
  }))

  return {
    messages,
    nextCursor,
    isFrozen,
    friend: {
      userId: friendUserId,
      nickname: friendNickname,
      avatar: friendAvatar,
      mascot: friendMascot,
    },
  }
}

/**
 * 发送 1v1 好友私聊消息
 *
 * 核心规则与守则：
 * 1. 好友关系校验：若双方已解除好友，抛出 HTTP 403 FRIEND_RELATION_FROZEN，严禁发送新消息（Decision #6）；
 * 2. 幂等性校验：如果指定 (senderId, idempotencyKey) 已存在，直接幂等返回已有消息记录；
 * 3. 文本审核校验：调用 M5 assertTextClean（纯本地 DFA Trie 引擎），若命中敏感词抛出 HTTP 422 CONTENT_SENSITIVE，并保留用户草稿；若处于静音冷静期抛出 HTTP 403 USER_MUTED；
 * 4. 消息落库：向 chat_messages 写入纯文本（单条 ≤ 300 字）；
 * 5. 实时通知：向 recipient 发送好友私信提醒通知。
 */
export async function sendChatMessage(
  db: DbOrTx = defaultDb,
  currentUserId: string,
  friendUserId: string,
  input: SendChatMessageInput,
  now: Date = new Date(),
): Promise<SendChatMessageResponse> {
  if (currentUserId === friendUserId) {
    throw new ApiError('FORBIDDEN', '无法给自己发送私聊消息')
  }

  // 1. 好友关系校验（Decision #6）：必须双方为有效好友
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, currentUserId), eq(friendships.friendId, friendUserId)))
    .limit(1)

  if (!friendship) {
    throw new ApiError(
      'FRIEND_RELATION_FROZEN',
      '对方已不是你的好友，当前为只读历史存档，无法发送新消息',
    )
  }

  // 2. 幂等性检查
  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID()
  const [existing] = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.senderId, currentUserId),
        eq(chatMessages.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1)

  if (existing) {
    return {
      message: {
        id: existing.id,
        senderId: existing.senderId,
        recipientId: existing.recipientId,
        content: existing.content,
        idempotencyKey: existing.idempotencyKey,
        createdAt: existing.createdAt.toISOString(),
        readAt: existing.readAt ? existing.readAt.toISOString() : null,
        isMine: true,
      },
    }
  }

  // 3. 本地 DFA 敏感词与防刷频控拦截（M5 集成）
  await assertTextClean(input.content, {
    action: 'chat',
    userId: currentUserId,
    db,
    now,
  })

  // 4. 落库私聊消息
  const [inserted] = await db
    .insert(chatMessages)
    .values({
      senderId: currentUserId,
      recipientId: friendUserId,
      content: input.content,
      idempotencyKey,
      createdAt: now,
    })
    .returning()

  // 5. 查询发送者昵称与头像，生成通知
  const [senderUser] = await db
    .select({
      name: user.name,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, currentUserId))
    .limit(1)

  const senderNickname = senderUser?.nickname?.trim() || senderUser?.name?.trim() || '好友'
  const contentSummary =
    input.content.length > 30 ? `${input.content.slice(0, 30)}…` : input.content

  await createNotification(db, {
    userId: friendUserId,
    actorId: currentUserId,
    kind: 'friend',
    title: `${senderNickname} 给你发了一条私信`,
    content: contentSummary,
    metadata: {
      messageId: inserted.id,
      senderNickname,
      senderAvatar: senderUser?.avatar ?? null,
    },
    now,
  }).catch((err) => {
    console.error('[chat] Failed to insert chat notification:', err)
  })

  return {
    message: {
      id: inserted.id,
      senderId: inserted.senderId,
      recipientId: inserted.recipientId,
      content: inserted.content,
      idempotencyKey: inserted.idempotencyKey,
      createdAt: inserted.createdAt.toISOString(),
      readAt: inserted.readAt ? inserted.readAt.toISOString() : null,
      isMine: true,
    },
  }
}

/**
 * 批量将来自指定好友的未读消息标记为已读
 */
export async function markChatRead(
  db: DbOrTx = defaultDb,
  currentUserId: string,
  friendUserId: string,
  now: Date = new Date(),
): Promise<MarkChatReadResponse> {
  const result = await db
    .update(chatMessages)
    .set({ readAt: now })
    .where(
      and(
        eq(chatMessages.senderId, friendUserId),
        eq(chatMessages.recipientId, currentUserId),
        isNull(chatMessages.readAt),
      ),
    )
    .returning({ id: chatMessages.id })

  return {
    success: true,
    markedCount: result.length,
  }
}
