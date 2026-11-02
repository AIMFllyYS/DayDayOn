'use client'

import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { OTPField } from '@/components/ui/otp-field'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import type { FriendInvite, FriendInvitePreview } from '@/features/friend/schemas'
import { errorMessage } from '@/lib/api'
import {
  useAcceptFriendInvite,
  useCreateFriendInvite,
  usePreviewFriendInvite,
} from '@/lib/api/queries/friends'
import { friendActions, useFriendStore } from '../friend-store'

type SheetStep = 'menu' | 'invite' | 'accept'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calcRemainingSeconds(expiresAtIso: string, offsetMs: number): number {
  const expiresAtMs = new Date(expiresAtIso).getTime()
  const nowServerMs = Date.now() + offsetMs
  return Math.max(0, Math.ceil((expiresAtMs - nowServerMs) / 1000))
}

/**
 * 添加好友交互组件（ADR-0026）：
 * 1. 底部抽屉（Sheet）：
 *    - 菜单选择：「发起邀请」或「接受邀请」
 *    - 发起邀请：6 位随机配对码 + 10 分钟真实倒计时（中途点空白处关闭再进入仍保持同一码与剩余时间，到期自动清空）
 *    - 接受邀请：复用 OTPField 输入 6 位配对码
 * 2. 屏幕正中央二次确认弹窗（ConfirmDialog）：
 *    - 展示邀请方头像与昵称，说明双方打卡完全公开且不可关闭
 *    - 左下角「取消」、右下角「接受」；点击接受后触发流星滑入左上角头像动效
 */
