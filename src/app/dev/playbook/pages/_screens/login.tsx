'use client'

import { useState } from 'react'
import { BrandMark, BrandWordmark } from '@/components/layout/brand'
import { Mascot } from '@/components/mascot/mascot'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

/*
 * 登录（/login）：邮箱验证码，只接受白名单域名（ADR-0002 第 3 节）。
 * 无导航的简洁布局，手机和桌面都是居中一张卡。
 */
export function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('xiaoman@hust.edu.cn')

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 py-10">
      <div className="flex items-center gap-2.5">
        <BrandMark size={36} />
        <BrandWordmark />
      </div>
      <Mascot mood={step === 'email' ? 'happy' : 'thinking'} size={96} floating />
      <div className="bg-surface shadow-card grid w-full max-w-sm gap-4 rounded-3xl p-5">
        {step === 'email' ? (
          <>
            <div>
              <h2 className="text-heading font-bold">欢迎回来</h2>
              <p className="text-caption text-muted">用邮箱收一个验证码就能登录</p>
            </div>
            <Field
              label="邮箱"
              htmlFor="pv-email"
              hint="支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱"
            >
              <Input
                id="pv-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button className="w-full" onClick={() => setStep('code')}>
              发送验证码
            </Button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-heading font-bold">输入验证码</h2>
              <p className="text-caption text-muted">已发送到 {email}，10 分钟内有效</p>
            </div>
            <Field label="6 位验证码" htmlFor="pv-code">
              <Input
                id="pv-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="······"
                className="font-display text-center tracking-[0.5em]"
              />
            </Field>
            <Button className="w-full">登录</Button>
            <Button variant="ghost" size="sm" onClick={() => setStep('email')}>
              换个邮箱
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
