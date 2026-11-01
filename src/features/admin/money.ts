/*
 * 后台界面的金额换算（api-conventions.md 第 5 节：接口与数据库一律整数微元，界面层才换算成元）。
 * 纯函数，前后端都不依赖；有单测（money.test.ts）。
 */

export const MICROS_PER_YUAN = 1_000_000

/** 元 → 微元：先按分（两位小数）取整，避免 0.1 × 1e6 这类浮点误差。非有限数返回 null */
export function yuanToMicros(yuan: number): number | null {
  if (!Number.isFinite(yuan)) return null
  return Math.round(yuan * 100) * (MICROS_PER_YUAN / 100)
}

/** 微元 → 元（数值，给 NumberField 回填） */
export function microsToYuan(micros: number): number {
  return micros / MICROS_PER_YUAN
}

/** 微元 → '¥12.34'；signed 时正数带 '+'（额度调整） */
export function formatYuan(micros: number, opts: { signed?: boolean } = {}): string {
  const abs = (Math.abs(micros) / MICROS_PER_YUAN).toFixed(2)
  const sign = micros < 0 ? '-' : opts.signed && micros > 0 ? '+' : ''
  return `${sign}¥${abs}`
}
