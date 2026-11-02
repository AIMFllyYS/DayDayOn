import * as z from 'zod'

export const NotificationKindSchema = z.enum([
  'checkin_aggregate',
  'pet_interaction',
  'visit_footprint',
  'system',
  'friend',
])
export type NotificationKind = z.infer<typeof NotificationKindSchema>

export const NotificationChannelSchema = z.enum(['feed', 'system', 'all'])
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  actorId: z.string().nullable(),
  actorNickname: z.string().nullable(),
  actorAvatar: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})
export type NotificationItem = z.infer<typeof NotificationItemSchema>

export const NotificationSummarySchema = z.object({
  unreadCount: z.number().int().nonnegative(),
  hasUnread: z.boolean(),
})
export type NotificationSummary = z.infer<typeof NotificationSummarySchema>

export const NotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  channel: NotificationChannelSchema.default('all'),
  unreadOnly: z.coerce.boolean().optional(),
})
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationItemSchema),
  nextCursor: z.string().nullable(),
})
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>

export const MarkNotificationReadInputSchema = z.object({
  all: z.boolean().optional(),
  notificationIds: z.array(z.string().uuid()).optional(),
  channel: NotificationChannelSchema.optional(),
  kind: z.string().optional(),
})
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>

export const MarkNotificationReadResponseSchema = z.object({
  success: z.boolean(),
  markedCount: z.number().int().nonnegative(),
})
export type MarkNotificationReadResponse = z.infer<typeof MarkNotificationReadResponseSchema>
