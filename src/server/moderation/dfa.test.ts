import { describe, expect, it } from 'vitest'
import {
  checkContent,
  checkText,
  defaultDfa,
  DfaEngine,
  filterText,
  isNoiseChar,
  normalizeChar,
} from './dfa'

describe('DFA 辅助工具函数', () => {
  it('isNoiseChar: 正确区分字母数字/CJK字符与干扰符号', () => {
    // 正常文字与数字（非干扰）
    expect(isNoiseChar('a')).toBe(false)
    expect(isNoiseChar('Z')).toBe(false)
    expect(isNoiseChar('0')).toBe(false)
    expect(isNoiseChar('9')).toBe(false)
    expect(isNoiseChar('你')).toBe(false)
    expect(isNoiseChar('好')).toBe(false)
    expect(isNoiseChar('傻')).toBe(false)

    // 干扰字符（空格、标点、特殊符号、Emoji）
    expect(isNoiseChar(' ')).toBe(true)
    expect(isNoiseChar('\t')).toBe(true)
    expect(isNoiseChar('*')).toBe(true)
    expect(isNoiseChar('_')).toBe(true)
    expect(isNoiseChar('-')).toBe(true)
    expect(isNoiseChar('.')).toBe(true)
    expect(isNoiseChar('，')).toBe(true)
    expect(isNoiseChar('！')).toBe(true)
    expect(isNoiseChar('😊')).toBe(true)
    expect(isNoiseChar('🌸')).toBe(true)
    expect(isNoiseChar('@')).toBe(true)
    expect(isNoiseChar('#')).toBe(true)
  })

  it('normalizeChar: 正确执行 NFKC 规范化与小写折叠', () => {
    expect(normalizeChar('Ａ')).toBe('a')
    expect(normalizeChar('Ｂ')).toBe('b')
    expect(normalizeChar('１')).toBe('1')
    expect(normalizeChar('F')).toBe('f')
    expect(normalizeChar('草')).toBe('草')
  })
})

describe('DFA 敏感词基础检出能力', () => {
  it('正常干净文本检测放行', () => {
    const res = checkText('今天天气真好，一起去公园晨跑打卡吧！')
    expect(res.flagged).toBe(false)
    expect(res.category).toBeUndefined()
    expect(res.word).toBeUndefined()
  })

  it('命中 abuse（辱骂）分类敏感词', () => {
    const res1 = checkText('你怎么这么傻逼啊')
    expect(res1.flagged).toBe(true)
    expect(res1.category).toBe('abuse')
    expect(res1.word).toBe('傻逼')

    const res2 = checkText('what a fucking disaster')
    expect(res2.flagged).toBe(true)
    expect(res2.category).toBe('abuse')
  })

  it('命中 politics（涉政）分类敏感词', () => {
    const res = checkText('测试内容：关于法轮功的违规表述')
    expect(res.flagged).toBe(true)
    expect(res.category).toBe('politics')
    expect(res.word).toBe('法轮功')
  })

  it('命中 violence（暴恐违禁）分类敏感词', () => {
    const res = checkText('有人在地下黑市交易海洛因和枪支')
    expect(res.flagged).toBe(true)
    expect(res.category).toBe('violence')
  })

  it('命中 ad（广告黑产）分类敏感词', () => {
    const res = checkText('需要办假证请联系我，加我微信')
    expect(res.flagged).toBe(true)
    expect(res.category).toBe('ad')
  })

  it('契约方法 checkContent 返回 clean 与 matchedCategory', () => {
    const cleanRes = checkContent('今天努力完成了 3 个目标！')
    expect(cleanRes).toEqual({ clean: true, matchedCategory: undefined })

    const badRes = checkContent('快来参与兼职刷单轻松日赚上千')
    expect(badRes.clean).toBe(false)
    expect(badRes.matchedCategory).toBe('ad')
  })
})

describe('DFA 变体绕过与干扰字符跳过（Unicode + ≤3 干扰字符跳过）', () => {
  it('全角字母与大小写折叠检测', () => {
    // 全角大写 ＦＵＣＫ
    expect(checkText('This is ＦＵＣＫ test').flagged).toBe(true)
    // 混合大小写 FuCk
    expect(checkText('stop this FuCk right now').flagged).toBe(true)
  })

  it('1 到 3 个干扰符号跳过拦截（空格、标点、下划线、减号、Emoji）', () => {
    // 1 个空格
    expect(checkText('真是个 傻 逼 东西').flagged).toBe(true)
    // 1 个标点
    expect(checkText('真是个傻*逼').flagged).toBe(true)
    // 2 个符号
    expect(checkText('真是个傻*_逼').flagged).toBe(true)
    // 3 个符号
    expect(checkText('真是个傻* _逼').flagged).toBe(true)
    // 3 个 Emoji
    expect(checkText('真是个傻😊🌸⚡逼').flagged).toBe(true)
    // 英文单词多字符间插入干扰
    expect(checkText('f.u.c.k').flagged).toBe(true)
    expect(checkText('f...u...c...k').flagged).toBe(true)
  })

  it('干扰字符超过 3 个则不触发关键词误伤（严格限定 ≤3）', () => {
    // 4 个星号：超过 3 个干扰字符，不应识别为连续敏感词
    expect(checkText('傻****逼').flagged).toBe(false)
    // 4 个空格
    expect(checkText('傻    逼').flagged).toBe(false)
    // 4 个点
    expect(checkText('f....u....c....k').flagged).toBe(false)
  })

  it('非干扰字符（字母或数字）不会被跳过', () => {
    // 中间插入普通数字，不属于干扰符号，不能跳过
    expect(checkText('傻123逼').flagged).toBe(false)
    // 中间插入普通英文字母
    expect(checkText('傻abc逼').flagged).toBe(false)
  })
})

describe('DFA 文本掩码脱敏（filterText）', () => {
  it('单字符默认掩码 * 进行等长替换', () => {
    expect(filterText('你是傻逼吗')).toBe('你是**吗')
    expect(filterText('真是傻*逼')).toBe('真是***')
    expect(filterText('正常日常打卡')).toBe('正常日常打卡')
  })

  it('自定义单字符与多字符掩码替换', () => {
    // 自定义单字符 #
    expect(filterText('你是傻逼吗', '#')).toBe('你是##吗')
    // 自定义多字符整体替换
    expect(filterText('你是傻逼吗', '[已过滤]')).toBe('你是[已过滤]吗')
    expect(filterText('你傻*逼且他妈的', '[屏蔽]')).toBe('你[屏蔽]且[屏蔽]')
  })

  it('空串与边界输入健壮性', () => {
    expect(filterText('')).toBe('')
    expect(checkText('')).toEqual({ flagged: false })
  })
})

describe('DfaEngine 实例扩展能力', () => {
  it('defaultDfa 全局单例正常运行', () => {
    expect(defaultDfa).toBeInstanceOf(DfaEngine)
    expect(defaultDfa.checkText('普通日常用语').flagged).toBe(false)
  })

  it('支持实例化独立引擎并动态添加自定义词库', () => {
    const engine = new DfaEngine({
      custom: ['测试敏感词A', '测试敏感词B'],
    })

    expect(engine.checkText('这是普通话').flagged).toBe(false)
    expect(engine.checkText('这里有测试敏感词A出现').flagged).toBe(true)

    // 动态添加
    engine.addWord('新违规词C', 'custom')
    expect(engine.checkText('包含新违规词C的内容').flagged).toBe(true)
  })
})
