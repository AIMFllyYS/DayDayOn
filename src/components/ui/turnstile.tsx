'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useEffect, useImperativeHandle, useRef, useState, type MouseEvent, type Ref } from 'react'
import { IconButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 自托管「治愈手账」点选人机验证弹窗组件（ADR-0023、ui-primitives.md）。
 *
 * 交互流程（与主流应用一致）：
 * 1. 页面平时不常驻验证画布，保持表单简洁；当用户点击「发送验证码」或「重新发送」时，
 *    调用方通过 ref.current?.open()（或 reset()）弹出独立的人机验证对话框。
 * 2. 弹窗内同源请求 GET /api/auth/captcha 获取服务端旋转/平移/混淆后的手账图标路径（月亮、爱心、星星、太阳、铃铛、小房），
 *    在单个 <canvas> 上按"错版印刷"双层风格渲染，DOM 中无任何图标节点或明文坐标。
 * 3. 用户按提示顺次点选 3 个图标后，请求 POST /api/auth/captcha 校验坐标与耗时，
 *    通过后展示短暂成功反馈、自动关闭弹窗并通过 onTokenChange 回调一次性通行凭证（passToken）。
 */

export const TURNSTILE_TEST_SITE_KEY = 'self-hosted-captcha'

interface CaptchaStroke {
  d: string
  tone: 0 | 1 | 2 | 3 | 4
  fill?: boolean
}

interface CaptchaChallenge {
  challengeId: string
  prompt: [string, string, string]
  width: number
  height: number
  strokes: CaptchaStroke[]
}

interface ClickPoint {
  x: number
  y: number
}

export interface TurnstileFieldRef {
  /** 弹出人机验证对话框并加载新题目 */
  open: () => void
  /** 重置验证状态并关闭弹窗 */
  reset: () => void
}

export interface TurnstileFieldProps {
  /** 验证通过时回调一次性 passToken；重置或取消时回调 undefined */
  onTokenChange?: (token: string | undefined) => void
  /** 验证加载失败时回调 */
  onError?: (errorCode?: string) => void
  /** 业务动作标识（如 'send-otp'），服务端核对 */
  action?: string
  /**
   * 展示模式：
   * - 'modal'（默认）：点击发送验证码时独立弹窗展示
   * - 'always' / 'interaction-only'：兼容旧参数，统一使用独立弹窗交互
   */
  appearance?: 'modal' | 'always' | 'interaction-only'
  /** 兼容保留属性 */
  siteKey?: string
  className?: string
  ref?: Ref<TurnstileFieldRef>
}

const TONE_PALETTE: readonly { stroke: string; fill: string }[] = [
  { stroke: '#2c6a50', fill: 'rgba(124, 201, 166, 0.34)' }, // exercise 薄荷
  { stroke: '#8c3553', fill: 'rgba(242, 160, 184, 0.36)' }, // custom 樱花
  { stroke: '#4a3f8c', fill: 'rgba(169, 157, 230, 0.36)' }, // sleep 薰衣草
  { stroke: '#24578a', fill: 'rgba(134, 189, 232, 0.36)' }, // study 天空
  { stroke: 'rgba(168, 153, 138, 0.42)', fill: 'transparent' }, // 装饰虚线噪点
]

const backdropClass =
  'bg-foreground/30 fixed inset-0 z-50 min-h-dvh transition-opacity duration-(--dur-base) ease-out-soft ' +
  'data-starting-style:opacity-0 data-ending-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute'

function drawScene(canvas: HTMLCanvasElement, challenge: CaptchaChallenge) {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  const w = challenge.width
  const h = challenge.height
  canvas.width = w * dpr
  canvas.height = h * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  // 手账点阵底纹
  ctx.fillStyle = 'rgba(168, 153, 138, 0.25)'
  for (let x = 14; x < w; x += 18) {
    for (let y = 14; y < h; y += 18) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const s of challenge.strokes) {
    const palette = TONE_PALETTE[s.tone] ?? TONE_PALETTE[0]!
    const path = new Path2D(s.d)
    if (s.fill) {
      ctx.save()
      ctx.translate(1.4, 1.4)
      ctx.fillStyle = palette.fill
      ctx.fill(path)
      ctx.restore()
    }
    ctx.strokeStyle = palette.stroke
    ctx.lineWidth = s.tone === 4 ? 1.4 : 2.2
    ctx.stroke(path)
  }

  ctx.restore()
}

export function TurnstileField({
  onTokenChange,
  onError,
  action = 'send-otp',
  className,
  ref,
}: TurnstileFieldProps) {
  const [open, setOpen] = useState(false)
  const [round, setRound] = useState(0)
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null)
  const [clicks, setClicks] = useState<ClickPoint[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'verifying' | 'passed' | 'error'>(
    'loading',
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const firstClickAtRef = useRef<number | null>(null)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch(`/api/auth/captcha?action=${encodeURIComponent(action)}`, {
      method: 'GET',
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`http-${res.status}`)
        return res.json() as Promise<CaptchaChallenge>
      })
      .then((data) => {
        if (cancelled) return
        setChallenge(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
        onErrorRef.current?.('network-error')
      })
    return () => {
      cancelled = true
    }
  }, [open, action, round])

  useEffect(() => {
    if (open && challenge && canvasRef.current && status !== 'passed') {
      drawScene(canvasRef.current, challenge)
    }
  }, [open, challenge, status])

  function reload(keepFeedback = false) {
    setStatus('loading')
    setClicks([])
    firstClickAtRef.current = null
    if (!keepFeedback) setFeedback(null)
    setRound((r) => r + 1)
  }

  function openModal() {
    setStatus('loading')
    setClicks([])
    setFeedback(null)
    firstClickAtRef.current = null
    setOpen(true)
    setRound((r) => r + 1)
  }

  useImperativeHandle(
    ref,
    () => ({
      open() {
        openModal()
      },
      reset() {
        onTokenChange?.(undefined)
        setOpen(false)
        setClicks([])
        setFeedback(null)
      },
    }),
    [onTokenChange],
  )

  async function submitClicks(nextClicks: ClickPoint[]) {
    if (!challenge) return
    setStatus('verifying')
    const now = performance.now()
    const durationMs = Math.max(220, Math.round(now - (firstClickAtRef.current ?? now - 600)))

    try {
      const res = await fetch('/api/auth/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          clicks: nextClicks,
          durationMs,
          action,
        }),
      })
      const data = (await res.json()) as {
        ok: boolean
        token?: string
        challenge?: CaptchaChallenge
      }

      if (data.ok && data.token) {
        const verifiedToken = data.token
        setFeedback(null)
        setStatus('passed')
        setTimeout(() => {
          setOpen(false)
          onTokenChange?.(verifiedToken)
        }, 260)
        return
      }

      // 点错：播放轻晃反馈并立即换上服务端顺带返回的新题目
      onTokenChange?.(undefined)
      setShaking(true)
      setTimeout(() => setShaking(false), 380)
      setFeedback('没点准，已换一题再试试～')
      setClicks([])
      firstClickAtRef.current = null
      if (data.challenge) {
        setChallenge(data.challenge)
        setStatus('ready')
      } else {
        reload(true)
      }
    } catch {
      setStatus('error')
      onError?.('verify-error')
    }
  }

  function handleCanvasClick(e: MouseEvent<HTMLCanvasElement>) {
    if (status !== 'ready' || !challenge || clicks.length >= 3) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const x = Math.round(((e.clientX - rect.left) / rect.width) * challenge.width)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * challenge.height)

    if (clicks.length === 0) {
      firstClickAtRef.current = performance.now()
    }
    const nextClicks = [...clicks, { x, y }]
    setClicks(nextClicks)
    if (feedback) setFeedback(null)

    if (nextClicks.length === 3) {
      void submitClicks(nextClicks)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && status === 'verifying') return
        setOpen(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClass} />
        <Dialog.Popup
          className={cn(
            'bg-surface text-foreground shadow-float fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-3.5 rounded-3xl p-5 outline-none',
            'ease-spring transition-[scale,opacity] duration-(--dur-base)',
            'data-starting-style:scale-90 data-starting-style:opacity-0',
            'data-ending-style:ease-in-soft data-ending-style:scale-95 data-ending-style:opacity-0',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <Dialog.Title className="text-heading font-bold">安全验证</Dialog.Title>
              <Dialog.Description className="text-caption text-muted">
                完成下方手账点选后将自动发送验证码
              </Dialog.Description>
            </div>
            <IconButton
              icon="x"
              label="关闭验证框"
              size="sm"
              onClick={() => setOpen(false)}
              className="-mt-1 -mr-1"
            />
          </div>

          {status === 'passed' ? (
            <div className="bg-success-soft text-success-ink animate-pop-in flex h-[126px] w-full flex-col items-center justify-center gap-2 rounded-2xl px-4">
              <span className="bg-surface flex size-10 items-center justify-center rounded-full">
                <Icon name="check" size={20} />
              </span>
              <span className="text-body font-bold">验证通过，正在发送…</span>
            </div>
          ) : (
            <div
              className={cn(
                'bg-surface-sunken border-border flex w-full flex-col gap-2 rounded-2xl border p-3',
                shaking && 'animate-shake',
              )}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="text-tiny flex min-w-0 flex-wrap items-center gap-1">
                  {status === 'error' ? (
                    <span className="text-danger-ink font-semibold">
                      验证加载失败，点右侧刷新重试
                    </span>
                  ) : feedback ? (
                    <span className="text-warning-ink font-semibold">{feedback}</span>
                  ) : challenge ? (
                    <>
                      <span className="text-muted shrink-0 font-semibold">依次点：</span>
                      {challenge.prompt.map((label, idx) => {
                        const done = idx < clicks.length
                        const current = idx === clicks.length
                        return (
                          <span
                            key={`${label}-${idx}`}
                            className={cn(
                              'text-tiny inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold transition-colors',
                              done
                                ? 'bg-success-soft text-success-ink'
                                : current
                                  ? 'bg-primary-soft text-primary-ink'
                                  : 'bg-surface text-muted',
                            )}
                          >
                            <span className="font-display">{idx + 1}.</span>
                            {label}
                          </span>
                        )
                      })}
                    </>
                  ) : (
                    <span className="text-muted">正在准备手账验证图案…</span>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="换一题"
                  title="换一题"
                  disabled={status === 'loading' || status === 'verifying'}
                  onClick={() => reload()}
                  className="text-tiny text-muted hover:text-foreground hover:bg-surface inline-flex min-h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 font-semibold transition-colors disabled:opacity-50"
                >
                  <Icon name="redo" size={13} />
                  换一题
                </button>
              </div>

              <div className="bg-surface border-border relative flex h-[84px] w-full items-center justify-center overflow-hidden rounded-xl border">
                {challenge && status !== 'error' ? (
                  <>
                    <canvas
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      aria-label={`人机验证画布：请依次点击 ${challenge.prompt.join('、')}`}
                      className={cn(
                        'h-full w-full select-none',
                        status === 'ready' ? 'cursor-pointer' : 'cursor-wait opacity-70',
                      )}
                    />
                    {clicks.map((pt, idx) => (
                      <span
                        key={`${idx}-${pt.x}-${pt.y}`}
                        style={{
                          left: `${(pt.x / challenge.width) * 100}%`,
                          top: `${(pt.y / challenge.height) * 100}%`,
                        }}
                        className="bg-primary text-on-primary font-display text-tiny shadow-soft animate-pop-in pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold"
                      >
                        {idx + 1}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="text-tiny text-muted">
                    {status === 'error' ? '点右上角「换一题」重新加载' : '加载中…'}
                  </span>
                )}
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
