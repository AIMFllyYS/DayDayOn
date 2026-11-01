import { MockLanguageModelV4 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DietRecognitionResultSchema } from '@/features/diet/schemas'
import { ApiError } from '@/server/api/errors'
import type { RunAiInput, RunAiResult } from '../run'
import { dietRecognitionPrompt } from './diet-recognition'

/*
 * 饮食识别 service 的三条路径（testing.md 第 3 节）：成功 / 输出不合法 / 模型报错，外加超时与未配置密钥。
 * runAi 的数据库部分（检查、预占、结算、写 ai_runs）被替换成内存版本，模型调用仍走真实的 callModel，
 * 所以 prompt、输出 schema、超时设置和 service 的映射都被覆盖到。不连数据库、不调真实 DeepSeek。
 */

const AI_RUN_ID = '0193f6b2-0000-7000-8000-00000000abcd'

const mocks = vi.hoisted(() => ({
  configured: true,
  calls: [] as unknown[],
}))

vi.mock('../model', () => ({
  isAiConfigured: () => mocks.configured,
  getFlashModel: () => {
    throw new Error('测试必须注入 model')
  },
  hashedUserId: async () => 'a'.repeat(64),
}))

vi.mock('../run', async () => {
  const { callModel } = await import('../call-model')
  return {
    runAi: async <S extends import('zod').ZodType>(
      input: RunAiInput<'diet-recognition', S>,
    ): Promise<RunAiResult<S>> => {
      mocks.calls.push(input)
      if (!input.model) throw new Error('测试必须注入 model')
      const r = await callModel({
        model: input.model,
        system: input.prompt.system,
        schema: input.prompt.schema,
        maxOutputTokens: input.prompt.maxOutputTokens,
        thinking: input.prompt.thinking,
        messages: input.messages,
        userIdHash: 'a'.repeat(64),
        timeoutMs: input.prompt.timeoutMs,
      })
      if (r.kind === 'ok')
        return { ok: true, aiRunId: AI_RUN_ID, output: r.output, costMicros: 7000 }
      return { ok: false, aiRunId: AI_RUN_ID, reason: r.kind, costMicros: 0 }
    },
  }
})

const { recognizeDiet } = await import('@/server/services/diet-recognition')

const usage = {
  inputTokens: { total: 1500, noCache: 1500, cacheRead: 0, cacheWrite: undefined },
  outputTokens: { total: 300, text: 300, reasoning: undefined },
}

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  })
}

function jpeg(size = 32): File {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  return new File([bytes], 'meal.jpg', { type: 'image/jpeg' })
}

const goodOutput = {
  items: [
    {
      name: ' 番茄炒蛋 ',
      portion: '约 200 克',
      lowKcal: 240,
      highKcal: 280,
      proteinGrams: 12,
      fatGrams: 15,
      carbGrams: null,
    },
    {
      name: '米饭',
      portion: '一碗约 150 克',
      lowKcal: 165,
      highKcal: 180,
      proteinGrams: null,
      fatGrams: null,
      carbGrams: null,
    },
  ],
  // 模型把合计算错了：service 按条目重新求和
  totalLowKcal: 999,
  totalHighKcal: 999,
  confidence: 0.82,
  summary: '午餐：番茄炒蛋和一碗米饭',
}

const base = {
  userId: 'u1',
  ip: '127.0.0.1',
  idempotencyKey: '0193f6b2-0000-7000-8000-000000000999',
  fields: { mealType: 'lunch' as const, note: '少油' },
}

async function codeOf(p: Promise<unknown>): Promise<{ code: string; aiRunId?: string }> {
  try {
    await p
    return { code: 'ok' }
  } catch (e) {
    if (e instanceof ApiError) return { code: e.code, aiRunId: e.extras.aiRunId }
    throw e
  }
}

beforeEach(() => {
  mocks.configured = true
  mocks.calls = []
})

