'use client'

import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { NumberField } from '@/components/ui/number-field'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { isApiError, useQuery } from '@/lib/api'
import { adminSettingsQuery, useUpdateSettings } from '@/lib/api/queries/admin'
import { AppSettingsPatchSchema, type AppSettings } from '@/server/settings-schema'
import { diffPatch, SETTING_GROUPS, type SettingsDraft, toDraft } from '../settings-form'
import { AdminHeader, messageOf } from './shared'

/*
 * 全站设置（PRD 2.12、7.3）：AppSettings 里除 aiPaused 外的全部项。金额在界面上用元，提交时换成微元。
 * 只提交改动的项（PUT /admin/settings 是补丁），校验用同一份 AppSettingsPatchSchema。
 */

export function SettingsPanel() {
  const query = useQuery(adminSettingsQuery())
  return (
    <div className="flex flex-col gap-4">
      <AdminHeader title="全站设置" description="改完立即生效（服务端缓存最多 10 秒）" />
      {query.isPending ? (
        <div role="status" aria-label="加载中" className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState
            message={messageOf(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </Card>
      ) : (
        <SettingsForm key={JSON.stringify(query.data)} settings={query.data} />
      )}
    </div>
  )
}

interface SettingsFormProps {
  settings: AppSettings
  demo?: boolean
}

export function SettingsForm({ settings, demo = false }: SettingsFormProps) {
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(settings))
  const [errors, setErrors] = useState<FormErrors>()
  const patch = diffPatch(settings, draft)
  const dirty = Object.keys(patch).length > 0

  return (
    <Form
      errors={errors}
      onFormSubmit={async () => {
        const r = AppSettingsPatchSchema.safeParse(patch)
        if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
        if (demo) return void toast.info('演示：已保存')
        try {
          await update.mutateAsync(r.data)
          toast.success('已保存')
        } catch (error) {
          if (isApiError(error) && error.fields) setErrors(error.fields)
          toast.error(messageOf(error))
        }
      }}
    >
      {SETTING_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} />
          <div className="grid gap-4 md:grid-cols-2">
            {group.fields.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                htmlFor={`setting-${f.key}`}
                name={f.key}
                hint={f.hint || undefined}
              >
                <NumberField
                  id={`setting-${f.key}`}
                  value={draft[f.key]}
                  onValueChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                  min={f.money ? 0 : 1}
                  step={1}
                  unit={f.unit}
                  format={f.money ? { maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }}
                />
              </Field>
            ))}
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={update.isPending} disabled={!dirty}>
          保存
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(toDraft(settings))
              setErrors(undefined)
            }}
          >
            撤销修改
          </Button>
        )}
        <span className="text-caption text-muted">
          {dirty ? `改了 ${Object.keys(patch).length} 项` : '没有改动'}
        </span>
      </div>
    </Form>
  )
}
