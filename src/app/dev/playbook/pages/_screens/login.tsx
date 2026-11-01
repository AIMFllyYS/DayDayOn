'use client'

import { useState } from 'react'
import { BrandMark, BrandWordmark } from '@/components/layout/brand'
import { Mascot } from '@/components/mascot/mascot'
import { CodeStep, EmailStep, TotpStep } from '@/features/auth/components/login-steps'

/*
 * 登录（/login）：渲染正式组件的三个步骤（features/auth），不发请求，点按钮只切换步骤。
 * 正式页面的状态与 authClient 调用在 login-card.tsx。
 */
export function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code' | 'totp'>('email')
  const [email, setEmail] = useState('xiaoman@hust.edu.cn')
  const [code, setCode] = useState('')

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10">
      <div className="flex items-center gap-2.5">
        <BrandMark size={36} />
        <BrandWordmark />
      </div>
      <Mascot mood={step === 'email' ? 'happy' : 'thinking'} size={96} floating />
      <div className="bg-surface shadow-card w-full max-w-sm rounded-3xl p-5">
        {step === 'email' && (
          <EmailStep
            email={email}
            onEmailChange={setEmail}
            onSubmit={() => setStep('code')}
            pending={false}
            cooldown={0}
          />
        )}
        {step === 'code' && (
          <CodeStep
            email={email}
            code={code}
            onCodeChange={setCode}
            onSubmit={() => setStep('totp')}
            onResend={() => {}}
            onBack={() => setStep('email')}
            pending={false}
            resending={false}
            cooldown={42}
          />
        )}
        {step === 'totp' && (
          <TotpStep
            code={code}
            onCodeChange={setCode}
            onSubmit={() => setStep('email')}
            onBack={() => setStep('email')}
            pending={false}
          />
        )}
      </div>
    </div>
  )
}
