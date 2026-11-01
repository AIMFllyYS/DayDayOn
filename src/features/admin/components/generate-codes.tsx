'use client'

import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { toast } from '@/components/ui/toast'
import { type GeneratedCodes, GenerateCodesSchema } from '@/features/admin/schemas'
import { isApiError, newIdempotencyKey } from '@/lib/api'
import { useGenerateCodes } from '@/lib/api/queries/admin'
import { formatYuan } from '../money'
import { ConfirmDialog, messageOf, Sheet } from './shared'

/*
 * 批量生成兑换码（PRD 2.7、7.3）：1–100 个。明文只在响应里出现一次，关掉就看不到了：
 * 关闭前没复制过就二次确认。幂等键在打开弹层时生成，网络重试复用；服务端不存响应体，
 * 重放返回 409 IDEMPOTENCY_KEY_REUSED，这时提示去列表核对，不会重复生成。
 */

interface GenerateCodesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Playbook 演示：直接显示结果 */
  demoResult?: GeneratedCodes
}

export function GenerateCodesSheet({ open, onOpenChange, demoResult }: GenerateCodesSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="批量生成兑换码"
      description="明文只显示这一次，生成后请立刻复制保存"
    >
      {open && <GenerateFlow onClose={() => onOpenChange(false)} demoResult={demoResult} />}
    </Sheet>
  )
}

function GenerateFlow({
  onClose,
  demoResult,
}: {
  onClose: () => void
  demoResult?: GeneratedCodes
}) {
  const generate = useGenerateCodes()
  const [key] = useState(newIdempotencyKey)
  const [count, setCount] = useState<number | null>(10)
  const [errors, setErrors] = useState<FormErrors>()
  const [result, setResult] = useState<GeneratedCodes | null>(demoResult ?? null)
  const [copied, setCopied] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  async function copyAll(codes: GeneratedCodes['codes']) {
    try {
      await navigator.clipboard.writeText(codes.map((c) => c.code).join('\n'))
      setCopied(true)
      toast.success(`已复制 ${codes.length} 个兑换码`)
    } catch {
      toast.error('复制失败，手动选中复制吧')
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body">
          生成了 {result.codes.length} 个，每个 {formatYuan(result.valueMicros)}。
        </p>
        <ol className="bg-surface-sunken grid max-h-80 grid-cols-1 gap-1 overflow-y-auto rounded-xl p-3 sm:grid-cols-2">
          {result.codes.map((c) => (
            <li
              key={c.id}
              className="text-caption font-mono font-semibold tracking-wide select-all"
            >
              {c.code}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button icon={copied ? 'check' : 'copy'} onClick={() => void copyAll(result.codes)}>
            {copied ? '已复制' : '全部复制'}
          </Button>
          <Button variant="ghost" onClick={() => (copied ? onClose() : setConfirmClose(true))}>
            完成
          </Button>
        </div>
        <ConfirmDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          title="还没复制兑换码"
          description="关掉后明文就看不到了，只能作废重新生成。"
          tone="danger"
          confirmLabel="不要了，关闭"
          cancelLabel="回去复制"
          onConfirm={onClose}
        />
      </div>
    )
  }

  return (
    <Form
      errors={errors}
      onFormSubmit={async () => {
        const r = GenerateCodesSchema.safeParse({ count })
        if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
        try {
          setResult(await generate.mutateAsync({ count: r.data.count, idempotencyKey: key }))
        } catch (error) {
          if (isApiError(error) && error.code === 'IDEMPOTENCY_KEY_REUSED') {
            toast.info('这一批已经生成过了，去列表里核对一下')
            return onClose()
          }
          if (isApiError(error) && error.fields) setErrors(error.fields)
          toast.error(messageOf(error))
        }
      }}
    >
      <Field label="数量" htmlFor="code-count" name="count" hint="一次 1–100 个，面值固定 10 元">
        <NumberField
          id="code-count"
          value={count}
          onValueChange={(v) => {
            setCount(v)
            setErrors((prev) => (prev?.count ? { ...prev, count: undefined } : prev))
          }}
          min={1}
          max={100}
          step={1}
          largeStep={10}
          unit="个"
        />
      </Field>
      <p className="text-caption text-muted flex items-start gap-2">
        <Icon name="alert" size={18} className="text-warning-ink shrink-0" />
        库里只存哈希，明文只显示这一次。
      </p>
      <Button type="submit" loading={generate.isPending}>
        生成
      </Button>
    </Form>
  )
}
