'use client'

import Link from 'next/link'
import { IconTile } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { moduleMeta } from '@/components/ui/tone'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { NICKNAME_MAX, type Gender } from '@/features/me/schemas'
import { birthYearOptions, GENDER_OPTIONS, timeZoneOptions } from '@/features/me/units'
import { MODULES, type Module } from '@/features/shared/schemas'
import { formatDuration } from '@/lib/time'
import { cn } from '@/lib/cn'

/*
 * 新人引导六步的内容（PRD 2.2、7.1）。状态在 onboarding-wizard.tsx，这里只负责展示和回调。
 */

export function NicknameStep(p: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field
      label="昵称"
      htmlFor="ob-nickname"
      hint="朋友在排行榜上看到的名字，可以重名"
      aside={`${[...p.value.trim()].length} / ${NICKNAME_MAX}`}
      error={p.error}
    >
      <Input
        id="ob-nickname"
        autoComplete="nickname"
        autoFocus
        value={p.value}
        aria-invalid={p.error ? true : undefined}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </Field>
  )
}

export interface BasicProfile {
  gender: Gender | null
  birthYear: number | null
  heightCm: number | null
  weightKg: number | null
  timeZone: string
}

export function ProfileStep(p: {
  value: BasicProfile
  onChange: (v: BasicProfile) => void
  errors: Record<string, string | undefined>
  thisYear: number
}) {
  const set = (patch: Partial<BasicProfile>) => p.onChange({ ...p.value, ...patch })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="性别" htmlFor="ob-gender" aside="可选">
        <Select
          id="ob-gender"
          options={GENDER_OPTIONS}
          value={p.value.gender}
          onValueChange={(v) => set({ gender: v })}
          placeholder="不填"
        />
      </Field>
      <Field label="出生年份" htmlFor="ob-birth" aside="可选" error={p.errors.birthYear}>
        <Select
          id="ob-birth"
          options={birthYearOptions(p.thisYear)}
          value={p.value.birthYear === null ? null : String(p.value.birthYear)}
          onValueChange={(v) => set({ birthYear: Number(v) })}
          placeholder="不填"
        />
      </Field>
      <Field label="身高" htmlFor="ob-height" aside="可选" error={p.errors.heightCm}>
        <NumberField
          id="ob-height"
          value={p.value.heightCm}
          onValueChange={(v) => set({ heightCm: v === null ? null : Math.round(v) })}
          min={80}
          max={250}
          unit="cm"
        />
      </Field>
      <Field
        label="当前体重"
        htmlFor="ob-weight"
        aside="可选"
        hint="只有你自己看得到"
        error={p.errors.weightGrams}
      >
        <NumberField
          id="ob-weight"
          value={p.value.weightKg}
          onValueChange={(v) => set({ weightKg: v })}
          min={20}
          max={300}
          step={0.1}
          unit="kg"
          format={{ maximumFractionDigits: 1 }}
        />
      </Field>
      <Field
        label="时区"
        htmlFor="ob-tz"
        hint="打卡日按这个时区算"
        error={p.errors.timeZone}
        className="sm:col-span-2"
      >
        <Select
          id="ob-tz"
          options={timeZoneOptions(p.value.timeZone)}
          value={p.value.timeZone}
          onValueChange={(v) => set({ timeZone: v })}
        />
      </Field>
    </div>
  )
}

function targetText(module: Module): string {
  const t = DEFAULT_GOALS[module].target
  return t.kind === 'duration' ? `每天 ${formatDuration(t.value)}` : `每天 ${t.value} 次`
}

export function ModulesStep(p: {
  value: Module[]
  onChange: (v: Module[]) => void
  error?: string
}) {
  const toggle = (m: Module) =>
    p.onChange(p.value.includes(m) ? p.value.filter((x) => x !== m) : [...p.value, m])
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid gap-2" aria-label="想打卡的板块">
        {MODULES.map((m) => {
          const on = p.value.includes(m)
          return (
            <li key={m}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(m)}
                className={cn(
                  'ease-spring flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-[transform,background-color,border-color] duration-(--dur-fast) active:scale-[0.98]',
                  on
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface hover:bg-background',
                )}
              >
                <IconTile icon={moduleMeta[m].icon} tone={m} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {moduleMeta[m].label} · {DEFAULT_GOALS[m].title}
                  </span>
                  <span className="text-tiny text-muted block">{targetText(m)}，之后可以改</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'flex size-6 items-center justify-center rounded-lg border-2',
                    on ? 'border-primary bg-primary text-on-primary' : 'border-border-strong',
                  )}
                >
                  {on && <Icon name="check" size={16} strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {p.error && (
        <p role="alert" className="text-tiny text-danger-ink">
          {p.error}
        </p>
      )}
    </div>
  )
}

export function LeaderboardStep(p: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-surface-sunken flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <IconTile icon="trophy" tone="diet" />
        <span className="min-w-0 flex-1 font-semibold">加入排行榜</span>
        <Switch checked={p.value} onCheckedChange={p.onChange} label="加入排行榜" />
      </div>
      <ul className="text-caption text-muted list-disc space-y-1 pl-5">
        <li>朋友能看到你的昵称、头像、打卡天数和连续天数</li>
        <li>体重、饮食、睡眠的具体数值永远不公开</li>
        <li>默认不加入，之后可以在「我的」里随时改</li>
      </ul>
    </div>
  )
}

export function ConsentStep(p: { value: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-sunken text-caption text-muted space-y-2 rounded-2xl p-4">
        <p>体重、饮食和睡眠属于健康相关的个人信息。我们只用它们给你算进度、画走势：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>不公开、不参与排行</li>
          <li>拍的照片识别完就丢，从不保存</li>
          <li>随时可以导出全部数据，或注销账号一并删除</li>
        </ul>
        <p>
          详情见
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary-ink mx-1 font-semibold underline"
          >
            隐私说明
          </Link>
        </p>
      </div>
      <Checkbox checked={p.value} onCheckedChange={p.onChange}>
        我同意 DayDayOn 按上面的方式处理我的健康数据
      </Checkbox>
      {p.error && (
        <p role="alert" className="text-tiny text-danger-ink">
          {p.error}
        </p>
      )}
    </div>
  )
}
