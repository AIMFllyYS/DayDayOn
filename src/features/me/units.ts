/*
 * 界面单位换算（api-conventions.md 第 5 节：接口用克，界面用千克一位小数）。纯函数，带单测。
 */

/** 千克（可带小数）→ 整克；空值保持 null */
export function kgToGrams(kg: number | null): number | null {
  if (kg === null || !Number.isFinite(kg)) return null
  return Math.round(kg * 1000)
}

export const GENDER_OPTIONS: { value: 'female' | 'male' | 'other'; label: string }[] = [
  { value: 'female', label: '女' },
  { value: 'male', label: '男' },
  { value: 'other', label: '不想说' },
]

/** 时区下拉的选项：常用的几个在前，用户当前时区不在表里时补到最前面 */
export const COMMON_TIME_ZONES = [
  { value: 'Asia/Shanghai', label: '北京时间（中国大陆）' },
  { value: 'Asia/Hong_Kong', label: '香港' },
  { value: 'Asia/Taipei', label: '台北' },
  { value: 'Asia/Tokyo', label: '东京' },
  { value: 'Asia/Seoul', label: '首尔' },
  { value: 'Asia/Singapore', label: '新加坡' },
  { value: 'Europe/London', label: '伦敦' },
  { value: 'Europe/Paris', label: '巴黎' },
  { value: 'Europe/Berlin', label: '柏林' },
  { value: 'America/New_York', label: '纽约' },
  { value: 'America/Chicago', label: '芝加哥' },
  { value: 'America/Los_Angeles', label: '洛杉矶' },
  { value: 'Australia/Sydney', label: '悉尼' },
] as const

export function timeZoneOptions(current: string): { value: string; label: string }[] {
  const list: { value: string; label: string }[] = COMMON_TIME_ZONES.map((z) => ({ ...z }))
  if (current && !list.some((z) => z.value === current)) {
    list.unshift({ value: current, label: current })
  }
  return list
}

/** 日切换时间 0–6 点 */
export const DAY_START_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((h) => ({
  value: String(h),
  label: h === 0 ? '0 点（午夜）' : `凌晨 ${h} 点`,
}))

/** 出生年份下拉：今年往前 80 年 */
export function birthYearOptions(thisYear: number): { value: string; label: string }[] {
  return Array.from({ length: 80 }, (_, i) => {
    const y = thisYear - 10 - i
    return { value: String(y), label: `${y} 年` }
  })
}
