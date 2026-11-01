import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { TodoPage } from '@/features/todo/components/todo-page'
import { TodoScreenSkeleton } from '@/features/todo/components/todo-screen'

export const metadata: Metadata = { title: '待办' }

/** /todo：清单 + DDL；?view=log 是时间日志占位（PRD 2.10） */
export default function Page() {
  return (
    <AppPage title="待办" className="pb-6">
      {/* 读 searchParams 的客户端组件放进 Suspense（Cache Components） */}
      <Suspense fallback={<TodoScreenSkeleton />}>
        <TodoPage />
      </Suspense>
    </AppPage>
  )
}
