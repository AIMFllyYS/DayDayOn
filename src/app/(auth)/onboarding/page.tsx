import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { OnboardingWizard } from '@/features/onboarding/components/onboarding-wizard'
import { ApiProvider } from '@/lib/api'
import { calendarDateOf } from '@/lib/time'
import { requireUser } from '@/server/auth'
import { getOnboardedAt } from '@/server/services/onboarding/status'

export const metadata: Metadata = { title: '新人引导' }

export default function Page() {
  return (
    <>
      <h1 className="sr-only">新人引导</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <Gate />
      </Suspense>
    </>
  )
}

/** 未登录跳 /login；已完成引导直接回主页 */
async function Gate() {
  const user = await requireUser()
  if (await getOnboardedAt(user.id)) redirect('/')
  const thisYear = Number(calendarDateOf(new Date(), 'Asia/Shanghai').slice(0, 4))
  return (
    <ApiProvider>
      <OnboardingWizard thisYear={thisYear} />
    </ApiProvider>
  )
}
