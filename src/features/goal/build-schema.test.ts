import { describe, expect, it } from 'vitest'
import { buildSchema } from './build-schema'
import { FieldDefsSchema, type FieldDefInput } from './schemas'

const defs = (input: FieldDefInput[]) => FieldDefsSchema.parse(input)

describe('buildSchema', () => {
  it('数字字段校验最小值、最大值和整数', () => {
    const s = buildSchema(
      defs([
        {
          key: 'pages',
          label: '页数',
          type: 'number',
          min: 1,
          max: 100,
          integer: true,
          required: true,
        },
      ]),
    )
    expect(s.safeParse({ pages: 10 }).success).toBe(true)
    expect(s.safeParse({ pages: 0 }).success).toBe(false)
    expect(s.safeParse({ pages: 101 }).success).toBe(false)
    expect(s.safeParse({ pages: 1.5 }).success).toBe(false)
    expect(s.safeParse({ pages: '10' }).success).toBe(false)
  })

  it('非整数数字字段允许小数', () => {
    const s = buildSchema(defs([{ key: 'km', label: '公里', type: 'number', unit: 'km' }]))
    expect(s.safeParse({ km: 3.2 }).success).toBe(true)
  })

  it('必填字段缺失时报错，非必填字段可以省略', () => {
    const s = buildSchema(
      defs([
        { key: 'a', label: '甲', type: 'boolean', required: true },
        { key: 'b', label: '乙', type: 'boolean' },
      ]),
    )
    expect(s.safeParse({ a: true }).success).toBe(true)
    expect(s.safeParse({ b: true }).success).toBe(false)
  })

  it('必填文本不能是空白，且受最大长度限制', () => {
    const s = buildSchema(
      defs([{ key: 'what', label: '内容', type: 'text', maxLength: 5, required: true }]),
    )
    expect(s.safeParse({ what: '  ' }).success).toBe(false)
    expect(s.safeParse({ what: '读书' }).success).toBe(true)
    expect(s.safeParse({ what: '一二三四五六' }).success).toBe(false)
  })

  it('文本会去掉首尾空白', () => {
    const s = buildSchema(defs([{ key: 'what', label: '内容', type: 'text' }]))
    expect(s.parse({ what: '  读书 ' })).toEqual({ what: '读书' })
  })

  it('单选只接受定义里的选项', () => {
    const s = buildSchema(
      defs([
        {
          key: 'mood',
          label: '状态',
          type: 'single-select',
          options: ['好', '一般'],
          required: true,
        },
      ]),
    )
    expect(s.safeParse({ mood: '好' }).success).toBe(true)
    expect(s.safeParse({ mood: '差' }).success).toBe(false)
  })

  it('多选不接受未知选项和重复选项；必填时至少选一项', () => {
    const s = buildSchema(
      defs([
        {
          key: 'tags',
          label: '标签',
          type: 'multi-select',
          options: ['甲', '乙', '丙'],
          required: true,
        },
      ]),
    )
    expect(s.safeParse({ tags: ['甲', '丙'] }).success).toBe(true)
    expect(s.safeParse({ tags: ['丁'] }).success).toBe(false)
    expect(s.safeParse({ tags: ['甲', '甲'] }).success).toBe(false)
    expect(s.safeParse({ tags: [] }).success).toBe(false)
  })

  it('非必填多选允许空数组', () => {
    const s = buildSchema(
      defs([{ key: 'tags', label: '标签', type: 'multi-select', options: ['甲', '乙'] }]),
    )
    expect(s.safeParse({ tags: [] }).success).toBe(true)
  })

  it('时长按整秒，不能为负，不能超过上限', () => {
    const s = buildSchema(defs([{ key: 'd', label: '时长', type: 'duration', maxSeconds: 3600 }]))
    expect(s.safeParse({ d: 1800 }).success).toBe(true)
    expect(s.safeParse({ d: -1 }).success).toBe(false)
    expect(s.safeParse({ d: 3601 }).success).toBe(false)
    expect(s.safeParse({ d: 1.5 }).success).toBe(false)
  })

  it('评分只接受 1–5 的整数', () => {
    const s = buildSchema(defs([{ key: 'r', label: '感觉', type: 'rating', required: true }]))
    expect(s.safeParse({ r: 1 }).success).toBe(true)
    expect(s.safeParse({ r: 5 }).success).toBe(true)
    expect(s.safeParse({ r: 0 }).success).toBe(false)
    expect(s.safeParse({ r: 6 }).success).toBe(false)
  })

  it('拒绝字段定义之外的键', () => {
    const s = buildSchema(defs([{ key: 'a', label: '甲', type: 'boolean' }]))
    expect(s.safeParse({ a: true, extra: 1 }).success).toBe(false)
  })

  it('错误信息用字段名写成中文，并挂在对应字段上', () => {
    const s = buildSchema(
      defs([{ key: 'pages', label: '页数', type: 'number', max: 10, required: true }]),
    )
    const r = s.safeParse({ pages: 11 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['pages'])
      expect(r.error.issues[0]?.message).toBe('页数不能大于 10')
    }
  })
})

describe('FieldDefsSchema', () => {
  it('字段标识不能重复', () => {
    const r = FieldDefsSchema.safeParse([
      { key: 'a', label: '甲', type: 'boolean' },
      { key: 'a', label: '乙', type: 'boolean' },
    ])
    expect(r.success).toBe(false)
  })

  it('最多 10 个字段', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      key: `f${i}`,
      label: `字段${i}`,
      type: 'boolean' as const,
    }))
    expect(FieldDefsSchema.safeParse(many).success).toBe(false)
    expect(FieldDefsSchema.safeParse(many.slice(0, 10)).success).toBe(true)
  })

  it('数字字段的最小值不能大于最大值', () => {
    const r = FieldDefsSchema.safeParse([{ key: 'n', label: '数', type: 'number', min: 5, max: 1 }])
    expect(r.success).toBe(false)
  })

  it('选项至少两个且不能重复', () => {
    expect(
      FieldDefsSchema.safeParse([{ key: 's', label: '选', type: 'single-select', options: ['甲'] }])
        .success,
    ).toBe(false)
    expect(
      FieldDefsSchema.safeParse([
        { key: 's', label: '选', type: 'single-select', options: ['甲', '甲'] },
      ]).success,
    ).toBe(false)
  })
})
