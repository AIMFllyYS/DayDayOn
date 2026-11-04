/**
 * 对比卡片组：手机上是横向吸附滑动（露出下一张的边，提示可滑），≥ md 恢复 2 列网格。
 * 纯 CSS，直接作为原来 `grid gap-4 md:grid-cols-2` 的替换类，不用改 JSX 嵌套。
 * 子项在手机上占 88% 宽；滑动区向两侧出血到屏幕边缘（抵消页面 px-4）。
 */
export const deckClass =
  'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] max-md:-mx-4 max-md:px-4 max-md:*:w-[88%] max-md:*:shrink-0 max-md:*:snap-center md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden'
