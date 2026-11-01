'use client'

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useId, useImperativeHandle, useRef, type Ref } from 'react'
import { cn } from '@/lib/cn'

/*
 * Cloudflare Turnstile 人机验证封装（ADR-0023、ui-primitives.md）。
 * 全项目唯一允许 import @marsidev/react-turnstile 的入口。
 *
 * 规则：
 * 1. 默认使用 NEXT_PUBLIC_TURNSTILE_SITE_KEY；未配置时回退到 Cloudflare 官方测试 Site Key（总是通过），
 *    保证本地开发与 Playbook 开箱可用。
 * 2. 用 useId() 生成唯一容器 id，避免 Playbook 同屏渲染手机 + 桌面多实例时冲突（默认是固定 'cf-turnstile'）。
 * 3. token 一次性有效，调用方消费后通过 ref.current?.reset() 刷新。
 */

/** Cloudflare 官方测试 Site Key（可见、总是通过） */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

export interface TurnstileFieldRef {
  /** 重置验证组件并重新获取新 token */
  reset: () => void
}

export interface TurnstileFieldProps {
  /** 验证通过时回调 token；过期、出错或重置时回调 undefined */
  onTokenChange?: (token: string | undefined) => void
  /** 验证失败时回调错误码 */
  onError?: (errorCode?: string) => void
  /** 业务动作标识（如 'send-otp'），服务端可核对 */
  action?: string
  /**
   * 展示模式：
   * - 'always'（默认）：始终显示验证条
   * - 'interaction-only'：静默校验，仅需交互时展开
   */
  appearance?: 'always' | 'interaction-only'
  /** 覆盖默认 Site Key（Playbook 演示用） */
  siteKey?: string
  className?: string
  ref?: Ref<TurnstileFieldRef>
}

export function TurnstileField({
  onTokenChange,
  onError,
  action = 'send-otp',
  appearance = 'always',
  siteKey,
  className,
  ref,
}: TurnstileFieldProps) {
  const id = useId()
  const instanceRef = useRef<TurnstileInstance | undefined>(undefined)
  const resolvedSiteKey =
    siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TURNSTILE_TEST_SITE_KEY

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        onTokenChange?.(undefined)
        instanceRef.current?.reset()
      },
    }),
    [onTokenChange],
  )

  return (
    <div
      className={cn(
        'flex w-full items-center justify-center overflow-hidden rounded-2xl',
        appearance === 'always' && 'bg-surface-sunken min-h-[65px]',
        className,
      )}
    >
      <Turnstile
        id={`turnstile-${id}`}
        ref={instanceRef}
        siteKey={resolvedSiteKey}
        options={{
          theme: 'light',
          size: 'flexible',
          language: 'zh-cn',
          action,
          appearance,
          refreshExpired: 'auto',
        }}
        onSuccess={(token) => onTokenChange?.(token)}
        onExpire={() => onTokenChange?.(undefined)}
        onError={(code) => {
          onTokenChange?.(undefined)
          onError?.(code)
        }}
      />
    </div>
  )
}
