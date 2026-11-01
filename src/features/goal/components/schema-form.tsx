'use client'

import type { FieldDef, FieldValues } from '@/features/goal/schemas'
import { PendingCard } from '@/features/shared/components/pending-card'

export interface SchemaFormProps {
  /** 当前版本的字段定义 */
  fields: readonly FieldDef[]
  /** 受控值：key → 值（number / string / string[] / boolean） */
  value: FieldValues
  onChange: (next: FieldValues) => void
  /** z.flattenError(buildSchema(fields).safeParse(value).error).fieldErrors，或接口 400 的 fields */
  errors?: Record<string, string[] | undefined>
}

/**
 * 按字段定义渲染动态表单（PRD 2.4 自定义板块）。校验由调用方用 buildSchema(fields) 做。
 * props F1 定；实现 D2；D3 的自定义打卡表单使用。
 */
export function SchemaForm({ fields, value, onChange, errors }: SchemaFormProps) {
  void fields
  void value
  void onChange
  void errors
  return <PendingCard title="自定义字段表单" owner="D2" />
}
