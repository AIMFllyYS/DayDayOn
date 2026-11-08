'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { cn } from '@/lib/cn'
import { detectCalc, type ExerciseCalc } from '@/features/referee/rules/exercise'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import type { CreateCheckinInput, ExerciseItemInput } from '../../schemas'
import { InlineRow } from '../../flow/fields/inputs'
import { FavoritesSheet, TagRow, useFavorites } from '../../flow/fields/tags'
import type { FillSectionSpec } from '../../flow/types'
import type { ModuleFormApi, ModuleFormProps } from '../types'

/*
 * 动一动的填写页（Playbook exercise-flow）：运动类型自填，一次可以加多项；
 * 每项按名称自动识别「怎么计量」（时间 + 距离 / 时间 + 组数），识别错了可以手动切换。
 * 强度只是备注，不参与判定；「高级选项」（消耗、心率、感受）收在每张卡片里。
 */

const CALC_LABEL: Record<ExerciseCalc, string> = { distance: '时间 + 距离', count: '时间 + 组数' }
const DEFAULT_FAVS = ['慢跑', '快走', '骑行', '游泳', '深蹲', '平板支撑', '跳绳']
const MAX_ITEMS = 10

interface Item {
  id: string
  name: string
  calc: ExerciseCalc
  calcManual: boolean
  minutes: number | null
  km: number | null
  sets: number | null
  effort: string
  kcal: number | null
  heartRate: number | null
  feel: string
}

let seq = 0
function blank(): Item {
  seq += 1
  return {
    id: `ex-${seq}`,
    name: '',
    calc: 'distance',
    calcManual: false,
    minutes: null,
    km: null,
    sets: null,
    effort: '',
    kcal: null,
    heartRate: null,
    feel: '',
  }
}

function summaryOf(it: Item): string {
  if (!it.name.trim()) return '写一下做了什么运动'
  const parts = [it.name.trim(), it.minutes ? `${it.minutes} 分钟` : null]
  if (it.calc === 'distance' && it.km) parts.push(`${it.km} 公里`)
  if (it.calc === 'count' && it.sets) parts.push(`${it.sets} 组`)
  return parts.filter(Boolean).join(' · ')
}

function itemsFromSaved(
  savedLatest: NonNullable<ModuleFormProps['todayCheckins']>[number] | undefined,
): Item[] {
  if (savedLatest?.payload.module === 'exercise') {
    const p = savedLatest.payload
    if (p.items && p.items.length > 0) {
      return p.items.map((it) => ({
        id: `ex-${++seq}`,
        name: it.name,
        calc: it.calc,
        calcManual: true,
        minutes: it.minutes,
        km: it.km,
        sets: it.sets,
        effort: it.effort,
        kcal: it.kcal,
        heartRate: it.heartRate,
        feel: it.feel,
      }))
    }
    return [
      {
        ...blank(),
        name: p.category,
        minutes: savedLatest.durationSeconds ? Math.round(savedLatest.durationSeconds / 60) : null,
      },
    ]
  }
  return [blank()]
}

