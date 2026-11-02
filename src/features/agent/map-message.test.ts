import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import { formatChatError, isStreamingTurn, toTurnParts, toTurnView } from './map-message'
import { hostOf, splitSteps, summarizeTurn, turnSources, turnText } from './turn'

describe('map-message: toTurnParts & toTurnView', () => {
  it('将 UIMessage.parts 映射为 AgentPart 并提取工具摘要', () => {
    const rawParts = [
      { type: 'step-start' },
      { type: 'reasoning', id: 'r1', text: '先查一下目标', state: 'done' },
      {
        type: 'tool-draftCheckin',
        toolCallId: 'tc1',
        state: 'output-available',
        input: {
          goalId: 'g1',
          data: { module: 'exercise', category: '跑步', durationMinutes: 30 },
        },
        output: { kind: 'checkin' },
      },
      {
        type: 'tool-getFriendStatus',
        toolCallId: 'tc2',
        state: 'output-available',
        input: { friendIdOrNickname: '阿柚' },
        output: { found: true },
      },
      {
        type: 'source-url',
        sourceId: 's1',
        url: 'https://www.boohee.com/food/tomato',
        title: '番茄炒蛋热量',
      },
      { type: 'text', id: 't1', text: '已经帮你整理好草稿啦～', state: 'done' },
      { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,xxx' },
    ] as unknown as UIMessage['parts']

    const parts = toTurnParts(rawParts)
    expect(parts).toEqual([
      { type: 'step-start' },
      { type: 'reasoning', id: 'r1', text: '先查一下目标', state: 'done' },
      {
        type: 'tool',
        id: 'tc1',
        toolName: 'draftCheckin',
        state: 'output-available',
        summary: '跑步',
        input: {
          goalId: 'g1',
          data: { module: 'exercise', category: '跑步', durationMinutes: 30 },
        },
        output: { kind: 'checkin' },
        errorText: undefined,
      },
      {
        type: 'tool',
        id: 'tc2',
        toolName: 'getFriendStatus',
        state: 'output-available',
        summary: '阿柚',
        input: { friendIdOrNickname: '阿柚' },
        output: { found: true },
        errorText: undefined,
      },
      {
        type: 'source',
        id: 's1',
        url: 'https://www.boohee.com/food/tomato',
        title: '番茄炒蛋热量',
      },
      { type: 'text', id: 't1', text: '已经帮你整理好草稿啦～', state: 'done' },
    ])
  })

  it('status=error 时透传 errorText，非 error 时忽略 errorText', () => {
    const msg = {
      id: 'm1',
      role: 'assistant',
      parts: [{ type: 'text', id: 't1', text: '半截回复', state: 'done' }],
    } as unknown as UIMessage

    const errTurn = toTurnView(msg, 'error', '本周的 AI 额度用完了，可以手动记录，或兑换额度')
    expect(errTurn.status).toBe('error')
    expect(errTurn.errorText).toBe('本周的 AI 额度用完了，可以手动记录，或兑换额度')

    const doneTurn = toTurnView(msg, 'done', '不应出现的错误文案')
    expect(doneTurn.errorText).toBeUndefined()
  })

  it('isStreamingTurn 正确识别流式中的文本或工具调用', () => {
    expect(
      isStreamingTurn([{ type: 'text', text: '你好', state: 'streaming' }] as UIMessage['parts']),
    ).toBe(true)
    expect(
      isStreamingTurn([
        { type: 'tool-listGoals', state: 'input-available', toolCallId: '1' },
      ] as unknown as UIMessage['parts']),
    ).toBe(true)
    expect(
      isStreamingTurn([{ type: 'text', text: '你好', state: 'done' }] as UIMessage['parts']),
    ).toBe(false)
  })
})

describe('formatChatError', () => {
  it('解析服务端 JSON 错误体并映射为中文友好文案', () => {
    const quotaErr = new Error(JSON.stringify({ code: 'QUOTA_INSUFFICIENT', detail: 'no quota' }))
    expect(formatChatError(quotaErr)).toBe('本周的 AI 额度用完了，可以手动记录，或兑换额度')

    const rateErr = new Error(
      JSON.stringify({ code: 'RATE_LIMITED', retryAfterSeconds: 120, detail: 'rate limit' }),
    )
    expect(formatChatError(rateErr)).toBe('太频繁了，2 分钟后再试试')

    const pausedErr = new Error(JSON.stringify({ code: 'AI_PAUSED', detail: 'paused' }))
    expect(formatChatError(pausedErr)).toBe('AI 识别暂时休息了，先手动记录吧')
  })

  it('英文底层异常回退到兜底文案，中文错误文案直接保留', () => {
    expect(formatChatError(new Error('Failed to fetch'))).toBe('出了点小状况，稍后再试试')
    expect(formatChatError(new Error('团团刚刚走神了一下'))).toBe('团团刚刚走神了一下')
    expect(formatChatError(undefined)).toBe('出了点小状况，稍后再试试')
  })
})

describe('turn.ts: 回合分步、摘要与来源去重', () => {
  it('按 step-start 切分步骤，去重域名来源并生成活动条摘要', () => {
    const turn = {
      id: 'turn-1',
      status: 'done' as const,
      durationMs: 2400,
      parts: [
        { type: 'step-start' as const },
        { type: 'reasoning' as const, id: 'r1', text: '思考第一步', state: 'done' as const },
        {
          type: 'tool' as const,
          id: 'tc1',
          toolName: 'listGoals',
          state: 'output-available' as const,
        },
        { type: 'step-start' as const },
        {
          type: 'tool' as const,
          id: 'tc2',
          toolName: 'webSearch',
          state: 'output-available' as const,
          summary: '跑步 MET',
        },
        {
          type: 'source' as const,
          id: 's1',
          url: 'https://www.example.com/a',
          title: 'A',
        },
        {
          type: 'source' as const,
          id: 's2',
          url: 'https://www.example.com/a',
          title: 'A 重复',
        },
        { type: 'text' as const, id: 't1', text: '完成啦', state: 'done' as const },
      ],
    }

    const steps = splitSteps(turn.parts)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.tools).toHaveLength(1)
    expect(steps[1]?.tools).toHaveLength(1)

    const summary = summarizeTurn(turn)
    expect(summary.running).toBe(0)
    expect(summary.tools).toHaveLength(2)
    expect(summary.steps).toBe(2)
    expect(summary.activity).toBeNull()

    expect(turnText(turn)).toEqual({ text: '完成啦', streaming: false })
    expect(turnSources(turn)).toHaveLength(1)
    expect(hostOf('https://www.example.com/a')).toBe('example.com')
  })
})
