import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('按顺序拼接字符串', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('跳过 false、null、undefined 和空串', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('不合并 Tailwind 冲突类', () => {
    expect(cn('text-body', 'text-muted')).toBe('text-body text-muted')
  })
})
