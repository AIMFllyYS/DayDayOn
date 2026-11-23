import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { TodoArchivedPage } from '@/features/todo/components/todo-archived-page'

export const metadata: Metadata = { title: '已归档待办' }

/** /todo/archived：满 30 天自动归档待办独立单页（二级页面，自动隐藏底栏、顶栏带返回） */
export default function Page() {
  return (
    <AppPage title="已归档待办" backHref="/todo" className="pb-6">
      <TodoArchivedPage />
    </AppPage>
  )
}
