import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { TodoTimelinePage } from '@/features/todo/components/todo-timeline-page'

export const metadata: Metadata = { title: '待办过程' }

/** /todo/timeline：待办过程时间轴独立单页（二级页面，自动隐藏底栏、顶栏带返回） */
export default function Page() {
  return (
    <AppPage title="待办过程" backHref="/todo" className="pb-6">
      <TodoTimelinePage />
    </AppPage>
  )
}
