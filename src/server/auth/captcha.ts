import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { APIError } from 'better-auth/api'
import { env } from '@/server/env'
import {
  CAPTCHA_HEIGHT,
  CAPTCHA_HIT_RADIUS,
  CAPTCHA_WIDTH,
  generateCaptchaScene,
  type CaptchaStroke,
} from './captcha-shapes'
import { clientIp, LOCAL_IP } from './ip'

/*
 * 自托管手账风点选人机验证服务端（ADR-0023、auth.md 第 3 节）。
 *
 * 两阶段协议（同源零外部依赖，复用 BETTER_AUTH_SECRET 做 AES-256-GCM 认证加密）：
 * 1. GET /api/auth/captcha  -> 下发变形混淆后的手账图标 Canvas 路径 + 加密 challengeId（不含明文坐标）
 * 2. POST /api/auth/captcha -> 校验 3 次顺次点击坐标与人类耗时，无论对错立即销毁该 challengeId（防穷举），
 *                              通过则签发一次性通行令牌 passToken，失败则顺带返回新题目
 * 3. POST /api/auth/email-otp/send-verification-otp -> 请求头 `x-captcha-response` 携带 passToken，
 *                              在 hooks.before 最前面由 enforceTurnstile 验签并一次性消费
 */

export const CAPTCHA_HEADER = 'x-captcha-response'
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

const CHALLENGE_TTL_MS = 2 * 60_000
const PASS_TTL_MS = 2 * 60_000
const MIN_HUMAN_DURATION_MS = 180
const MAX_HUMAN_DURATION_MS = 120_000
const MAX_NONCE_CACHE = 5_000

/** 进程内已消费一次性 nonce 集合（nonce -> 过期时间戳 ms） */
const consumedNonces = new Map<string, number>()

function consumeNonceOnce(nonce: string, nowMs: number): boolean {
  if (consumedNonces.size > MAX_NONCE_CACHE) {
    for (const [k, exp] of consumedNonces) {
      if (exp <= nowMs) consumedNonces.delete(k)
    }
    if (consumedNonces.size > MAX_NONCE_CACHE) {
      const oldest = consumedNonces.keys().next().value
      if (oldest) consumedNonces.delete(oldest)
    }
  }
  const existingExp = consumedNonces.get(nonce)
  if (existingExp !== undefined && existingExp > nowMs) {
    return false
  }
  consumedNonces.set(nonce, nowMs + CHALLENGE_TTL_MS + PASS_TTL_MS)
  return true
}

function resolveSecret(secretKey?: string): string {
  if (secretKey) return secretKey
  try {
    return env.BETTER_AUTH_SECRET
  } catch {
    return TURNSTILE_TEST_SECRET_KEY
  }
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(`daydayon-captcha:${secret}`).digest()
}

