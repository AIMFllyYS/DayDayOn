'use client'

import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { mealLabel } from '../format'
import { guessMainMeal } from '../modules/diet/form'
import { NOTE_MAX, type MealType } from '../schemas'
import { NOTE_PLACEHOLDER, type ModuleFormProps } from './form-types'
import { MagicFieldBlock } from './smart-magic-stream'

/*
 * 饮食打卡表单（PRD 2.4、2.6）：餐次 + 条目（1–20 条，热量可空）+ 备注。
 * 当上层传入 smartContext（来自 SmartScannerLens 智能拍照 / 智能上传）时，自动预填餐次与食物条目，
 * 并在 magicStreaming 期间按流式魔法动画逐项显现与递增数值。
 */

const mealOptions = (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((v) => ({
  value: v,
  label: mealLabel[v],
}))

interface ItemDraft {
  key: number
  name: string
  portion: string
  kcal: string
}

let seq = 0
const blankItem = (): ItemDraft => ({ key: ++seq, name: '', portion: '', kcal: '' })

function defaultMealOf(aiMeal: MealType | undefined): MealType {
  const timeMeal = guessMainMeal(new Date().getHours())
  if (!aiMeal || aiMeal === 'snack') return timeMeal
  return aiMeal
}

function itemsFromContext(smartContext: ModuleFormProps['smartContext']): ItemDraft[] {
  const aiDiet = smartContext?.draft.diet
  if (aiDiet && aiDiet.items.length > 0) {
    return aiDiet.items.map((it) => ({
      key: ++seq,
      name: it.name,
      portion: it.portion ?? '',
      kcal: it.kcal === null ? '' : String(Math.round(it.kcal)),
    }))
  }
  if (smartContext) {
    return [
      {
        key: ++seq,
        name: smartContext.draft.summary.slice(0, 24) || '识别餐食',
        portion: '1 份',
        kcal: '',
      },
    ]
  }
  return [blankItem()]
}

export function DietForm({
  isMakeup,
  submitting,
  errors,
  smartContext,
  streamedContext,
  magicStreaming,
  magicStage,
  onSubmit,
}: ModuleFormProps) {
  const aiDiet = smartContext?.draft.diet
  const streamDiet = streamedContext?.draft.diet
  const [meal, setMeal] = useState<MealType>(() => defaultMealOf(aiDiet?.mealType))
  const [items, setItems] = useState<ItemDraft[]>(() => itemsFromContext(smartContext))
  const [note, setNote] = useState(aiDiet?.note ?? '')

  const runKey = smartContext?.aiRunId ?? 'manual'
  const [seenRunKey, setSeenRunKey] = useState(runKey)
  if (runKey !== seenRunKey) {
    setSeenRunKey(runKey)
    setMeal(defaultMealOf(aiDiet?.mealType))
    setItems(itemsFromContext(smartContext))
    setNote(aiDiet?.note ?? '')
  }

  const update = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const isAi = Boolean(smartContext && !isMakeup)
  const shownNote = magicStreaming && streamDiet ? (streamDiet.note ?? '') : note

  const shownItems: ItemDraft[] =
    magicStreaming && streamDiet && streamDiet.items.length > 0
      ? streamDiet.items.map((it, idx) => ({
          key: items[idx]?.key ?? idx + 1,
          name: it.name,
          portion: it.portion ?? '',
          kcal: it.kcal === null ? '' : String(it.kcal),
        }))
      : items

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <SegmentedControl
        options={mealOptions}
        value={meal}
        onValueChange={setMeal}
        label="餐次"
        size="sm"
      />

      <Form
        errors={errors}
        className="min-w-0 gap-2.5"
        onFormSubmit={() =>
          onSubmit({
            module: 'diet',
            isMakeup,
            source: isAi ? 'ai' : 'manual',
            method: isAi ? 'photo' : 'manual',
            ...(isAi && smartContext
              ? {
                  aiRunId: smartContext.aiRunId,
                  parsedText: smartContext.draft.summary,
                }
              : {}),
            mealType: meal,
            items: items.map((i) => ({
              name: i.name.trim() || (isAi ? '识别餐食' : ''),
              portion: i.portion,
              kcal: i.kcal.trim() === '' ? null : Math.round(Number(i.kcal)),
            })),
            note: note.trim() === '' ? null : note.trim(),
          })
        }
      >
        <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
          <Card variant="sunken" className="flex min-w-0 flex-col gap-2.5 p-3 md:p-3.5">
            {shownItems.map((item, idx) => (
              <div key={item.key} className="animate-fade-up flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-end gap-2">
                  <Field
                    label={`第 ${idx + 1} 样`}
                    htmlFor={`food-${item.key}`}
                    name={`items.${idx}.name`}
                    className="min-w-0 flex-1 gap-1"
                  >
                    <Input
                      id={`food-${item.key}`}
                      value={item.name}
                      maxLength={30}
                      placeholder="例如：番茄炒蛋"
                      onChange={(e) => update(item.key, { name: e.target.value })}
                      className="text-caption h-10 px-3"
                    />
                  </Field>
                  {items.length > 1 && !magicStreaming && (
                    <IconButton
                      icon="trash"
                      size="sm"
                      label={`删除第 ${idx + 1} 样`}
                      onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                    />
                  )}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2">
                  <Field
                    label="份量"
                    htmlFor={`portion-${item.key}`}
                    aside="可选"
                    className="min-w-0 gap-1"
                  >
                    <Input
                      id={`portion-${item.key}`}
                      value={item.portion}
                      maxLength={30}
                      placeholder="一碗"
                      onChange={(e) => update(item.key, { portion: e.target.value })}
                      className="text-caption h-10 px-3"
                    />
                  </Field>
                  <Field
                    label="热量"
                    htmlFor={`kcal-${item.key}`}
                    name={`items.${idx}.kcal`}
                    aside="可选"
                    className="min-w-0 gap-1"
                  >
                    <Input
                      id={`kcal-${item.key}`}
                      value={item.kcal}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="千卡"
                      onChange={(e) =>
                        update(item.key, { kcal: e.target.value.replace(/\D/g, '').slice(0, 4) })
                      }
                      className="text-caption h-10 px-3"
                    />
                  </Field>
                </div>
              </div>
            ))}
            {items.length < 20 && !magicStreaming && (
              <Button
                variant="ghost"
                icon="plus"
                size="sm"
                className="text-caption h-8 self-start px-2.5"
                onClick={() => setItems((l) => [...l, blankItem()])}
              >
                再加一样
              </Button>
            )}
          </Card>
        </MagicFieldBlock>

        <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
          <Field
            label="备注"
            htmlFor="checkin-note"
            name="note"
            aside="可选"
            className="min-w-0 gap-1"
          >
            <Textarea
              id="checkin-note"
              rows={2}
              value={shownNote}
              maxLength={NOTE_MAX}
              placeholder={NOTE_PLACEHOLDER}
              onChange={(e) => setNote(e.target.value)}
              className="text-caption min-h-16 px-3 py-2"
            />
          </Field>
        </MagicFieldBlock>
        <Button type="submit" size="sm" icon="check" className="h-10 w-full" loading={submitting}>
          确认记录
        </Button>
      </Form>
    </div>
  )
}
