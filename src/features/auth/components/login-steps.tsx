'use client'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { OTPField } from '@/components/ui/otp-field'

/*
 * 登录的三个步骤（纯展示，状态在 login-card.tsx）。原型：Playbook 页面预览 LoginScreen。
 */

export const EMAIL_HINT = '支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱'

interface EmailStepProps {
  email: string
  onEmailChange: (v: string) => void
  onSubmit: () => void
  pending: boolean
  error?: string
  cooldown: number
}

export function EmailStep({
  email,
  onEmailChange,
  onSubmit,
  pending,
  error,
  cooldown,
}: EmailStepProps) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div>
        <h2 className="text-heading font-bold">欢迎来打卡</h2>
        <p className="text-caption text-muted">用邮箱收一个验证码就能登录，新邮箱会自动注册</p>
      </div>
      <Field label="邮箱" htmlFor="login-email" hint={EMAIL_HINT} error={error}>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onEmailChange(e.target.value)}
        />
      </Field>
      <Button type="submit" className="w-full" loading={pending} disabled={cooldown > 0}>
        {cooldown > 0 ? `${cooldown} 秒后可重新发送` : '发送验证码'}
      </Button>
    </form>
  )
}

interface CodeStepProps {
  email: string
  code: string
  onCodeChange: (v: string) => void
  onSubmit: (code: string) => void
  onResend: () => void
  onBack: () => void
  pending: boolean
  resending: boolean
  error?: string
  cooldown: number
}

export function CodeStep(p: CodeStepProps) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-heading font-bold">输入验证码</h2>
        <p className="text-caption text-muted break-all">已发送到 {p.email}，5 分钟内有效</p>
      </div>
      <Field label="6 位验证码" htmlFor="login-otp" error={p.error}>
        <OTPField
          id="login-otp"
          value={p.code}
          onValueChange={p.onCodeChange}
          onComplete={p.onSubmit}
          disabled={p.pending}
        />
      </Field>
      <Button
        className="w-full"
        loading={p.pending}
        disabled={p.code.length < 6}
        onClick={() => p.onSubmit(p.code)}
      >
        登录
      </Button>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={p.onBack}>
          换个邮箱
        </Button>
        <Button
          variant="ghost"
          loading={p.resending}
          disabled={p.cooldown > 0}
          onClick={p.onResend}
        >
          {p.cooldown > 0 ? `${p.cooldown} 秒后重发` : '重新发送'}
        </Button>
      </div>
    </div>
  )
}

interface TotpStepProps {
  code: string
  onCodeChange: (v: string) => void
  onSubmit: (code: string) => void
  onBack: () => void
  pending: boolean
  error?: string
}

export function TotpStep(p: TotpStepProps) {
  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-heading font-bold">两步验证</h2>
        <p className="text-caption text-muted">输入身份验证器上的 6 位码</p>
      </div>
      <Field label="身份验证器上的 6 位码" htmlFor="login-totp" error={p.error}>
        <OTPField
          id="login-totp"
          value={p.code}
          onValueChange={p.onCodeChange}
          onComplete={p.onSubmit}
          disabled={p.pending}
        />
      </Field>
      <Button
        className="w-full"
        loading={p.pending}
        disabled={p.code.length < 6}
        onClick={() => p.onSubmit(p.code)}
      >
        验证
      </Button>
      <Button variant="ghost" onClick={p.onBack}>
        重新登录
      </Button>
    </div>
  )
}
