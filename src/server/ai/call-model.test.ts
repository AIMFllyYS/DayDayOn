import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import { callModel } from './call-model'

const schema = z.object({ summary: z.string(), kcal: z.number().int() })

const usage = {
  inputTokens: { total: 1200, noCache: 1000, cacheRead: 200, cacheWrite: undefined },
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

const base = {
  system: '你是饮食识别助手',
  schema,
  maxOutputTokens: 800,
  thinking: { type: 'disabled' as const },
  messages: [{ role: 'user' as const, content: '一碗面' }],
  userIdHash: 'a'.repeat(64),
}

describe('callModel', () => {
  it('成功：返回校验后的输出和分层用量，显式关闭思考并传哈希后的 userId', async () => {
    const model = modelReturning('{"summary":"一碗牛肉面","kcal":650}')
    const r = await callModel({ ...base, model })
    expect(r).toEqual({
      kind: 'ok',
      output: { summary: '一碗牛肉面', kcal: 650 },
      usage: { inputMissTokens: 1000, inputHitTokens: 200, outputTokens: 300 },
    })
    const call = model.doGenerateCalls[0]
    expect(call?.maxOutputTokens).toBe(800)
    expect(call?.providerOptions?.deepseek).toEqual({
      thinking: { type: 'disabled' },
      userId: 'a'.repeat(64),
    })
  })

  it('输出不符合 schema：invalid-output，用量照常带回用于结算', async () => {
    const r = await callModel({ ...base, model: modelReturning('{"summary":"x"}') })
    expect(r.kind).toBe('invalid-output')
    expect(r.usage).toEqual({ inputMissTokens: 1000, inputHitTokens: 200, outputTokens: 300 })
  })

  it('输出不是 JSON：invalid-output', async () => {
    const r = await callModel({ ...base, model: modelReturning('这不是 JSON') })
    expect(r.kind).toBe('invalid-output')
  })

  it('模型报错：failed，用量为 0（全额释放）', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('upstream 500')
      },
    })
    const r = await callModel({ ...base, model })
    expect(r).toEqual({
      kind: 'failed',
      usage: { inputMissTokens: 0, inputHitTokens: 0, outputTokens: 0 },
    })
  })

  it('超时：timeout', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () => reject(abortSignal.reason))
        }),
    })
    const r = await callModel({ ...base, model, timeoutMs: 20 })
    expect(r.kind).toBe('timeout')
  })
})
