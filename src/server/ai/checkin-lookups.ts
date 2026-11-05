import 'server-only'
import { metOf } from '@/features/referee/rules/exercise'
import { findFood } from './referee/food-table'

/*
 * 打卡裁判和对话 Agent 共用的内置查询（checkin-modules.md 第 4、8 节）：同一张营养表、同一张 MET 表，
 * 两边算出来的事实一致。
 */

export function lookupFoods(names: readonly string[]) {
  const found = []
  const missing: string[] = []
  for (const name of names) {
    const row = findFood(name)
    if (!row) {
      missing.push(name)
      continue
    }
    const { names: aliases, ...per100g } = row
    found.push({ name, matched: aliases[0], per100g })
  }
  return { found, missing }
}

export function lookupMets(activities: readonly { name: string; calc: 'distance' | 'count' }[]) {
  return { items: activities.map((a) => ({ name: a.name, ...metOf(a.name, a.calc) })) }
}
