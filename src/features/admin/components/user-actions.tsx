'use client'

import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { NumberField } from '@/components/ui/number-field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { type AdminUserRow, QuotaAdjustmentSchema } from '@/features/admin/schemas'
import { isApiError, newIdempotencyKey } from '@/lib/api'
import { useAdjustQuota, useBanUser, useUnbanUser } from '@/lib/api/queries/admin'
import { formatYuan, yuanToMicros } from '../money'
import { ConfirmDialog, messageOf, Sheet } from './shared'

/*
 * 用户行上的操作：封号（原因 + 可选到期）、解封、调整加购余额。
 * 封号 / 解封调 Better Auth admin 插件（会吊销会话），审计由 auth hooks 写；调额度走 /api/v1。
 */

export type UserAction =
  | { kind: 'ban'; user: AdminUserRow }
  | { kind: 'unban'; user: AdminUserRow }
  | { kind: 'quota'; user: AdminUserRow }

interface UserActionsProps {
  action: UserAction | null
  onClose: () => void
  demo?: boolean
}

export function UserActions({ action, onClose, demo = false }: UserActionsProps) {
  const unban = useUnbanUser()
  const name = action ? (action.user.nickname ?? action.user.email) : ''
  return (
    <>
      <Sheet
        open={action?.kind === 'ban'}
        onOpenChange={(o) => !o && onClose()}
        title={`停用 ${name}`}
        description="停用后对方立即退出登录，接口全部拒绝，并从排行和动态里消失"
      >
        {action?.kind === 'ban' && (
          <BanForm key={action.user.userId} user={action.user} onDone={onClose} demo={demo} />
        )}
      </Sheet>
      <Sheet
        open={action?.kind === 'quota'}
        onOpenChange={(o) => !o && onClose()}
        title={`调整 ${name} 的加购余额`}
        description={
          action ? `当前加购余额 ${formatYuan(action.user.bonusMicros)}，会写一条流水` : undefined
        }
      >
        {action?.kind === 'quota' && (
          <QuotaForm key={action.user.userId} user={action.user} onDone={onClose} demo={demo} />
        )}
      </Sheet>
      <ConfirmDialog
        open={action?.kind === 'unban'}
        onOpenChange={(o) => !o && onClose()}
        title={`恢复 ${name}？`}
        description="对方可以重新登录和使用全部功能。"
        confirmLabel="解封"
        onConfirm={async () => {
          if (!action) return
          if (demo) return void toast.info('演示：已解封')
          try {
            await unban.mutateAsync(action.user.userId)
            toast.success('已解封')
          } catch (error) {
            toast.error(messageOf(error))
            throw error
          }
        }}
      />
    </>
  )
}

const BAN_DURATIONS = [
  { value: 'forever', label: '永久', seconds: undefined },
  { value: '1d', label: '1 天', seconds: 86_400 },
  { value: '7d', label: '7 天', seconds: 7 * 86_400 },
  { value: '30d', label: '30 天', seconds: 30 * 86_400 },
] as const
type BanDuration = (typeof BAN_DURATIONS)[number]['value']

const BanSchema = z.object({
  banReason: z
    .string()
    .trim()
    .min(1, { error: '写一下停用原因' })
    .max(200, { error: '最多 200 字' }),
})

