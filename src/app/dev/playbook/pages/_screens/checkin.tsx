'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'

/*
 * 打卡表单（/goals/[goalId]/checkin）：以饮食为例，手动填写和 AI 识别两种方式。
 * 提交后盖章 + 吉祥物欢呼，只在完成那一刻出现。
 */
const modes = [
  { value: 'ai', label: '拍照识别' },
  { value: 'manual', label: '手动填写' },
] as const

const meals = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' },
] as const

export function CheckinScreen() {
  const [mode, setMode] = useState<(typeof modes)[number]['value']>('ai')
  const [meal, setMeal] = useState<(typeof meals)[number]['value']>('lunch')
  const [rating, setRating] = useState<RatingValue | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="relative">
          <Mascot mood="cheer" size={120} />
          <Stamp
            caption="11.01"
            tone="diet"
            animate
            size={72}
            className="absolute -top-2 -right-12"
          />
        </div>
        <p className="text-heading font-bold">午餐记好啦</p>
        <p className="text-caption text-muted">今天的饮食完成 2 / 3 餐，晚饭也要好好吃</p>
        <Button variant="soft" onClick={() => setDone(false)}>
          再演示一次
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3">
      <div className="flex items-center gap-2.5">
        <IconTile icon="diet" tone="diet" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">好好吃饭</p>
          <p className="text-tiny text-muted">每天 3 餐 · 今天完成 1 / 3</p>
        </div>
        <Badge tone="diet">饮食</Badge>
      </div>

      <SegmentedControl options={modes} value={mode} onValueChange={setMode} label="记录方式" />
      <SegmentedControl
        options={meals}
        value={meal}
        onValueChange={setMeal}
        label="餐次"
        size="sm"
      />

      {mode === 'ai' ? (
        <AiDraftCard
          module="diet"
          title="午餐 · 12:30"
          confidence={0.78}
          estimate
          onConfirm={() => setDone(true)}
          fields={[
            { label: '番茄炒蛋', value: '240–280 kcal', hint: '按家常做法 200g' },
            { label: '米饭', value: '165–180 kcal', hint: '按一碗 150g' },
            { label: '合计', value: '405–460 kcal' },
          ]}
        />
      ) : (
        <Card className="grid gap-4">
          <Field label="吃了什么" htmlFor="pv-food">
            <Input id="pv-food" placeholder="例如：番茄炒蛋、米饭" />
          </Field>
          <Field label="大约多少热量" htmlFor="pv-kcal" aside="可选" hint="不知道可以不填">
            <Input id="pv-kcal" inputMode="numeric" placeholder="kcal" />
          </Field>
          <Field label="备注" htmlFor="pv-note">
            <Textarea id="pv-note" placeholder="今天吃得有点多，但很开心" />
          </Field>
        </Card>
      )}

      <Card>
        <p className="text-caption mb-2 font-semibold">这顿吃得开心吗？</p>
        <Rating value={rating} onValueChange={setRating} tone="diet" label="饮食满意度" />
      </Card>

      {mode === 'manual' && (
        <Button icon="check" className="w-full" onClick={() => setDone(true)}>
          确认记录
        </Button>
      )}
    </div>
  )
}
