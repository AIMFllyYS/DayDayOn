/*
 * 浮层（Select / Combobox / Menu / Popover）共用的样式片段。只在 src/components/ui/ 内部使用。
 * 进退场：从触发器方向（--transform-origin）缩放 + 淡入，时长和缓动只用 token（ui-primitives.md 第 5 节）。
 */

/** 浮层外壳：贴纸白底、float 阴影、2xl 圆角 */
export const popupSurfaceClass =
  'bg-surface text-foreground shadow-float border-border rounded-2xl border outline-none ' +
  'origin-(--transform-origin) ease-out-soft transition-[scale,opacity] duration-(--dur-base) ' +
  'data-starting-style:scale-95 data-starting-style:opacity-0 ' +
  'data-ending-style:ease-in-soft data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-(--dur-fast)'

/** 列表项：高 44px，键盘 / 指针高亮用 data-highlighted */
export const popupItemClass =
  'text-body flex min-h-11 cursor-default items-center gap-2.5 rounded-xl px-3 py-2 outline-none select-none ' +
  'data-highlighted:bg-surface-sunken data-disabled:opacity-50'

/** 触发器（选择框外观）：和 Input 同一套边框与焦点环 */
export const triggerBoxClass =
  'border-border bg-surface text-body text-foreground flex h-12 w-full items-center gap-2 rounded-xl border px-4 text-left ' +
  'transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-border-strong ' +
  'focus-visible:border-primary focus-visible:ring-primary-soft focus-visible:ring-4 focus-visible:outline-none ' +
  'data-popup-open:border-primary aria-invalid:border-danger data-invalid:border-danger data-disabled:opacity-50'
