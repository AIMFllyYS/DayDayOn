import { describe, expect, it } from 'vitest'
import { entryRedirect, isPublicPath } from './entry-redirect'

describe('isPublicPath', () => {
  it('落地页、登录、隐私说明和它们的子路径是公开的', () => {
    expect(isPublicPath('/welcome')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/privacy')).toBe(true)
    expect(isPublicPath('/dev/playbook')).toBe(true)
  })

  it('只按完整路径段匹配，/welcomes 不算公开', () => {
    expect(isPublicPath('/welcomes')).toBe(false)
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/me')).toBe(false)
  })
})

describe('entryRedirect', () => {
  it('未登录打开根路径时去落地页', () => {
    expect(entryRedirect('/', '', false)).toBe('/welcome')
    expect(entryRedirect('/', '?source=pwa', false)).toBe('/welcome')
  })

  it('已登录打开根路径时放行（主页）', () => {
    expect(entryRedirect('/', '', true)).toBeNull()
  })

  it('已登录也能看落地页', () => {
    expect(entryRedirect('/welcome', '', true)).toBeNull()
  })

  it('未登录打开公开页面时放行', () => {
    expect(entryRedirect('/welcome', '', false)).toBeNull()
    expect(entryRedirect('/login', '?next=%2Fme', false)).toBeNull()
  })

  it('未登录打开深链接时去登录页，并带上原地址', () => {
    expect(entryRedirect('/goals', '', false)).toBe('/login?next=%2Fgoals')
    expect(entryRedirect('/rank', '?range=month', false)).toBe(
      '/login?next=%2Frank%3Frange%3Dmonth',
    )
  })
})