export function useExerciseForm(props?: ModuleFormProps): ModuleFormApi {
  const savedLatest = props?.todayCheckins?.find((c) => c.payload.module === 'exercise')
  const [items, setItems] = useState<Item[]>(() => itemsFromSaved(savedLatest))
  const [note, setNote] = useState(savedLatest?.note ?? '')
  const [sheet, setSheet] = useState(false)
  const [autoOpen, setAutoOpen] = useState<string | null>(null)
  const { favs, setFavs, resetFavs } = useFavorites('exercise', DEFAULT_FAVS)

  const syncKey = `${savedLatest?.id ?? 'none'}`
  const [seenSyncKey, setSeenSyncKey] = useState<string>(syncKey)
  if (syncKey !== seenSyncKey) {
    setSeenSyncKey(syncKey)
    setItems(itemsFromSaved(savedLatest))
    setNote(savedLatest?.note ?? '')
  }

  const patch = (id: string, p: Partial<Item>) =>
    setItems((list) =>
      list.map((it) => {
        if (it.id !== id) return it
        const next = { ...it, ...p }
        if (p.name !== undefined && !next.calcManual) next.calc = detectCalc(p.name) ?? 'distance'
        return next
      }),
    )

  const ready = items.filter((i) => i.name.trim() && (i.minutes ?? 0) > 0)

  const sections: FillSectionSpec[] = [
    ...items.map((it, idx) => ({
      id: it.id,
      label: items.length > 1 ? `运动内容 ${idx + 1}` : '运动内容',
      icon: 'exercise' as const,
      filled: Boolean(it.name.trim() && it.minutes),
      summary: summaryOf(it),
      onLongPress: () => setSheet(true),
      content: (
        <ItemEditor
          item={it}
          favs={favs}
          onPatch={(p) => patch(it.id, p)}
          onRemove={
            items.length > 1 ? () => setItems((l) => l.filter((x) => x.id !== it.id)) : undefined
          }
        />
      ),
    })),
    {
      id: 'note',
      label: '备注',
      icon: 'pen',
      filled: note.length > 0,
      summary: note || '可选',
      content: (
        <Input
          aria-label="备注"
          value={note}
          maxLength={200}
          placeholder="例如：和朋友一起、雨天在室内"
          onChange={(e) => setNote(e.target.value)}
        />
      ),
    },
  ]

  return {
    note,
    sections,
    autoOpen,
    afterSections:
      items.length < MAX_ITEMS ? (
        <Button
          variant="ghost"
          icon="plus"
          className="border-border w-full border border-dashed"
          onClick={() => {
            const it = blank()
            setItems((l) => [...l, it])
            setAutoOpen(it.id)
          }}
        >
          添加一项运动
        </Button>
      ) : null,
    overlay: sheet ? (
      <FavoritesSheet
        title="我常做的运动"
        hint="这些会作为快捷标签出现在运动类型上方。"
        placeholder="添加，如：羽毛球"
        favs={favs}
        tone="exercise"
        onChange={setFavs}
        onReset={resetFavs}
        onClose={() => setSheet(false)}
      />
    ) : null,
    canSubmit: ready.length > 0,
    aiSummary: ready.map(summaryOf).join('；') || '运动',
    toInput: () => exerciseInput(items, note),
    applySmart: (draft: SmartRecognitionDraft) => {
      const d = draft.exercise
      if (!d) return null
      const it = blank()
      it.name = d.category
      it.calc = d.sets != null && d.sets > 0 ? 'count' : (detectCalc(d.category) ?? 'distance')
      it.calcManual = Boolean((d.sets != null && d.sets > 0) || (d.km != null && d.km > 0))
      it.minutes = d.durationMinutes
      it.km = d.km ?? null
      it.sets = d.sets ?? null
      it.kcal = d.estimatedKcal
      it.effort = d.intensity === 'hard' ? '高强度' : d.intensity === 'easy' ? '轻松' : '中等'

      const existingReady = items.filter((i) => i.name.trim() && (i.minutes ?? 0) > 0)
      const merged =
        existingReady.length > 0 && existingReady.length < MAX_ITEMS
          ? [
              ...existingReady.filter(
                (x) => !(x.name.trim() === it.name.trim() && x.minutes === it.minutes),
              ),
              it,
            ].slice(0, MAX_ITEMS)
          : [it]

      setItems(merged)
      const nextNote = savedLatest ? note : (d.note ?? note)
      setNote(nextNote)
      return exerciseInput(merged, nextNote)
    },
  }
}

function exerciseInput(items: readonly Item[], note: string): CreateCheckinInput | null {
  const ready = items.filter((i) => i.name.trim() && (i.minutes ?? 0) > 0)
  if (ready.length === 0) return null
  const list: ExerciseItemInput[] = ready.map((i) => ({
    name: i.name.trim().slice(0, 20),
    calc: i.calc,
    minutes: Math.min(600, i.minutes ?? 1),
    km: i.calc === 'distance' ? i.km : null,
    sets: i.calc === 'count' ? i.sets : null,
    effort: i.effort.trim().slice(0, 40),
    kcal: i.kcal,
    heartRate: i.heartRate,
    feel: i.feel.trim().slice(0, 40),
  }))
  const minutes = list.reduce((s, i) => s + i.minutes, 0)
  return {
    module: 'exercise',
    category: list[0]!.name.slice(0, 10),
    intensity: 'moderate',
    durationSeconds: Math.max(60, Math.min(36_000, Math.round(minutes * 60))),
    items: list,
    note: note.trim() || null,
  }
}

