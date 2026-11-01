'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { OTPField } from '@/components/ui/otp-field'
import { toast } from '@/components/ui/toast'
import { errorMessage } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { groupSecret, parseTotpUri, type TotpSetup } from '../totp'

/*
 * 管理员两步验证绑定（PRD 7.1、auth.md 第 6 节）：未开启时 /admin 整页显示这里，不显示后台内容。
 * 1. authClient.twoFactor.enable → 拿到 totpURI 和备用码；
 * 2. 只显示 totpURI 里的密钥文本，供在身份验证器里手动输入（不显示二维码、不引入二维码库）；
 * 3. 输 6 位码 authClient.twoFactor.verifyTotp 确认，成功后会话里的 twoFactorEnabled 变为 true，刷新页面。
 */

type Step =
  { kind: 'intro' } | { kind: 'bind'; setup: TotpSetup; backupCodes: string[] } | { kind: 'done' }

interface TwoFactorSetupProps {
  /** Playbook 演示用：直接从绑定步骤开始，不请求接口 */
  demo?: { setup: TotpSetup; backupCodes: string[] }
}

/*
 * Better Auth 的错误码不在本项目错误码表里：INVALID_CODE 单独给文案，其余按 errorMessage 兜底。
 * 注意 twoFactor.enable 默认要求密码；本项目只有验证码登录，auth.ts 需要 twoFactor({ allowPasswordless: true })。
 */
function authErrorText(error: { code?: string } | null, fallback: string): string {
  if (!error?.code) return fallback
  if (error.code === 'INVALID_CODE') return '验证码不对，看一下身份验证器上最新的 6 位码'
  if (error.code === 'INVALID_PASSWORD') return '服务器还没允许无密码开启两步验证，联系开发者'
  return errorMessage({ code: error.code })
}

export function TwoFactorSetup({ demo }: TwoFactorSetupProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(demo ? { kind: 'bind', ...demo } : { kind: 'intro' })
  const [pending, setPending] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string>()

  async function start() {
    setPending(true)
    try {
      const { data, error } = await authClient.twoFactor.enable({})
      if (error || !data || data.method !== 'totp') {
        toast.error(authErrorText(error, '没能开始绑定，稍后再试试'))
        return
      }
      const setup = parseTotpUri(data.totpURI)
      if (!setup) {
        toast.error('没能读出密钥，稍后再试试')
        return
      }
      setStep({ kind: 'bind', setup, backupCodes: data.backupCodes })
    } finally {
      setPending(false)
    }
  }

  async function verify(value: string) {
    if (demo) return
    if (!/^\d{6}$/.test(value)) {
      setCodeError('输入身份验证器上的 6 位数字')
      return
    }
    setPending(true)
    setCodeError(undefined)
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code: value })
      if (error) {
        setCodeError(authErrorText(error, '验证码不对，再试一次'))
        return
      }
      setStep({ kind: 'done' })
      toast.success('两步验证已开启')
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what}已复制`)
    } catch {
      toast.error('复制失败，手动选中复制吧')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold">先开启两步验证</h1>
        <p className="text-caption text-muted">
          后台能花钱、能封号，管理员账号必须绑定身份验证器（Google Authenticator、Microsoft
          Authenticator 等都可以）。
        </p>
      </header>

      {step.kind === 'intro' && (
        <Card className="flex flex-col items-start gap-3">
          <p className="text-body">
            点下面的按钮生成密钥，在身份验证器里选「手动输入密钥」，再把它显示的 6 位码填回来。
          </p>
          <Button icon="bolt" loading={pending} onClick={start}>
            开始绑定
          </Button>
        </Card>
      )}

      {step.kind === 'bind' && (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-subhead font-bold">1. 在身份验证器里手动输入</h2>
            <dl className="text-caption grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">账号</dt>
              <dd className="min-w-0 truncate">{step.setup.account ?? '—'}</dd>
              <dt className="text-muted">签发方</dt>
              <dd>{step.setup.issuer ?? 'DayDayOn'}</dd>
              <dt className="text-muted">类型</dt>
              <dd>基于时间（TOTP），6 位，30 秒</dd>
            </dl>
            <div className="bg-surface-sunken flex items-center gap-2 rounded-xl py-1 pr-1 pl-4">
              <code className="text-subhead min-w-0 flex-1 font-mono font-semibold tracking-wider break-all">
                {groupSecret(step.setup.secret)}
              </code>
              <Button
                variant="soft"
                size="md"
                icon="copy"
                onClick={() => copy(step.setup.secret, '密钥')}
              >
                复制
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-subhead font-bold">2. 收好备用码</h2>
                <p className="text-caption text-muted">
                  手机丢了用它登录，每个只能用一次。只显示这一次。
                </p>
              </div>
              <Button
                variant="soft"
                icon="copy"
                onClick={() => copy(step.backupCodes.join('\n'), '备用码')}
              >
                全部复制
              </Button>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {step.backupCodes.map((c) => (
                <li
                  key={c}
                  className="bg-surface-sunken text-caption rounded-lg px-3 py-2 text-center font-mono"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-subhead font-bold">3. 输入 6 位码确认</h2>
            <Field label="身份验证器上的 6 位码" htmlFor="totp-code" error={codeError}>
              <OTPField
                id="totp-code"
                value={code}
                onValueChange={(v) => {
                  setCode(v)
                  setCodeError(undefined)
                }}
                onComplete={verify}
                disabled={pending}
              />
            </Field>
            <Button
              className="self-start"
              loading={pending}
              disabled={code.length !== 6}
              onClick={() => verify(code)}
            >
              确认开启
            </Button>
          </Card>
        </>
      )}

      {step.kind === 'done' && (
        <Card className="flex items-center gap-3">
          <Icon name="check" size={24} className="text-success-ink" />
          <p className="text-body">已开启，正在进入后台…</p>
        </Card>
      )}
    </div>
  )
}
