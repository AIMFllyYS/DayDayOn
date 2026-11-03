import { describe, expect, it } from 'vitest'
import Icon, { size as iconSize, contentType as iconContentType } from '../icon'
import AppleIcon, { size as appleSize, contentType as appleContentType } from '../apple-icon'
import { generateStaticParams, GET } from './[name]/route'

describe('图标路由与标签页图标生成实机验证', () => {
  it('标签页图标 (/icon) 导出正确的元信息与尺寸', () => {
    expect(iconSize).toEqual({ width: 64, height: 64 })
    expect(iconContentType).toBe('image/png')
  })

  it('标签页图标 (/icon) 生成合法的 ImageResponse', async () => {
    const res = Icon()
    expect(res).toBeDefined()
    expect(res.headers.get('content-type')).toContain('image/png')
    const arrayBuffer = await res.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    expect(bytes.length).toBeGreaterThan(100)
    // 校验 PNG 魔数: 89 50 4E 47 (0x89 'P' 'N' 'G')
    expect(bytes[0]).toBe(0x89)
    expect(bytes[1]).toBe(0x50)
    expect(bytes[2]).toBe(0x4e)
    expect(bytes[3]).toBe(0x47)
  })

  it('苹果桌面图标 (/apple-icon) 生成合法的 180x180 PNG', async () => {
    expect(appleSize).toEqual({ width: 180, height: 180 })
    expect(appleContentType).toBe('image/png')
    const res = AppleIcon()
    expect(res).toBeDefined()
    expect(res.headers.get('content-type')).toContain('image/png')
    const arrayBuffer = await res.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    expect(bytes.length).toBeGreaterThan(200)
    expect(bytes[0]).toBe(0x89)
    expect(bytes[1]).toBe(0x50)
    expect(bytes[2]).toBe(0x4e)
    expect(bytes[3]).toBe(0x47)
  })

  it('PWA / APK 图标路由 (/icons/[name]) 全部支持且能生成对应格式', async () => {
    const paramsList = generateStaticParams()
    const names = paramsList.map((p) => p.name)
    expect(names).toContain('icon-192.png')
    expect(names).toContain('icon-512.png')
    expect(names).toContain('maskable-192.png')
    expect(names).toContain('maskable-512.png')
    expect(names).toContain('android-foreground-432.png')
    expect(names).toContain('logo-full.svg')
    expect(names).toContain('logo-mark.svg')

    // 验证 SVG 路由输出
    const req = new Request('http://localhost:23329/icons/logo-mark.svg')
    const svgRes = await GET(req, {
      params: Promise.resolve({ name: 'logo-mark.svg' }),
    })
    expect(svgRes.status).toBe(200)
    expect(svgRes.headers.get('content-type')).toContain('image/svg+xml')
    const svgText = await svgRes.text()
    expect(svgText).toContain('<svg')
    expect(svgText).toContain('viewBox="0 0 512 512"')

    // 验证 PNG 路由输出 (icon-192.png)
    const pngReq = new Request('http://localhost:23329/icons/icon-192.png')
    const pngRes = await GET(pngReq, {
      params: Promise.resolve({ name: 'icon-192.png' }),
    })
    expect(pngRes.status).toBe(200)
    expect(pngRes.headers.get('content-type')).toContain('image/png')
    const pngBuffer = await pngRes.arrayBuffer()
    const pngBytes = new Uint8Array(pngBuffer)
    expect(pngBytes[0]).toBe(0x89)
    expect(pngBytes[1]).toBe(0x50)
    expect(pngBytes[2]).toBe(0x4e)
    expect(pngBytes[3]).toBe(0x47)
  })
})