export function AddFriendSheet() {
  const { addSheetOpen } = useFriendStore()
  const [step, setStep] = useState<SheetStep>('menu')

  // 发起邀请状态
  const createInvite = useCreateFriendInvite()
  const [inviteData, setInviteData] = useState<FriendInvite | null>(null)
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  // 接受邀请状态
  const previewInvite = usePreviewFriendInvite()
  const acceptInvite = useAcceptFriendInvite()
  const [inputCode, setInputCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<FriendInvitePreview | null>(null)

  // 10 分钟倒计时每秒刷新；到 0 秒后自动清空配对码
  useEffect(() => {
    if (!inviteData) return

    const timer = window.setInterval(() => {
      const next = calcRemainingSeconds(inviteData.expiresAt, clockOffsetMs)
      setRemainingSeconds(next)
      if (next <= 0) {
        setInviteData(null)
        window.clearInterval(timer)
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [inviteData, clockOffsetMs])

  function handleSheetOpenChange(next: boolean) {
    if (!next) {
      friendActions.closeAddSheet()
      setStep('menu')
      setInputCode('')
      setCodeError(null)
    }
  }

  async function handleStartInvite() {
    setStep('invite')
    try {
      const data = await createInvite.mutateAsync()
      const offset = new Date(data.serverNow).getTime() - Date.now()
      const initialRemaining = calcRemainingSeconds(data.expiresAt, offset)
      setClockOffsetMs(offset)
      setRemainingSeconds(initialRemaining)
      setInviteData(initialRemaining > 0 ? data : null)
    } catch (err) {
      toast.error(errorMessage(err as { code: string }))
    }
  }

  function handleOpenAccept() {
    setStep('accept')
    setInputCode('')
    setCodeError(null)
  }

  async function handlePreviewCode(codeToVerify: string) {
    const clean = codeToVerify.trim()
    if (!/^\d{6}$/.test(clean)) {
      setCodeError('请输入完整的 6 位数字配对码')
      return
    }
    setCodeError(null)
    try {
      const preview = await previewInvite.mutateAsync(clean)
      // 收起底部抽屉，弹出屏幕正中央的二次确认弹窗
      handleSheetOpenChange(false)
      setPreviewData(preview)
    } catch (err) {
      const msg = errorMessage(err as { code: string })
      setCodeError(msg)
    }
  }

  async function handleConfirmAccept() {
    if (!previewData) return
    try {
      const result = await acceptInvite.mutateAsync(previewData.code)
      const acceptedFriend = result.friend
      setPreviewData(null)
      toast.success(`已与 ${acceptedFriend.nickname} 成为打卡好友～`)
      // 触发从屏幕中心飞向左上角头像的流星 + 头像弹出 + 气泡引导
      friendActions.launchAcceptMeteor({
        userId: acceptedFriend.userId,
        nickname: acceptedFriend.nickname,
        avatar: acceptedFriend.avatar,
      })
    } catch (err) {
      toast.error(errorMessage(err as { code: string }))
      throw err
    }
  }

  async function handleCopyCode() {
    if (!inviteData) return
    try {
      await navigator.clipboard.writeText(inviteData.code)
      toast.success('配对码已复制，快发给好友吧～')
    } catch {
      toast.info(`配对码：${inviteData.code}`)
    }
  }

  const sheetTitle =
    step === 'menu' ? '添加好友' : step === 'invite' ? '发起好友邀请' : '接受好友邀请'
  const sheetDescription =
    step === 'menu'
      ? '和朋友互相公开打卡仪表盘，一起温暖坚持'
      : step === 'invite'
        ? '将下方 6 位配对码告诉好友，10 分钟内有效'
        : '输入好友发给你的 6 位数字配对码'

  return (
    <>
      <Sheet
        open={addSheetOpen}
        onOpenChange={handleSheetOpenChange}
        title={sheetTitle}
        description={sheetDescription}
      >
        {step === 'menu' && (
          <div className="flex flex-col gap-4 pt-1">
            {/* 菜单栏复用样式：发起邀请 / 接受邀请 */}
            <div className="bg-surface-sunken/50 border-border/60 divide-border/60 divide-y overflow-hidden rounded-2xl border">
              <button
                type="button"
                onClick={() => void handleStartInvite()}
                className="hover:bg-surface-sunken active:bg-surface-sunken flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors"
              >
                <span className="bg-primary-soft text-primary-ink flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon name="custom" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body text-foreground font-semibold">发起邀请</div>
                  <div className="text-caption text-muted mt-0.5">生成 6 位配对验证码</div>
                </div>
                <Icon name="chevron-right" size={18} className="text-muted shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleOpenAccept}
                className="hover:bg-surface-sunken active:bg-surface-sunken flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors"
              >
                <span className="bg-study-soft text-study-ink flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon name="check" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body text-foreground font-semibold">接受邀请</div>
                  <div className="text-caption text-muted mt-0.5">
                    输入好友的 6 位配对码完成绑定
                  </div>
                </div>
                <Icon name="chevron-right" size={18} className="text-muted shrink-0" />
              </button>
            </div>

            {/* 公开透明提示 */}
            <div className="bg-primary-soft/60 text-primary-ink flex items-start gap-2.5 rounded-2xl px-4 py-3">
              <Icon name="bulb" size={18} className="mt-0.5 shrink-0" />
              <p className="text-caption leading-relaxed">
                添加完好友之后，你们双方就能看到对方完整的打卡信息（今日进度、热力图、体重与心情），并且不可关闭。
              </p>
            </div>
          </div>
        )}

        {step === 'invite' && (
          <div className="flex flex-col gap-4 pt-1">
            <div className="bg-primary-soft/60 text-primary-ink flex items-start gap-2.5 rounded-2xl px-4 py-3">
              <Icon name="bulb" size={18} className="mt-0.5 shrink-0" />
              <p className="text-caption leading-relaxed font-medium">
                添加完好友之后，你们双方就能看到对方完整的打卡信息，并且不可关闭。
              </p>
            </div>

            <div className="bg-surface-sunken/60 border-border/60 flex flex-col items-center gap-3 rounded-2xl border px-4 py-6">
              {createInvite.isPending && !inviteData ? (
                <div className="text-body text-muted flex items-center gap-2 py-4">
                  <Icon name="loader" size={18} className="animate-spin-slow" />
                  <span>正在生成配对码…</span>
                </div>
              ) : inviteData && remainingSeconds > 0 ? (
                <>
                  <span className="text-caption text-muted">
                    请在 10 分钟内让好友在「接受邀请」中填写
                  </span>
                  <div
                    className="flex items-center justify-center gap-2"
                    aria-label={`配对码 ${inviteData.code}`}
                  >
                    {inviteData.code.split('').map((digit, idx) => (
                      <span
                        key={idx}
                        className="bg-surface border-border text-title text-foreground flex h-13 w-11 items-center justify-center rounded-xl border font-bold tabular-nums shadow-2xs"
                      >
                        {digit}
                      </span>
                    ))}
                  </div>
                  <div className="text-caption text-primary-ink bg-primary-soft mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold tabular-nums">
                    <Icon name="clock" size={14} />
                    <span>剩余有效时间 {formatCountdown(remainingSeconds)}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <p className="text-body text-muted">当前配对码已满 10 分钟并自动清空</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleStartInvite()}
                    loading={createInvite.isPending}
                  >
                    重新生成配对码
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setStep('menu')}>
                返回
              </Button>
              {inviteData && remainingSeconds > 0 && (
                <Button variant="primary" className="flex-1" onClick={() => void handleCopyCode()}>
                  复制配对码
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 'accept' && (
          <div className="flex flex-col gap-4 pt-1">
            <Field
              label="6 位配对验证码"
              htmlFor="friend-invite-otp"
              hint="向发起邀请的好友索取 10 分钟内有效的 6 位数字"
              error={codeError ?? undefined}
            >
              <OTPField
                id="friend-invite-otp"
                value={inputCode}
                onValueChange={(val) => {
                  setInputCode(val)
                  if (codeError) setCodeError(null)
                }}
                onComplete={(code) => void handlePreviewCode(code)}
                disabled={previewInvite.isPending}
              />
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="ghost"
                disabled={previewInvite.isPending}
                onClick={() => setStep('menu')}
              >
                返回
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                loading={previewInvite.isPending}
                disabled={inputCode.trim().length !== 6}
                onClick={() => void handlePreviewCode(inputCode)}
              >
                下一步
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* 屏幕正中央二次确认弹窗：左下取消、右下接受 */}
      <ConfirmDialog
        open={previewData !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewData(null)
        }}
        title="是否接受好友邀请？"
        description="添加完好友之后，你们双方就能看到对方完整的打卡信息，并且不可关闭。"
        cancelLabel="取消"
        confirmLabel="接受"
        buttonLayout="split"
        centered
        onConfirm={handleConfirmAccept}
      >
        {previewData && (
          <div className="bg-surface-sunken/70 border-border/60 flex flex-col items-center gap-2.5 rounded-2xl border px-4 py-5">
            <Avatar
              name={previewData.inviter.nickname}
              avatar={previewData.inviter.avatar}
              size="lg"
            />
            <div className="text-center">
              <div className="text-subhead text-foreground font-bold">
                {previewData.inviter.nickname}
              </div>
              <div className="text-caption text-muted mt-0.5">邀请你成为 DayDayOn 打卡好友</div>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
