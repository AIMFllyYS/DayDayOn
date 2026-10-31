/** 微元 → 元，保留两位小数。只用于展示，计算一律用整数微元 */
export function formatYuan(micro: number): string {
  return `¥${(micro / 1_000_000).toFixed(2)}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} 毫秒`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} 秒`
}
