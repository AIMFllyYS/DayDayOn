'use client'

import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { mealLabel } from '../format'
import { NOTE_MAX, type Checkin, type DietMethod, type MealType } from '../schemas'
import { NOTE_PLACEHOLDER, type ModuleFormProps } from './form-types'

/*
 * 饮食打卡表单（PRD 2.4、2.6）：餐次 + 条目（1–20 条，热量可空）+ 备注。
 * 当上层传入 smartContext（来自 SmartScannerLens 智能拍照 / 智能上传）时，自动预填餐次与食物条目，
 * 提交时附带 source: 'ai'、method: 'photo'、aiRunId 与 parsedText。
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

export interface DietFormProps extends ModuleFormProps {
  initialMethod?: DietMethod
  onConfirmed?: (checkin: Checkin) => void
}

export function DietForm({ isMakeup, submitting, errors, smartContext, onSubmit }: DietFormProps) {
  const aiDiet = smartContext?.draft.diet
  const [meal, setMeal] = useState<MealType>(aiDiet?.mealType ?? 'lunch')
  const [items, setItems] = useState<ItemDraft[]>(() =>
    aiDiet && aiDiet.items.length > 0
      ? aiDiet.items.map((it) => ({
          key: ++seq,
          name: it.name,
          portion: it.portion ?? '',
          kcal: it.kcal === null ? '' : String(it.kcal),
        }))
      : [blankItem()],
  )
  const [note, setNote] = useState(aiDiet?.note ?? '')

  const update = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const isAi = Boolean(smartContext && !isMakeup)

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={mealOptions}
        value={meal}
        onValueChange={setMeal}
        label="餐次"
        size="sm"
      />

      <Form
        errors={errors}
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
              name: i.name,
              portion: i.portion,
              kcal: i.kcal.trim() === '' ? null : Number(i.kcal),
            })),
            note: note.trim() === '' ? null : note.trim(),
          })
        }
      >
        <Card variant="sunken" className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={item.key} className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <Field
                  label={`第 ${idx + 1} 样`}
                  htmlFor={`food-${item.key}`}
                  name={`items.${idx}.name`}
                  className="flex-1"
                >
                  <Input
                    id={`food-${item.key}`}
                    value={item.name}
                    maxLength={30}
                    placeholder="例如：番茄炒蛋"
                    onChange={(e) => update(item.key, { name: e.target.value })}
                  />
                </Field>
                {items.length > 1 && (
                  <IconButton
                    icon="trash"
                    label={`删除第 ${idx + 1} 样`}
                    onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="份量" htmlFor={`portion-${item.key}`} aside="可选">
                  <Input
                    id={`portion-${item.key}`}
                    value={item.portion}
                    maxLength={30}
                    placeholder="一碗"
                    onChange={(e) => update(item.key, { portion: e.target.value })}
                  />
                </Field>
                <Field
                  label="热量"
                  htmlFor={`kcal-${item.key}`}
                  name={`items.${idx}.kcal`}
                  aside="可选"
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
                  />
                </Field>
              </div>
            </div>
          ))}
          {items.length < 20 && (
            <Button
              variant="ghost"
              icon="plus"
              size="sm"
              className="self-start"
              onClick={() => setItems((l) => [...l, blankItem()])}
            >
              再加一样
            </Button>
          )}
        </Card>
        <Field label="备注" htmlFor="checkin-note" name="note" aside="可选">
          <Textarea
            id="checkin-note"
            value={note}
            maxLength={NOTE_MAX}
            placeholder={NOTE_PLACEHOLDER}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Button type="submit" icon="check" className="w-full" loading={submitting}>
          确认记录
        </Button>
      </Form>
    </div>
  )
}
