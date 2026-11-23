import { convertToModelMessages, type UIMessage } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/quota/ledger', () => ({ getBalance: vi.fn(), reserve: vi.fn() }))
vi.mock('@/server/quota/period', () => ({ spendDayKey: vi.fn() }))
vi.mock('./model', () => ({ getFlashModel: vi.fn(), hashedUserId: vi.fn() }))
vi.mock('./run', () => ({
  afterSpend: vi.fn(),
  checkUserLimits: vi.fn(),
  finishRun: vi.fn(),
  preflight: vi.fn(),
  reconcileStaleRuns: vi.fn(),
  recordPendingUsage: vi.fn(),
  rejectReusedKey: vi.fn(),
  SETTLE_ATTEMPTS: 1,
  SETTLE_RETRY_DELAY_MS: 0,
}))
vi.mock('@/server/services/agent/conversations', () => ({
  ensureConversation: vi.fn(),
  loadMessages: vi.fn(),
  saveMessages: vi.fn(),
  stripFileParts: vi.fn(),
  titleFromFirstUserText: vi.fn(),
  touchConversation: vi.fn(),
}))
vi.mock('@/server/services/agent/pet-name', () => ({ loadPetName: vi.fn() }))
vi.mock('@/server/services/checkins/clock', () => ({ loadClock: vi.fn() }))

const { estimateAgentInputTokens, filterEmptyAssistantMessages, withImageFallbackPrompt } =
  await import('./run-agent')

describe('Agent 多模态图片预估与纯图片引导语补全', () => {
  it('estimateAgentInputTokens 对每张内联图片计入视觉输入 token 预占', () => {
    const textOnly: UIMessage[] = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: '今天吃了番茄炒蛋' }] },
    ]
    const withTwoImages: UIMessage[] = [
      {
        id: 'm2',
        role: 'user',
        parts: [
          { type: 'text', text: '今天吃了番茄炒蛋' },
          { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,/9j/4AAQ' },
          { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,/9j/4AAQ' },
        ],
      },
    ]
    expect(estimateAgentInputTokens(withTwoImages) - estimateAgentInputTokens(textOnly)).toBe(3200)
  })

  it('withImageFallbackPrompt 在用户仅发送照片未敲字时自动补齐识图引导语，图文同发则原样保留', () => {
    const imageOnly: UIMessage[] = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,/9j/4AAQ' }],
      },
    ]
    const converted = withImageFallbackPrompt(imageOnly)
    expect(converted[0]?.parts).toHaveLength(2)
    expect(converted[0]?.parts[1]).toMatchObject({ type: 'text' })

    const imageWithText: UIMessage[] = [
      {
        id: 'm2',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,/9j/4AAQ' },
          { type: 'text', text: '这是我的晚餐' },
        ],
      },
    ]
    expect(withImageFallbackPrompt(imageWithText)[0]?.parts).toEqual(imageWithText[0]?.parts)
  })

  it('filterEmptyAssistantMessages 过滤失败残留的空助手消息，保留用户消息与有效回复', () => {
    const messages = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: '补记昨天晚餐' }] },
      { id: 'a1', role: 'assistant', parts: [] },
      { id: 'a2', role: 'assistant', parts: [{ type: 'text', text: '已整理好' }] },
    ]
    expect(filterEmptyAssistantMessages(messages).map((m) => m.id)).toEqual(['u1', 'a2'])
  })

  it('历史消息含未完成 tool-call（input-available）时，ignoreIncompleteToolCalls=true 不会抛 MissingToolResultsError', async () => {
    const poisonedHistory = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: '补记昨天的午晚餐' }] },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          {
            type: 'tool-draftCheckin',
            toolCallId: 'call_00_LX999oeWzmRKIWQiUw6a3550',
            state: 'input-available',
            input: { goalId: 'g1' },
          },
          {
            type: 'tool-draftCheckin',
            toolCallId: 'call_01_uN3BKdE6zsqYTTU8CVCx4601',
            state: 'output-error',
            input: '{"goalId":"g1"',
            errorText: '团团刚刚走神了一下，点重试再叫我一次吧',
          },
        ],
      },
      { id: 'u2', role: 'user', parts: [{ type: 'text', text: '再试一次' }] },
    ] as unknown as UIMessage[]

    const converted = await convertToModelMessages(poisonedHistory, {
      ignoreIncompleteToolCalls: true,
    })
    expect(converted.length).toBeGreaterThanOrEqual(2)
    // 未完成的 call_00 已被过滤掉，不会留下悬空 tool-call
    const serialized = JSON.stringify(converted)
    expect(serialized).not.toContain('call_00_LX999oeWzmRKIWQiUw6a3550')
  })
})
