export type ClassValue = string | false | null | undefined

/**
 * 拼接条件 className。
 * 目前不做 Tailwind 冲突合并：组件对外的 className 只用来补充布局（间距、宽度），
 * 不要用它覆盖组件自带的颜色和尺寸。引入 shadcn/ui 时换成 clsx + tailwind-merge。
 */
export function cn(...values: ClassValue[]): string {
  return values.filter((v) => typeof v === 'string' && v.length > 0).join(' ')
}
