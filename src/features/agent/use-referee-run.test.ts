import type { UIMessage } from 'ai'
import { describe, expect, it } from 'vitest'
import type { Verdict } from '@/features/referee/schemas'
import { findVerdict, readRun } from './use-referee-run'

/*
 * 打卡页「让 Agent 分析」读结论的口径：分析是会话的第一轮，只认第一条助手消息里的 submitVerdict。
 */

const VERDICT: Verdict = {
  version: 1,
  isValid: false,
  score: null,
  scoreMax: null,
  detail: '时长够了，但要点内容不够实质',
  checks: [],
  metrics: {},
  facts: null,
  citations: [],
  advice: [],
  refereeRunId: 'run-1',
  offline: false,
}

const user = (id: string, text = '帮我分析这条打卡'): UIMessage => ({
  id,
  role: 'user',
  parts: [{ type: 'text', text }],
})

function assistant(id: string, withVerdict: boolean, text = ''): UIMessage {
  const parts: unknown[] = [{ type: 'step-start' }]
  if (withVerdict) {
    parts.push({
      type: 'tool-submitVerdict',
      toolCallId: 'c1',
      state: 'output-available',
      input: {},
      output: { verdict: VERDICT },
    })
  }
  if (text) parts.push({ type: 'text', text, state: 'done' })
  return { id, role: 'assistant', parts } as UIMessage
}

describe('findVerdict', () => {
  it('只认 output-available 的 submitVerdict', () => {
    expect(findVerdict(assistant('a', true).parts)).toEqual(VERDICT)
    expect(findVerdict(assistant('a', false, '你好').parts)).toBeNull()
    expect(
      findVerdict([{ type: 'tool-submitVerdict', state: 'input-available', input: {} }]),
    ).toBeNull()
  })
})

describe('readRun', () => {
  it('新会话还没发出去：分析中', () => {
    expect(readRun([], 'ready', undefined).status).toBe('running')
  })

  it('只有用户那句话、请求在途：分析中', () => {
    expect(readRun([user('u1')], 'submitted', undefined).status).toBe('running')
  })

  it('第一轮流式中、还没交卷：分析中，turn 是流式', () => {
    const run = readRun([user('u1'), assistant('a1', false)], 'streaming', undefined)
    expect(run.status).toBe('running')
    expect(run.turn?.status).toBe('streaming')
  })

  it('交卷：完成，带结论', () => {
    const run = readRun([user('u1'), assistant('a1', true)], 'ready', undefined)
    expect(run.status).toBe('done')
    expect(run.verdict?.detail).toBe(VERDICT.detail)
    expect(run.errorText).toBeNull()
  })

  it('跑完了没交卷：失败，交给规则判定', () => {
    const run = readRun([user('u1'), assistant('a1', false, '嗯')], 'ready', undefined)
    expect(run.status).toBe('failed')
    expect(run.errorText).toContain('按达标规则判定')
  })

  it('请求出错：失败，提示用接口的错误', () => {
    const run = readRun([user('u1')], 'error', new Error('额度不足'))
    expect(run.status).toBe('failed')
    expect(run.errorText).toBeTruthy()
  })

  it('会话里接着聊了：结论仍取第一轮，后面的追问不影响', () => {
    const msgs = [
      user('u1'),
      assistant('a1', true),
      user('u2', '为什么没达标'),
      assistant('a2', false),
    ]
    expect(readRun(msgs, 'streaming', undefined).status).toBe('done')
    expect(readRun(msgs, 'ready', undefined).verdict?.refereeRunId).toBe('run-1')
  })
})