function sealPayload(payload: unknown, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`
}

function openPayload<T>(token: string, secret: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const iv = Buffer.from(parts[0]!, 'base64url')
    const tag = Buffer.from(parts[1]!, 'base64url')
    const encrypted = Buffer.from(parts[2]!, 'base64url')
    if (iv.length !== 12 || tag.length !== 16) return null
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv)
    decipher.setAuthTag(tag)
    const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

interface ChallengeTokenPayload {
  k: 'c'
  id: string
  act: string
  ip?: string
  exp: number
  pts: [[number, number], [number, number], [number, number]]
}

interface PassTokenPayload {
  k: 'p'
  id: string
  act: string
  ip?: string
  exp: number
}

export interface CaptchaChallengeDTO {
  challengeId: string
  prompt: [string, string, string]
  width: number
  height: number
  strokes: CaptchaStroke[]
}

export interface CreateChallengeOptions {
  action?: string
  remoteIp?: string
  secretKey?: string
  nowMs?: number
}

/** 生成一道手账图标点选题目（附带内部目标坐标供单元测试断言） */
export function createCaptchaChallengeWithTargets(opts: CreateChallengeOptions = {}): {
  challenge: CaptchaChallengeDTO
  targets: [[number, number], [number, number], [number, number]]
} {
  const secret = resolveSecret(opts.secretKey)
  const nowMs = opts.nowMs ?? Date.now()
  const scene = generateCaptchaScene()
  const payload: ChallengeTokenPayload = {
    k: 'c',
    id: randomBytes(12).toString('base64url'),
    act: opts.action ?? 'send-otp',
    ip: opts.remoteIp && opts.remoteIp !== LOCAL_IP ? opts.remoteIp : undefined,
    exp: nowMs + CHALLENGE_TTL_MS,
    pts: scene.targets,
  }
  return {
    challenge: {
      challengeId: sealPayload(payload, secret),
      prompt: scene.prompt,
      width: CAPTCHA_WIDTH,
      height: CAPTCHA_HEIGHT,
      strokes: scene.strokes,
    },
    targets: scene.targets,
  }
}

export function createCaptchaChallenge(opts: CreateChallengeOptions = {}): CaptchaChallengeDTO {
  return createCaptchaChallengeWithTargets(opts).challenge
}

export interface ClickPoint {
  x: number
  y: number
}

export interface SolveChallengeOptions {
  challengeId: string | null | undefined
  clicks: readonly ClickPoint[] | null | undefined
  durationMs?: number
  action?: string
  remoteIp?: string
  secretKey?: string
  nowMs?: number
}

export interface SolveChallengeResult {
  ok: boolean
  token?: string
  code?: 'INVALID_CHALLENGE' | 'EXPIRED_CHALLENGE' | 'WRONG_ANSWER'
  challenge?: CaptchaChallengeDTO
}

/** 校验用户的 3 次点击坐标并签发一次性 passToken；单次挑战无论对错立即销毁防穷举 */
export function solveCaptchaChallenge(opts: SolveChallengeOptions): SolveChallengeResult {
  const secret = resolveSecret(opts.secretKey)
  const nowMs = opts.nowMs ?? Date.now()
  const action = opts.action ?? 'send-otp'
  const fresh = () =>
    createCaptchaChallenge({ action, remoteIp: opts.remoteIp, secretKey: secret, nowMs })

  if (!opts.challengeId || !Array.isArray(opts.clicks) || opts.clicks.length !== 3) {
    return { ok: false, code: 'INVALID_CHALLENGE', challenge: fresh() }
  }

  const decoded = openPayload<ChallengeTokenPayload>(opts.challengeId, secret)
  if (!decoded || decoded.k !== 'c' || decoded.act !== action) {
    return { ok: false, code: 'INVALID_CHALLENGE', challenge: fresh() }
  }

  if (nowMs > decoded.exp || !consumeNonceOnce(`c:${decoded.id}`, nowMs)) {
    return { ok: false, code: 'EXPIRED_CHALLENGE', challenge: fresh() }
  }

  const dur = opts.durationMs ?? 800
  if (dur < MIN_HUMAN_DURATION_MS || dur > MAX_HUMAN_DURATION_MS) {
    return { ok: false, code: 'WRONG_ANSWER', challenge: fresh() }
  }

  for (let i = 0; i < 3; i++) {
    const click = opts.clicks[i]!
    const target = decoded.pts[i]!
    if (typeof click.x !== 'number' || typeof click.y !== 'number') {
      return { ok: false, code: 'WRONG_ANSWER', challenge: fresh() }
    }
    const dist = Math.hypot(click.x - target[0], click.y - target[1])
    if (dist > CAPTCHA_HIT_RADIUS) {
      return { ok: false, code: 'WRONG_ANSWER', challenge: fresh() }
    }
  }

  const passPayload: PassTokenPayload = {
    k: 'p',
    id: randomBytes(12).toString('base64url'),
    act: action,
    ip: opts.remoteIp && opts.remoteIp !== LOCAL_IP ? opts.remoteIp : undefined,
    exp: nowMs + PASS_TTL_MS,
  }
  return { ok: true, token: sealPayload(passPayload, secret) }
}

export interface VerifyTurnstileOptions {
  token: string | null | undefined
  secretKey?: string
  remoteIp?: string
  expectedAction?: string
  nowMs?: number
}

export interface VerifyTurnstileResult {
  ok: boolean
  code?: 'MISSING_RESPONSE' | 'VERIFICATION_FAILED'
  errorCodes?: string[]
}

/** 校验并一次性消费发码请求头中的 passToken */
export async function verifyTurnstileToken({
  token,
  secretKey,
  remoteIp,
  expectedAction,
  nowMs = Date.now(),
}: VerifyTurnstileOptions): Promise<VerifyTurnstileResult> {
  const trimmed = token?.trim()
  if (!trimmed) {
    return { ok: false, code: 'MISSING_RESPONSE' }
  }

  const secret = resolveSecret(secretKey)
  if (
    process.env.NODE_ENV !== 'production' &&
    secret === TURNSTILE_TEST_SECRET_KEY &&
    trimmed.includes('DUMMY.TOKEN')
  ) {
    return { ok: true }
  }

  const decoded = openPayload<PassTokenPayload>(trimmed, secret)
  if (!decoded || decoded.k !== 'p') {
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['invalid-token'] }
  }

  if (nowMs > decoded.exp) {
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['timeout-or-duplicate'] }
  }

  if (expectedAction && decoded.act !== expectedAction) {
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['action-mismatch'] }
  }

  const normalizedIp = remoteIp && remoteIp !== LOCAL_IP ? remoteIp : undefined
  if (decoded.ip && normalizedIp && decoded.ip !== normalizedIp) {
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['ip-mismatch'] }
  }

  if (!consumeNonceOnce(`p:${decoded.id}`, nowMs)) {
    return { ok: false, code: 'VERIFICATION_FAILED', errorCodes: ['timeout-or-duplicate'] }
  }

  return { ok: true }
}

/** 在 Better Auth hooks.before 中调用：校验不通过直接抛 APIError */
export async function enforceTurnstile(
  headers: Headers | null | undefined,
  remoteIp: string,
): Promise<void> {
  const token = headers?.get(CAPTCHA_HEADER)
  if (env.NODE_ENV === 'test' && !token) {
    return
  }

  const result = await verifyTurnstileToken({
    token,
    remoteIp,
    expectedAction: 'send-otp',
  })

  if (!result.ok) {
    if (result.code === 'MISSING_RESPONSE') {
      throw new APIError('BAD_REQUEST', {
        code: 'MISSING_RESPONSE',
        message: '请先完成人机验证',
      })
    }
    throw new APIError('FORBIDDEN', {
      code: 'VERIFICATION_FAILED',
      message: '人机验证未通过，请重新点选后再试一次',
    })
  }
}

/** 处理 /api/auth/captcha 的 GET（出题）与 POST（核对坐标换取 passToken）请求 */
export async function handleCaptchaRequest(request: Request): Promise<Response> {
  const ip = clientIp(request.headers)
  const url = new URL(request.url)
  const action = url.searchParams.get('action') ?? 'send-otp'
  const jsonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  }

  if (request.method === 'GET') {
    const challenge = createCaptchaChallenge({ action, remoteIp: ip })
    return new Response(JSON.stringify(challenge), { status: 200, headers: jsonHeaders })
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as {
        challengeId?: string
        clicks?: ClickPoint[]
        durationMs?: number
        action?: string
      }
      const res = solveCaptchaChallenge({
        challengeId: body.challengeId,
        clicks: body.clicks,
        durationMs: body.durationMs,
        action: body.action ?? action,
        remoteIp: ip,
      })
      return new Response(JSON.stringify(res), {
        status: res.ok ? 200 : 422,
        headers: jsonHeaders,
      })
    } catch {
      const challenge = createCaptchaChallenge({ action, remoteIp: ip })
      return new Response(JSON.stringify({ ok: false, code: 'INVALID_CHALLENGE', challenge }), {
        status: 400,
        headers: jsonHeaders,
      })
    }
  }

  return new Response(null, { status: 405 })
}