function ItemEditor({
  item,
  favs,
  onPatch,
  onRemove,
}: {
  item: Item
  favs: readonly string[]
  onPatch: (p: Partial<Item>) => void
  onRemove?: () => void
}) {
  const [adv, setAdv] = useState(false)
  return (
    <>
      <TagRow
        tags={favs}
        selected={[item.name.trim()]}
        onToggle={(t) => onPatch({ name: item.name.trim() === t ? '' : t })}
        tone="exercise"
        label="常做的运动"
      />
      <Input
        aria-label="运动类型"
        value={item.name}
        maxLength={20}
        placeholder="例如：户外慢跑、深蹲"
        onChange={(e) => onPatch({ name: e.target.value })}
      />
      <div className="flex items-center gap-1.5">
        <span className="text-tiny text-muted shrink-0 font-semibold">计量方式</span>
        {(['distance', 'count'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={item.calc === c}
            onClick={() => onPatch({ calc: c, calcManual: true })}
            className={cn(
              'text-tiny min-h-7 rounded-full border px-2.5 font-semibold transition-colors',
              item.calc === c
                ? 'border-exercise bg-exercise-soft text-exercise-ink'
                : 'border-border text-muted hover:text-foreground',
            )}
          >
            {CALC_LABEL[c]}
          </button>
        ))}
      </div>
      <InlineRow label="时长">
        <NumberField
          size="sm"
          ariaLabel="时长"
          unit="分钟"
          min={1}
          max={600}
          value={item.minutes}
          onValueChange={(minutes) => onPatch({ minutes })}
        />
      </InlineRow>
      {item.calc === 'distance' ? (
        <InlineRow label="距离">
          <NumberField
            size="sm"
            ariaLabel="距离"
            unit="公里"
            min={0}
            max={300}
            step={0.1}
            value={item.km}
            onValueChange={(km) => onPatch({ km })}
          />
        </InlineRow>
      ) : (
        <InlineRow label="组数">
          <NumberField
            size="sm"
            ariaLabel="组数"
            unit="组"
            min={0}
            max={200}
            value={item.sets}
            onValueChange={(sets) => onPatch({ sets })}
          />
        </InlineRow>
      )}
      <Input
        aria-label="强度"
        value={item.effort}
        maxLength={40}
        placeholder="强度备注，例如：后半程有点喘"
        onChange={(e) => onPatch({ effort: e.target.value })}
      />
      <button
        type="button"
        aria-expanded={adv}
        onClick={() => setAdv((v) => !v)}
        className="text-tiny text-primary-ink inline-flex min-h-8 items-center gap-1 self-start font-semibold"
      >
        高级选项（不写没有影响）
        <Icon
          name="chevron-down"
          size={13}
          className={cn('transition-transform', adv && 'rotate-180')}
        />
      </button>
      {adv && (
        <div className="bg-surface-sunken flex flex-col gap-2 rounded-lg p-2.5">
          <InlineRow label="消耗">
            <NumberField
              size="sm"
              ariaLabel="消耗"
              unit="kcal"
              min={0}
              max={5000}
              value={item.kcal}
              onValueChange={(kcal) => onPatch({ kcal })}
            />
          </InlineRow>
          <InlineRow label="心率">
            <NumberField
              size="sm"
              ariaLabel="平均心率"
              unit="次/分"
              min={30}
              max={240}
              value={item.heartRate}
              onValueChange={(heartRate) => onPatch({ heartRate })}
            />
          </InlineRow>
          <Input
            aria-label="感受"
            value={item.feel}
            maxLength={40}
            placeholder="感受，例如：状态不错"
            onChange={(e) => onPatch({ feel: e.target.value })}
          />
        </div>
      )}
      {onRemove && (
        <Button variant="ghost" size="sm" icon="trash" className="self-end" onClick={onRemove}>
          删除这一项
        </Button>
      )}
    </>
  )
}
