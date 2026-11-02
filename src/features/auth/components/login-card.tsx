'use client'

import { useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import type { TurnstileFieldRef } from '@/components/ui/turnstile'
import { authClient } from '@/lib/auth-client'
import { otpIsDead, safeNextPath, toLoginError, type AuthClientError } from '../login-errors'
import { useCountdown } from '../use-countdown'
import { CodeStep, EmailStep, TotpStep } from './login-steps'

/*
 * 登录（PRD 2.1、7.1）：邮箱 → 点击发送验证码弹出手账人机验证 → 6 位验证码 →（管理员开了两步验证时）身份验证器 6 位码。
 * 只调 src/lib/auth-client.ts，发码、登录都由浏览器请求 /api/auth/*（lessons/better-auth.md：服务端调用不限流）。
 * 必须放在 <Suspense> 里：读 ?next= 与 ?banned=。
 */

type Step = 'email' | 'code' | 'totp'
const RESEND_SECONDS = 60

/** 登录成功：整页跳转，外壳重新取会话（未完成引导会被 (app) 布局送到 /onboarding） */
function finish(next: string) {
  window.location.replace(next)
}

export function LoginCard() {
  const params = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [totp, setTotp] = useState('')
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | undefined>(
    params.get('banned') ? '账号已被停用，重新登录可以看到原因' : undefined,
  )
  const captchaRef = useRef<TurnstileFieldRef>(null)
  const resendModeRef = useRef(false)
  const countdown = useCountdown()

  function requestSend(resend = false) {
    const address = email.trim()
    if (!address) {
      setError('先填一下邮箱')
      return
    }
    setError(undefined)
    resendModeRef.current = resend
    captchaRef.current?.open()
  }

  async function sendWithToken(token: string | undefined) {
    if (!token) return
    const address = email.trim()
    if (!address) return
    const resend = resendModeRef.current
    setError(undefined)
    if (resend) setResending(true)
    else setPending(true)
    const { error: e } = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: 'sign-in',
      fetchOptions: {
        headers: { 'x-captcha-response': token },
      },
    })
    setPending(false)
    setResending(false)
    if (e) return setError(toLoginError(e as AuthClientError).message)
    countdown.start(RESEND_SECONDS)
    setCode('')
    setStep('code')
  }

  async function signIn(otp: string) {
    if (pending || otp.length < 6) return
    setPending(true)
    setError(undefined)
    const { data, error: e } = await authClient.signIn.emailOtp({ email: email.trim(), otp })
    if (e) {
      setPending(false)
      const le = toLoginError(e as AuthClientError)
      setError(le.message)
      setCode('')
      if (otpIsDead(le.code)) countdown.start(0)
      return
    }
    // 两步验证插件在需要第二步时返回 { twoFactorRedirect: true }，此时还没有会话
    if (data && typeof data === 'object' && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
      setPending(false)
      setTotp('')
      setStep('totp')
      return
    }
    finish(next)
  }

  async function verifyTotp(value: string) {
    if (pending || value.length < 6) return
    setPending(true)
    setError(undefined)
    const { error: e } = await authClient.twoFactor.verifyTotp({ code: value })
    if (e) {
      setPending(false)
      setTotp('')
      return setError(toLoginError(e as AuthClientError).message)
    }
    finish(next)
  }

  function backToEmail() {
    setError(undefined)
    setStep('email')
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <Mascot mood={step === 'email' ? 'happy' : 'thinking'} size={96} floating />
      <div className="bg-surface shadow-card w-full max-w-sm rounded-3xl p-5">
        {step === 'email' && (
          <EmailStep
            email={email}
            onEmailChange={setEmail}
            onSubmit={() => requestSend(false)}
            pending={pending}
            error={error}
            cooldown={countdown.left}
            captchaRef={captchaRef}
            onCaptchaTokenChange={(t) => void sendWithToken(t)}
            onCaptchaError={() => setError('人机验证加载失败，点选重试或刷新一下页面')}
          />
        )}
        {step === 'code' && (
          <CodeStep
            email={email.trim()}
            code={code}
            onCodeChange={setCode}
            onSubmit={(v) => void signIn(v)}
            onResend={() => requestSend(true)}
            onBack={backToEmail}
            pending={pending}
            resending={resending}
            error={error}
            cooldown={countdown.left}
            captchaRef={captchaRef}
            onCaptchaTokenChange={(t) => void sendWithToken(t)}
            onCaptchaError={() => setError('人机验证加载失败，点选重试或刷新一下页面')}
          />
        )}
        {step === 'totp' && (
          <TotpStep
            code={totp}
            onCodeChange={setTotp}
            onSubmit={(v) => void verifyTotp(v)}
            onBack={backToEmail}
            pending={pending}
            error={error}
          />
        )}
      </div>
    </div>
  )
}
