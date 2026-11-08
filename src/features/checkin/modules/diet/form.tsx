'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { Input } from '@/components/ui/field'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { CreateCheckinInput, MealType } from '../../schemas'
import type { SmartRecognitionDraft } from '../../smart-schemas'
import { FavoritesSheet, splitNames, TagRow, useFavorites } from '../../flow/fields/tags'
import { TimePicker } from '../../flow/time-picker'
import type { FillSectionSpec } from '../../flow/types'
import type { ModuleFormApi, ModuleFormProps } from '../types'

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

const DEFAULT_FAVS = [
  '空腹',
  '糙米饭',
  '清蒸鱼',
  '蒜蓉西兰花',
  '番茄炒蛋',
  '鸡胸肉',
  '燕麦粥',
  '水煮蛋',
]

export type MainMealType = 'breakfast' | 'lunch' | 'dinner'
export const MAIN_MEALS: readonly MainMealType[] = ['breakfast', 'lunch', 'dinner']

/** 按当前本地时刻就近匹配早/中/晚三餐（加餐仅限用户手动点击选择，不参与自动默认） */
export function guessMainMeal(hour: number): MainMealType {
  if (hour < 10) return 'breakfast'
  if (hour < 16) return 'lunch'
  return 'dinner'
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

export function useDietForm(props?: ModuleFormProps): ModuleFormApi {
  const enteredRef = useRef<string | null>(null)
  const clock = useSyncExternalStore(
    () => () => undefined,
    () => (enteredRef.current ??= nowHHMM()),
    () => '',
  )
  const [meal, setMeal] = useState<MealType | null>(props?.initialMeal ?? null)
  const [manualMeal, setManualMeal] = useState(Boolean(props?.initialMeal))
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [snackTime, setSnackTime] = useState('')
  const [smartItems, setSmartItems] = useState<SmartItem[] | null>(null)
  const [sheet, setSheet] = useState(false)
  const { favs, setFavs, resetFavs } = useFavorites('diet', DEFAULT_FAVS)

  const timeMeal: MainMealType = clock ? guessMainMeal(Number(clock.slice(0, 2))) : 'lunch'
  const mealType: MealType = meal ?? timeMeal

  const checkedMeals = new Set<MealType>()
  for (const c of props?.todayCheckins ?? []) {
    if (c.payload.module === 'diet') {
      checkedMeals.add(c.payload.mealType)
    }
  }

  // 凌晨 0 点前重进页面或切换餐次时，直接读取数据库已存的该餐次记录；切换到未打卡餐次时清空表单
  const savedMeal = props?.todayCheckins?.find(
    (c) => c.payload.module === 'diet' && c.payload.mealType === mealType,
  )
  const syncKey = `${mealType}:${savedMeal?.id ?? 'none'}`
  const [seenSyncKey, setSeenSyncKey] = useState<string | null>(null)
  if (syncKey !== seenSyncKey) {
    setSeenSyncKey(syncKey)
    if (savedMeal && savedMeal.payload.module === 'diet') {
      const savedItems = savedMeal.payload.items.map((i) => ({
        name: i.name,
        portion: i.portion ?? '',
        kcal: i.kcal,
      }))
      setSmartItems(savedMeal.payload.method === 'photo' ? savedItems : null)
      setText(savedItems.map((i) => i.name).join('、'))
      setNote(savedMeal.note ?? '')
      if (savedMeal.payload.snackTime) setSnackTime(savedMeal.payload.snackTime)
      setManualMeal(false)
    } else {
      setSmartItems(null)
      setText('')
      setNote('')
    }
  }

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
    activeKey: mealType,
    note,
    selector: (
      <SegmentedControl
        size="sm"
        label="餐次"
        value={mealType}
        onValueChange={(m) => {
          setMeal(m)
          setManualMeal(true)
        }}
        options={[
          { value: 'breakfast', label: checkedMeals.has('breakfast') ? '早餐 ✓' : '早餐' },
          { value: 'lunch', label: checkedMeals.has('lunch') ? '午餐 ✓' : '午餐' },
          { value: 'dinner', label: checkedMeals.has('dinner') ? '晚餐 ✓' : '晚餐' },
          { value: 'snack', label: checkedMeals.has('snack') ? '加餐 ✓' : '加餐' },
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
      // 若用户已手动点击餐次（含加餐），严格锁定用户选定的餐次；
      // 否则按 AI 识别的正餐（若该正餐今日已打卡，则自动顺延至下一个未打卡正餐，绝不自动落入加餐）
      const aiMainMeal: MainMealType = d.mealType === 'snack' ? timeMeal : d.mealType
      const targetMeal: MealType = manualMeal
        ? mealType
        : checkedMeals.has(aiMainMeal)
          ? (MAIN_MEALS.find((m) => !checkedMeals.has(m)) ?? aiMainMeal)
          : aiMainMeal

      const targetSaved = props?.todayCheckins?.find(
        (c) => c.payload.module === 'diet' && c.payload.mealType === targetMeal,
      )
      setSeenSyncKey(`${targetMeal}:${targetSaved?.id ?? 'none'}`)
      setMeal(targetMeal)
      const list = d.items.map((i) => ({ name: i.name, portion: i.portion ?? '', kcal: i.kcal }))
      setSmartItems(list)
      setText(list.map((i) => i.name).join('、'))
      // 切换餐次或当前餐次为已打卡回显态时，不残留上一餐数据库的旧备注，也不把 AI 总结塞入备注框
      const cleanNote = savedMeal ? (targetSaved?.note ?? '') : note
      setNote(cleanNote)
      return dietInput({
        mealType: targetMeal,
        items: list,
        snackAt,
        note: cleanNote,
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
