'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import * as z from 'zod'
import { Mascot } from '@/components/mascot/mascot'
import type { MascotMood } from '@/components/mascot/mascot-svg'
import { Button } from '@/components/ui/button'
import { StepProgress } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { AvatarPicker } from '@/features/me/components/avatar-picker'
import { NicknameSchema, OnboardingSchema } from '@/features/me/schemas'
import { kgToGrams } from '@/features/me/units'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, newIdempotencyKey } from '@/lib/api'
import { useCompleteOnboarding } from '@/lib/api/queries/me'
import {
  ConsentStep,
  LeaderboardStep,
  ModulesStep,
  NicknameStep,
  ProfileStep,
  type BasicProfile,
} from './onboarding-steps'

/*
 * 新人引导（PRD 2.2、7.1）：六步，最后一次 POST /me/onboarding，成功后回主页。
 * 每步只校验自己的字段；最后提交前再用同一份 OnboardingSchema 整体校验。
 */

const STEPS: { title: string; note: string; mood: MascotMood }[] = [
  { title: '先认识一下', note: '给自己起个昵称吧', mood: 'happy' },
  { title: '选个头像', note: '可以跳过，跳过就显示昵称首字', mood: 'love' },
  { title: '基础资料', note: '全部可选，之后在「我的」里也能改', mood: 'thinking' },
  { title: '想打卡什么', note: '每选一个，团团帮你建一个默认目标', mood: 'cheer' },
  { title: '要不要上榜', note: '和朋友比一比打卡天数', mood: 'shy' },
  { title: '最后一步', note: '健康数据的使用说明', mood: 'happy' },
]

type Errors = Record<string, string | undefined>

function firstErrors(fields: Record<string, string[] | undefined> | undefined): Errors {
  const out: Errors = {}
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = v?.[0]
  return out
}

/** 服务端字段错误 → 应该回到哪一步 */
const FIELD_STEP: Record<string, number> = {
  nickname: 0,
  avatar: 1,
  gender: 2,
  birthYear: 2,
  heightCm: 2,
  weightGrams: 2,
  timeZone: 2,
  modules: 3,
  leaderboardOptIn: 4,
  healthConsent: 5,
}

export function OnboardingWizard({ thisYear }: { thisYear: number }) {
  const router = useRouter()
  const complete = useCompleteOnboarding()
  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [basic, setBasic] = useState<BasicProfile>({
    gender: null,
    birthYear: null,
    heightCm: null,
    weightKg: null,
    timeZone: 'Asia/Shanghai',
  })
  const [modules, setModules] = useState<Module[]>([])
  const [leaderboard, setLeaderboard] = useState(false)
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  // 一次"开始打卡"一个键；改了内容再提交才换新键
  const [idemKey, setIdemKey] = useState(newIdempotencyKey)

  const meta = STEPS[step] ?? STEPS[0]!
  const last = step === STEPS.length - 1

  function validateStep(): boolean {
    if (step === 0) {
      const r = NicknameSchema.safeParse(nickname)
      if (!r.success) return (setErrors({ nickname: r.error.issues[0]?.message }), false)
    }
    if (step === 3 && modules.length === 0) {
      return (setErrors({ modules: '至少选一个板块' }), false)
    }
    setErrors({})
    return true
  }

  function next() {
    if (!validateStep()) return
    if (!last) return setStep(step + 1)
    submit()
  }

  function submit() {
    if (!consent) return setErrors({ healthConsent: '需要同意健康数据处理才能继续' })
    const parsed = OnboardingSchema.safeParse({
      nickname,
      avatar,
      gender: basic.gender,
      birthYear: basic.birthYear,
      heightCm: basic.heightCm,
      weightGrams: kgToGrams(basic.weightKg),
      timeZone: basic.timeZone,
      modules,
      leaderboardOptIn: leaderboard,
      healthConsent: consent,
    })
    if (!parsed.success)
      return showFieldErrors(firstErrors(z.flattenError(parsed.error).fieldErrors))
    complete.mutate(
      { input: parsed.data, idempotencyKey: idemKey },
      {
        onSuccess: () => {
          toast.success('欢迎加入，开始打卡吧')
          router.replace('/')
          router.refresh()
        },
        onError: (e) => {
          setIdemKey(newIdempotencyKey())
          if (isApiError(e) && e.code === 'ALREADY_ONBOARDED') return router.replace('/')
          if (isApiError(e) && e.fields) return showFieldErrors(firstErrors(e.fields))
          toast.error(isApiError(e) ? errorMessage(e) : '网络好像不太稳，稍后再试试')
        },
      },
    )
  }

  function showFieldErrors(errs: Errors) {
    setErrors(errs)
    const steps = Object.keys(errs)
      .map((k) => FIELD_STEP[k])
      .filter((s): s is number => s !== undefined)
    if (steps.length > 0) setStep(Math.min(...steps))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <StepProgress
          total={STEPS.length}
          done={step + 1}
          label={`第 ${step + 1} 步，共 ${STEPS.length} 步`}
        />
        <p className="text-tiny text-muted">
          第 {step + 1} / {STEPS.length} 步
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Mascot mood={meta.mood} size={72} character="tuan" />
        <div>
          <h2 className="text-heading font-bold">{meta.title}</h2>
          <p className="text-caption text-muted">{meta.note}</p>
        </div>
      </div>

      <div key={step} className="bg-surface shadow-card animate-fade-up rounded-3xl p-5">
        {step === 0 && (
          <NicknameStep value={nickname} onChange={setNickname} error={errors.nickname} />
        )}
        {step === 1 && <AvatarPicker value={avatar} onValueChange={setAvatar} />}
        {step === 2 && (
          <ProfileStep value={basic} onChange={setBasic} errors={errors} thisYear={thisYear} />
        )}
        {step === 3 && <ModulesStep value={modules} onChange={setModules} error={errors.modules} />}
        {step === 4 && <LeaderboardStep value={leaderboard} onChange={setLeaderboard} />}
        {step === 5 && (
          <ConsentStep value={consent} onChange={setConsent} error={errors.healthConsent} />
        )}
      </div>

      <div className="flex items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={complete.isPending}>
            上一步
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="soft"
            onClick={() => {
              setAvatar(null)
              setStep(2)
            }}
          >
            跳过
          </Button>
        )}
        <Button className="ml-auto min-w-32" onClick={next} loading={complete.isPending}>
          {last ? '开始打卡' : '下一步'}
        </Button>
      </div>
    </div>
  )
}
