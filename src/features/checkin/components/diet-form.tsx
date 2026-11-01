'use client'

import dynamic from 'next/dynamic'
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
 * 饮食打卡（PRD 2.4、2.6）：方式（拍照识别 / 手动填写）+ 餐次 + 条目（1–20 条，热量可空）。
 * 拍照识别整块交给 D6 的 DietRecognizer（确认后它自己创建打卡，回调 onConfirmed）。
 */

const DietRecognizer = dynamic(() =>
  import('@/features/diet/components/diet-recognizer').then((m) => m.DietRecognizer),
)

const methodOptions = [
  { value: 'photo', label: '拍照识别' },
  { value: 'manual', label: '手动填写' },
] as const

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
  /** AI 识别确认后（DietRecognizer 已创建打卡） */
  onConfirmed: (checkin: Checkin) => void
}

export function DietForm({
  goal,
  isMakeup,
  submitting,
  errors,
  onSubmit,
  initialMethod = 'manual',
  onConfirmed,
}: DietFormProps) {
  const [method, setMethod] = useState<DietMethod>(initialMethod)
  const [meal, setMeal] = useState<MealType>('lunch')
  const [items, setItems] = useState<ItemDraft[]>(() => [blankItem()])
  const [note, setNote] = useState('')

  const update = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={methodOptions}
        value={method}
        onValueChange={setMethod}
        label="记录方式"
      />
      <SegmentedControl
        options={mealOptions}
        value={meal}
        onValueChange={setMeal}
        label="餐次"
        size="sm"
      />

      {method === 'photo' && !isMakeup ? (
        <DietRecognizer
          goalId={goal.id}
          mealType={meal}
          onConfirmed={onConfirmed}
          onManual={() => setMethod('manual')}
        />
      ) : (
        <Form
          errors={errors}
          onFormSubmit={() =>
            onSubmit({
              module: 'diet',
              isMakeup,
              source: 'manual',
              method: 'manual',
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
          {method === 'photo' && isMakeup && (
            <p className="text-caption text-muted">补昨天的饮食只能手动填写</p>
          )}
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
      )}
    </div>
  )
}