describe('dietRecognitionPrompt', () => {
  it('显式关闭思考、800 输出上限、30 秒超时、版本 1', () => {
    expect(dietRecognitionPrompt).toMatchObject({
      id: 'diet-recognition',
      version: 1,
      maxOutputTokens: 800,
      thinking: { type: 'disabled' },
      timeoutMs: 30_000,
    })
  })
})

describe('recognizeDiet', () => {
  it('成功：返回规范化后的草稿和 aiRunId，图片作为内联 file part，餐次和备注只在 user message', async () => {
    const model = modelReturning(JSON.stringify(goodOutput))
    const r = await recognizeDiet({ ...base, image: jpeg(), model })

    expect(DietRecognitionResultSchema.safeParse(r).success).toBe(true)
    expect(r.aiRunId).toBe(AI_RUN_ID)
    expect(r.draft.items[0]?.name).toBe('番茄炒蛋')
    expect(r.draft.totalLowKcal).toBe(405)
    expect(r.draft.totalHighKcal).toBe(460)

    const call = model.doGenerateCalls[0]
    expect(call?.maxOutputTokens).toBe(800)
    expect(call?.providerOptions?.deepseek).toMatchObject({ thinking: { type: 'disabled' } })
    const system = call?.prompt.find((m) => m.role === 'system')
    expect(system?.content).toBe(dietRecognitionPrompt.system)
    expect(String(system?.content)).not.toContain('少油')
    const user = call?.prompt.find((m) => m.role === 'user')
    const parts = Array.isArray(user?.content) ? user.content : []
    expect(parts.some((p) => p.type === 'file' && p.mediaType === 'image/jpeg')).toBe(true)
    expect(
      parts.some((p) => p.type === 'text' && p.text.includes('午餐') && p.text.includes('少油')),
    ).toBe(true)
  })

  it('低置信度不是错误：照常返回草稿', async () => {
    const model = modelReturning(JSON.stringify({ ...goodOutput, confidence: 0.3 }))
    const r = await recognizeDiet({ ...base, image: jpeg(), model })
    expect(r.draft.confidence).toBe(0.3)
  })

  it('输出不符合 schema（热量区间反了）：422 AI_RECOGNITION_FAILED 带 aiRunId', async () => {
    const bad = {
      ...goodOutput,
      items: [{ ...goodOutput.items[1], lowKcal: 300, highKcal: 100 }],
    }
    const r = await codeOf(
      recognizeDiet({ ...base, image: jpeg(), model: modelReturning(JSON.stringify(bad)) }),
    )
    expect(r).toEqual({ code: 'AI_RECOGNITION_FAILED', aiRunId: AI_RUN_ID })
  })

  it('输出不是 JSON：422 AI_RECOGNITION_FAILED', async () => {
    const r = await codeOf(
      recognizeDiet({ ...base, image: jpeg(), model: modelReturning('这是一碗面') }),
    )
    expect(r.code).toBe('AI_RECOGNITION_FAILED')
  })

  it('模型报错：422 AI_RECOGNITION_FAILED（预占由 runAi 释放）', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('upstream 500')
      },
    })
    const r = await codeOf(recognizeDiet({ ...base, image: jpeg(), model }))
    expect(r).toEqual({ code: 'AI_RECOGNITION_FAILED', aiRunId: AI_RUN_ID })
  })

  it('没有 DEEPSEEK_API_KEY：503 AI_PAUSED，不读图片、不调用 runAi', async () => {
    mocks.configured = false
    const r = await codeOf(recognizeDiet({ ...base, image: jpeg(), model: modelReturning('{}') }))
    expect(r.code).toBe('AI_PAUSED')
    expect(mocks.calls).toHaveLength(0)
  })

  it('图片不是 JPEG：400 VALIDATION_FAILED，不调用 runAi', async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'x.png', { type: 'image/png' })
    const r = await codeOf(recognizeDiet({ ...base, image: png, model: modelReturning('{}') }))
    expect(r.code).toBe('VALIDATION_FAILED')
    expect(mocks.calls).toHaveLength(0)
  })
})
