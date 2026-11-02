import { describe, expect, it } from 'vitest'
import {
  createCaptchaChallengeWithTargets,
  handleCaptchaRequest,
  solveCaptchaChallenge,
  TURNSTILE_TEST_SECRET_KEY,
  verifyTurnstileToken,
} from './captcha'

const SECRET = 'unit-test-secret-key-at-least-32-chars'

describe('self-hosted point-and-click captcha', () => {
  it('缺少或空白 token 返回 MISSING_RESPONSE', async () => {
    expect(await verifyTurnstileToken({ token: null, secretKey: SECRET })).toEqual({
      ok: false,
      code: 'MISSING_RESPONSE',
    })
    expect(await verifyTurnstileToken({ token: '   ', secretKey: SECRET })).toEqual({
      ok: false,
      code: 'MISSING_RESPONSE',
    })
  })

  it('出题 -> 按顺序点选 3 个目标坐标 -> 换取一次性 passToken -> 验签通过', async () => {
    const nowMs = 1_700_000_000_000
    const { challenge, targets } = createCaptchaChallengeWithTargets({
      action: 'send-otp',
      remoteIp: '203.0.113.5',
      secretKey: SECRET,
      nowMs,
    })

    expect(challenge.prompt).toHaveLength(3)
    expect(challenge.strokes.length).toBeGreaterThanOrEqual(10)

    // 模拟手指点击存在轻微偏移（+6px, -5px），仍在 28px 判定半径内
    const solved = solveCaptchaChallenge({
      challengeId: challenge.challengeId,
      clicks: targets.map(([x, y]) => ({ x: x + 6, y: y - 5 })),
      durationMs: 950,
      action: 'send-otp',
      remoteIp: '203.0.113.5',
      secretKey: SECRET,
      nowMs: nowMs + 1000,
    })

    expect(solved.ok).toBe(true)
    expect(solved.token).toBeTypeOf('string')

    const verified = await verifyTurnstileToken({
      token: solved.token,
      secretKey: SECRET,
      remoteIp: '203.0.113.5',
      expectedAction: 'send-otp',
      nowMs: nowMs + 1500,
    })
    expect(verified).toEqual({ ok: true })

    // 同一个 passToken 二次重放立即拒绝
    const replay = await verifyTurnstileToken({
      token: solved.token,
      secretKey: SECRET,
      remoteIp: '203.0.113.5',
      expectedAction: 'send-otp',
      nowMs: nowMs + 1600,
    })
    expect(replay).toEqual({
      ok: false,
      code: 'VERIFICATION_FAILED',
      errorCodes: ['timeout-or-duplicate'],
    })
  })

  it('点错一次后原 challengeId 立即作废（防同题坐标穷举），并顺带返回新题', () => {
    const { challenge, targets } = createCaptchaChallengeWithTargets({
      secretKey: SECRET,
    })

    // 故意颠倒第 1、2 个点击顺序
    const wrong = solveCaptchaChallenge({
      challengeId: challenge.challengeId,
      clicks: [
        { x: targets[1][0], y: targets[1][1] },
        { x: targets[0][0], y: targets[0][1] },
        { x: targets[2][0], y: targets[2][1] },
      ],
      durationMs: 800,
      secretKey: SECRET,
    })

    expect(wrong.ok).toBe(false)
    expect(wrong.code).toBe('WRONG_ANSWER')
    expect(wrong.challenge?.challengeId).toBeTypeOf('string')

    // 即使随后拿着正确坐标重交同一个 challengeId，也已作废
    const retrySameChallenge = solveCaptchaChallenge({
      challengeId: challenge.challengeId,
      clicks: targets.map(([x, y]) => ({ x, y })),
      durationMs: 800,
      secretKey: SECRET,
    })
    expect(retrySameChallenge.ok).toBe(false)
    expect(retrySameChallenge.code).toBe('EXPIRED_CHALLENGE')
  })

  it('耗时过短（脚本瞬移点击 < 180ms）时拒绝', () => {
    const { challenge, targets } = createCaptchaChallengeWithTargets({
      secretKey: SECRET,
    })

    const res = solveCaptchaChallenge({
      challengeId: challenge.challengeId,
      clicks: targets.map(([x, y]) => ({ x, y })),
      durationMs: 20,
      secretKey: SECRET,
    })

    expect(res.ok).toBe(false)
    expect(res.code).toBe('WRONG_ANSWER')
  })

  it('action 或远端 IP 不一致时拒绝（本地 127.0.0.1 豁免 IP 绑定）', async () => {
    const { challenge, targets } = createCaptchaChallengeWithTargets({
      action: 'other-action',
      remoteIp: '198.51.100.8',
      secretKey: SECRET,
    })

    const solved = solveCaptchaChallenge({
      challengeId: challenge.challengeId,
      clicks: targets.map(([x, y]) => ({ x, y })),
      durationMs: 600,
      action: 'other-action',
      remoteIp: '198.51.100.8',
      secretKey: SECRET,
    })

    const actionMismatch = await verifyTurnstileToken({
      token: solved.token,
      secretKey: SECRET,
      remoteIp: '198.51.100.8',
      expectedAction: 'send-otp',
    })
    expect(actionMismatch).toEqual({
      ok: false,
      code: 'VERIFICATION_FAILED',
      errorCodes: ['action-mismatch'],
    })

    const ipMismatch = await verifyTurnstileToken({
      token: solved.token,
      secretKey: SECRET,
      remoteIp: '198.51.100.99',
      expectedAction: 'other-action',
    })
    expect(ipMismatch).toEqual({
      ok: false,
      code: 'VERIFICATION_FAILED',
      errorCodes: ['ip-mismatch'],
    })
  })

  it('非生产环境下 DUMMY.TOKEN 兼容通过', async () => {
    const res = await verifyTurnstileToken({
      token: 'XXXX.DUMMY.TOKEN.XXXX',
      secretKey: TURNSTILE_TEST_SECRET_KEY,
    })
    expect(res).toEqual({ ok: true })
  })

  it('handleCaptchaRequest 支持 GET 出题与 POST 校验', async () => {
    const getRes = await handleCaptchaRequest(
      new Request('http://localhost:23329/api/auth/captcha?action=send-otp'),
    )
    expect(getRes.status).toBe(200)
    const dto = (await getRes.json()) as { challengeId: string; prompt: string[] }
    expect(dto.prompt).toHaveLength(3)

    const postBadRes = await handleCaptchaRequest(
      new Request('http://localhost:23329/api/auth/captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: dto.challengeId,
          clicks: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ],
          durationMs: 500,
        }),
      }),
    )
    expect(postBadRes.status).toBe(422)
  })
})
