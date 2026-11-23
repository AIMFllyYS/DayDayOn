import { InvalidToolInputError, JSONParseError, NoSuchToolError } from 'ai'
import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import {
  CitationSchema,
  DietFactsSchema,
  ExerciseFactsSchema,
  SleepFactsSchema,
  StudyFactsSchema,
} from '@/features/referee/schemas'
import { createRepairToolCall } from './repair-tool-call'

const submitSchema = <T extends z.ZodType>(facts: T) =>
  z.object({
    facts,
    citations: z.array(CitationSchema).max(5).default([]),
    advice: z.array(z.string().trim().min(1).max(80)).max(2).default([]),
  })

function makeInvalidInputError(toolName: string, toolInput: string) {
  return new InvalidToolInputError({
    toolName,
    toolInput,
    cause: new JSONParseError({ text: toolInput, cause: new SyntaxError('invalid json') }),
  })
}

async function runRepair(toolName: string, rawInput: string) {
  const repair = createRepairToolCall()
  return repair({
    instructions: undefined,
    system: undefined,
    messages: [],
    tools: {},
    inputSchema: async () => ({ type: 'object' }),
    toolCall: {
      type: 'tool-call',
      toolCallId: 'call_test_1',
      toolName,
      input: rawInput,
    },
    error: makeInvalidInputError(toolName, rawInput),
  })
}

describe('createRepairToolCall: 覆盖生产真实 DeepSeek Flash 畸形输出', () => {
  it('修复 submitVerdict 在 "advice" 键名处截断的学习/运动/睡眠 JSON', async () => {
    const studyRaw =
      '{"facts": {"module": "study", "substantive": true, "subject": "物理 · 光学", "summary": "本次学习30分钟物理光学，涉及折射、偏振与衍射三个知识点。", "keyPoints": ["光的折射", "偏振", "衍射"], "todayMinutesBefore": 0, "skipApproved": null, "skipComment": null}, "advice"'
    const studyRepaired = await runRepair('submitVerdict', studyRaw)
    expect(studyRepaired).not.toBeNull()
    const studyParsed = submitSchema(StudyFactsSchema).safeParse(JSON.parse(studyRepaired!.input))
    expect(studyParsed.success).toBe(true)
    if (studyParsed.success) {
      expect(studyParsed.data.facts.subject).toBe('物理 · 光学')
      expect(studyParsed.data.advice).toEqual([])
    }

    const exerciseRaw =
      '{"facts": {"module": "exercise", "items": [{"name": "慢跑", "calc": "distance", "minutes": 20, "km": 2, "sets": null, "met": 8, "kcal": 260, "fromDevice": false}], "weightKg": 97.5}, "advice"'
    const exerciseRepaired = await runRepair('submitVerdict', exerciseRaw)
    expect(exerciseRepaired).not.toBeNull()
    expect(
      submitSchema(ExerciseFactsSchema).safeParse(JSON.parse(exerciseRepaired!.input)).success,
    ).toBe(true)

    const sleepRaw =
      '{"facts": {"module": "sleep", "regularityMinutes": 27, "recentNights": 3}, "advice"'
    const sleepRepaired = await runRepair('submitVerdict', sleepRaw)
    expect(sleepRepaired).not.toBeNull()
    expect(submitSchema(SleepFactsSchema).safeParse(JSON.parse(sleepRepaired!.input)).success).toBe(
      true,
    )
  })

  it('修复末尾多出一个闭合花括号的饮食 submitVerdict JSON', async () => {
    const raw =
      '{"facts": {"module": "diet", "dishes": [{"name": "嫩香鸡排大口饭团", "portion": "175克", "kcal": 492, "proteinG": 12.5, "carbG": 74, "fatG": 15.5, "fiberG": 1.2, "sodiumMg": 700, "gi": 83, "junk": false, "sweet": false, "isFasting": false, "carbQuality": "refined", "fatQuality": "normal", "cooking": "other", "source": "table"}]}, "citations": [{"title": "7-11 饭团营养成分", "url": "https://example.com/1"}], "advice": ["搭配一份绿叶菜更好"]}}'
    const repaired = await runRepair('submitVerdict', raw)
    expect(repaired).not.toBeNull()
    const parsed = submitSchema(DietFactsSchema).safeParse(JSON.parse(repaired!.input))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.advice).toEqual(['搭配一份绿叶菜更好'])
      expect(parsed.data.citations).toHaveLength(1)
    }
  })

  it('修复 advice 错填成 citations 对象数组，并自动迁移到 citations', async () => {
    const raw = JSON.stringify({
      facts: {
        module: 'exercise',
        items: [
          {
            name: '慢跑',
            calc: 'distance',
            minutes: 30,
            km: 2,
            sets: null,
            met: 8,
            kcal: 300.4,
            fromDevice: false,
          },
        ],
        weightKg: 75,
        skipApproved: null,
      },
      advice: [{ title: 'Compendium of Physical Activities', url: 'https://pacompendium.com/' }],
    })
    const repaired = await runRepair('submitVerdict', raw)
    expect(repaired).not.toBeNull()
    const parsed = submitSchema(ExerciseFactsSchema).safeParse(JSON.parse(repaired!.input))
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.advice).toEqual([])
      expect(parsed.data.citations).toEqual([
        { title: 'Compendium of Physical Activities', url: 'https://pacompendium.com/' },
      ])
      expect(parsed.data.facts.items[0]?.kcal).toBe(300)
    }
  })

  it('对未知工具名错误（NoSuchToolError）返回 null 不强行修复', async () => {
    const repair = createRepairToolCall()
    const result = await repair({
      instructions: undefined,
      system: undefined,
      messages: [],
      tools: {},
      inputSchema: async () => ({ type: 'object' }),
      toolCall: {
        type: 'tool-call',
        toolCallId: 'call_unknown',
        toolName: 'unknownTool',
        input: '{}',
      },
      error: new NoSuchToolError({ toolName: 'unknownTool', availableTools: ['submitVerdict'] }),
    })
    expect(result).toBeNull()
  })
})