function BanForm({
  user,
  onDone,
  demo,
}: {
  user: AdminUserRow
  onDone: () => void
  demo: boolean
}) {
  const ban = useBanUser()
  const [duration, setDuration] = useState<BanDuration>('forever')
  const [errors, setErrors] = useState<FormErrors>()

  return (
    <Form
      errors={errors}
      onFormSubmit={async (values) => {
        const r = BanSchema.safeParse(values)
        if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
        const seconds = BAN_DURATIONS.find((d) => d.value === duration)?.seconds
        if (demo) {
          toast.info('演示：已停用')
          return onDone()
        }
        try {
          await ban.mutateAsync({
            userId: user.userId,
            banReason: r.data.banReason,
            ...(seconds ? { banExpiresIn: seconds } : {}),
          })
          toast.success('已停用')
          onDone()
        } catch (error) {
          toast.error(messageOf(error))
        }
      }}
    >
      <Field label="原因" htmlFor="ban-reason" name="banReason" hint="会显示给对方">
        <Textarea id="ban-reason" maxLength={200} placeholder="例如：批量注册刷额度" />
      </Field>
      <Field label="停用多久" htmlFor="ban-duration">
        <Select
          id="ban-duration"
          options={BAN_DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
          value={duration}
          onValueChange={setDuration}
        />
      </Field>
      <Button type="submit" variant="danger" loading={ban.isPending}>
        停用账号
      </Button>
    </Form>
  )
}

type Direction = 'add' | 'subtract'

function QuotaForm({
  user,
  onDone,
  demo,
}: {
  user: AdminUserRow
  onDone: () => void
  demo: boolean
}) {
  const adjust = useAdjustQuota()
  const [direction, setDirection] = useState<Direction>('add')
  const [yuan, setYuan] = useState<number | null>(10)
  const [errors, setErrors] = useState<FormErrors>()
  // 一次提交一个幂等键：内容不变的重试复用它（服务端不会加两次），改了内容换新键
  const [attempt, setAttempt] = useState<{ key: string; payload: string } | null>(null)

  return (
    <Form
      errors={errors}
      onFormSubmit={async (values) => {
        const micros = yuan === null ? null : yuanToMicros(yuan)
        const amountMicros = micros === null ? Number.NaN : direction === 'add' ? micros : -micros
        const r = QuotaAdjustmentSchema.safeParse({ amountMicros, reason: values.reason })
        if (!r.success) {
          const f = z.flattenError(r.error).fieldErrors
          return setErrors({ amount: f.amountMicros, reason: f.reason })
        }
        if (direction === 'subtract' && r.data.amountMicros + user.bonusMicros < 0) {
          return setErrors({ amount: [`最多扣 ${formatYuan(user.bonusMicros)}`] })
        }
        if (demo) {
          toast.info('演示：已调整')
          return onDone()
        }
        const payload = JSON.stringify([user.userId, r.data])
        const key = attempt?.payload === payload ? attempt.key : newIdempotencyKey()
        setAttempt({ key, payload })
        try {
          const res = await adjust.mutateAsync({
            userId: user.userId,
            input: r.data,
            idempotencyKey: key,
          })
          toast.success(`已调整，加购余额 ${formatYuan(res.bonusMicros)}`)
          onDone()
        } catch (error) {
          if (isApiError(error) && error.code === 'IDEMPOTENCY_KEY_REUSED') {
            toast.info('这次调整已经提交过了，去列表里核对一下')
            return onDone()
          }
          if (isApiError(error) && error.fields) {
            setErrors({ amount: error.fields.amountMicros, reason: error.fields.reason })
          }
          toast.error(messageOf(error))
        }
      }}
    >
      <SegmentedControl
        label="增加还是扣减"
        options={[
          { value: 'add', label: '增加' },
          { value: 'subtract', label: '扣减' },
        ]}
        value={direction}
        onValueChange={(next) => {
          setDirection(next)
          setErrors((prev) => (prev?.amount ? { ...prev, amount: undefined } : prev))
        }}
      />
      <Field label="金额" htmlFor="quota-amount" name="amount" hint="单位元，最多两位小数">
        <NumberField
          id="quota-amount"
          value={yuan}
          onValueChange={(v) => {
            setYuan(v)
            setErrors((prev) => (prev?.amount ? { ...prev, amount: undefined } : prev))
          }}
          min={0.01}
          max={1000}
          step={1}
          unit="元"
          format={{ maximumFractionDigits: 2 }}
        />
      </Field>
      <Field label="原因" htmlFor="quota-reason" name="reason" hint="写进流水，方便以后对账">
        <Input id="quota-reason" maxLength={200} placeholder="例如：识别失败补偿" />
      </Field>
      <Button type="submit" loading={adjust.isPending}>
        {direction === 'add' ? '增加' : '扣减'}
        {yuan !== null ? ` ${formatYuan(yuanToMicros(yuan) ?? 0)}` : ''}
      </Button>
    </Form>
  )
}
