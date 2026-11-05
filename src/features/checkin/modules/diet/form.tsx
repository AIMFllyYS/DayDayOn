'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { Input } from '@/components/ui/field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { CreateCheckinInput, MealType } from '../../schemas'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import { FavoritesSheet, splitNames, TagRow, useFavorites } from '../../flow/fields/tags'
import { TimePicker } from '../../flow/time-picker'
import type { FillSectionSpec } from '../../flow/types'
import type { ModuleFormApi } from '../types'

/*
 * 好好吃饭的填写页（Playbook diet-flow）：餐次 → 吃了什么（输入框 + 常吃标签）→ 备注；
 * 加餐时多一个置顶的「加餐时间」，默认进入页面时的当前时间。
 */

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

const DEFAULT_FAVS = ['糙米饭', '清蒸鱼', '蒜蓉西兰花', '番茄炒蛋', '鸡胸肉', '燕麦粥', '水煮蛋']

/** 按当前时刻猜餐次 */
function guessMeal(hour: number): MealType {
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 10 && hour < 15) return 'lunch'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'snack'
}

function nowHHMM(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

interface SmartItem {
  name: string
  portion: string
  kcal: number | null
}

export function useDietForm(): ModuleFormApi {
  const enteredRef = useRef<string | null>(null)
  const clock = useSyncExternalStore(
    () => () => undefined,
    () => (enteredRef.current ??= nowHHMM()),
    () => '',
  )
  const [meal, setMeal] = useState<MealType | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [snackTime, setSnackTime] = useState('')
  const [smartItems, setSmartItems] = useState<SmartItem[] | null>(null)
  const [sheet, setSheet] = useState(false)
  const { favs, setFavs, resetFavs } = useFavorites('diet', DEFAULT_FAVS)

  const mealType: MealType = meal ?? (clock ? guessMeal(Number(clock.slice(0, 2))) : 'lunch')
  const snackAt = snackTime || clock || '12:00'
  const names = splitNames(text)
  // 识别出来的条目带份量和热量；用户改了文字就以文字为准
  const items =
    smartItems && smartItems.map((i) => i.name).join('、') === names.join('、')
      ? smartItems
      : names.map((name) => ({ name: name.slice(0, 30), portion: '', kcal: null }))

  function toggleTag(name: string) {
    const next = names.includes(name) ? names.filter((x) => x !== name) : [...names, name]
    setText(next.join('、'))
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'dishes',
      label: '吃了什么',
      icon: 'diet',
      filled: names.length > 0,
      summary:
        names.length > 0 ? `${names.length} 道 · ${names.join('、')}` : '输入或点选你吃的东西',
      onLongPress: () => setSheet(true),
      content: (
        <>
          <TagRow
            tags={favs}
            selected={names}
            onToggle={toggleTag}
            tone="diet"
            label="常吃的食物"
          />
          <Input
            aria-label="吃了什么"
            value={text}
            maxLength={300}
            placeholder="例如：糙米饭、清蒸鲈鱼、半份西兰花"
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-tiny text-subtle">用顿号隔开；长按或右键标题可以改常吃的食物</p>
        </>
      ),
    },
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
          placeholder="例如：外卖、少油"
          onChange={(e) => setNote(e.target.value)}
        />
      ),
    },
  ]

  return {
    selector: (
      <SegmentedControl
        size="sm"
        label="餐次"
        value={mealType}
        onValueChange={(m) => setMeal(m)}
        options={[
          { value: 'breakfast', label: '早餐' },
          { value: 'lunch', label: '午餐' },
          { value: 'dinner', label: '晚餐' },
          { value: 'snack', label: '加餐' },
        ]}
      />
    ),
    leadSection:
      mealType === 'snack'
        ? {
            id: 'snack-time',
            label: '加餐时间',
            icon: 'clock',
            filled: true,
            summary: snackAt,
            content: (
              <TimePicker label="加餐时间" tone="diet" value={snackAt} onChange={setSnackTime} />
            ),
          }
        : null,
    sections,
    overlay: sheet ? (
      <FavoritesSheet
        title="我常吃的食物"
        hint="这些会作为快捷标签出现在「吃了什么」上方。"
        placeholder="添加，如：燕麦粥"
        favs={favs}
        tone="diet"
        onChange={setFavs}
        onReset={resetFavs}
        onClose={() => setSheet(false)}
      />
    ) : null,
    canSubmit: names.length > 0 && names.length <= 20,
    aiSummary: `${MEAL_LABEL[mealType]}${mealType === 'snack' ? ` ${snackAt}` : ''} · ${names.length} 道菜`,
    toInput: () => dietInput({ mealType, items, snackAt, note, photo: smartItems !== null }),
    applySmart: (draft: SmartRecognitionDraft) => {
      const d = draft.diet
      if (!d) return null
      setMeal(d.mealType)
      const list = d.items.map((i) => ({ name: i.name, portion: i.portion ?? '', kcal: i.kcal }))
      setSmartItems(list)
      setText(list.map((i) => i.name).join('、'))
      if (d.note) setNote(d.note)
      return dietInput({
        mealType: d.mealType,
        items: list,
        snackAt,
        note: d.note ?? note,
        photo: true,
      })
    },
  }
}

function dietInput(s: {
  mealType: MealType
  items: SmartItem[]
  snackAt: string
  note: string
  photo: boolean
}): CreateCheckinInput | null {
  if (s.items.length === 0) return null
  return {
    module: 'diet',
    method: s.photo ? 'photo' : 'manual',
    mealType: s.mealType,
    items: s.items.slice(0, 20),
    ...(s.mealType === 'snack' ? { snackTime: s.snackAt } : {}),
    note: s.note.trim() || null,
  }
}
