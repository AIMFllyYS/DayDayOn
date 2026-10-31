import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Annotator } from './_annotate/annotator'

/*
 * 调试区（URL 为 /dev/*），生产环境整个子树返回 404。
 * 不用 _dev：下划线开头的文件夹是 Next 的私有文件夹，不生成路由（见 docs/conventions/routing.md 第 5 节）。
 * 正式代码不得 import 这里的任何文件。
 */
export const metadata: Metadata = {
  title: { default: '调试区', template: '%s · 调试区 · DayDayOn' },
  robots: { index: false, follow: false },
}

export default function DevLayout({ children }: LayoutProps<'/dev'>) {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <>
      {children}
      <Annotator />
    </>
  )
}
