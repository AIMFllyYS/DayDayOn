import { describe, expect, it } from 'vitest'
import { decideUpdate, notesSince, parseChangelog } from './changelog'
import type { AppManifest } from './schemas'

const MD = `# DayDayOn 更新日志

开头的说明不算任何一节。

## v0.1.3 · 2026-11-06

- 检查更新

## v0.1.2 · 2026-11-06

- 打卡页整页化

## v0.1.1 · 2026-11-05

- 裁判上线
`

const manifest: AppManifest = {
  latest: '0.1.3',
  publishedAt: '2026-11-06',
  android: {
    version: '0.1.0',
    minVersion: '0.1.0',
    file: 'DayDayOn.apk',
    sha256: 'a'.repeat(64),
    size: 65564,
    sourceTag: 'v0.1.0',
  },
}
const urls = {
  url: '/download/DayDayOn.apk',
  fallbackUrl: 'https://github.com/x/releases/download/v0.1.0/DayDayOn.apk',
}
const sections = parseChangelog(MD)

describe('parseChangelog / notesSince', () => {
  it('按 ## v<版本> 切节，丢掉开头说明', () => {
    expect(sections.map((s) => s.version)).toEqual(['0.1.3', '0.1.2', '0.1.1'])
    expect(sections[0]?.markdown).toBe('## v0.1.3 · 2026-11-06\n\n- 检查更新')
  })

  it('只要比当前新、且不超过最新的几节，新的在前', () => {
    const notes = notesSince(sections, '0.1.1', '0.1.3')
    expect(notes.indexOf('v0.1.3')).toBeLessThan(notes.indexOf('v0.1.2'))
    expect(notes).not.toContain('v0.1.1')
    // 清单还没发到 0.1.3 时（日志先写了），不提前展示
    expect(notesSince(sections, '0.1.1', '0.1.2')).not.toContain('v0.1.3')
  })

  it('Windows 换行也能切', () => {
    expect(parseChangelog(MD.replace(/\n/g, '\r\n')).length).toBe(3)
  })
})

describe('decideUpdate', () => {
  it('网页已是最新、浏览器里：none，不带更新日志', () => {
    const r = decideUpdate({ manifest, sections, web: '0.1.3', urls })
    expect(r.kind).toBe('none')
    expect(r.notes).toBe('')
  })

  it('服务器更新了、页面还是旧构建：reload，带新几节', () => {
    const r = decideUpdate({ manifest, sections, web: '0.1.2', urls })
    expect(r.kind).toBe('reload')
    expect(r.notes).toContain('检查更新')
    expect(r.notes).not.toContain('打卡页整页化')
  })

  it('网页壳阶段：壳版本等于清单的安装包版本，不要求重装，只看网页', () => {
    expect(decideUpdate({ manifest, sections, web: '0.1.3', shell: '0.1.0', urls }).kind).toBe(
      'none',
    )
    expect(decideUpdate({ manifest, sections, web: '0.1.2', shell: '0.1.0', urls }).kind).toBe(
      'reload',
    )
  })

  it('换了新安装包：壳低于安装包版本 → install；低于最低版本 → required', () => {
    const next = {
      ...manifest,
      android: { ...manifest.android, version: '0.2.0', minVersion: '0.1.5' },
    }
    const r = decideUpdate({ manifest: next, sections, web: '0.1.3', shell: '0.1.0', urls })
    expect(r.kind).toBe('install')
    expect(r.required).toBe(true)
    expect(r.android.url).toBe('/download/DayDayOn.apk')
    const soft = decideUpdate({
      manifest: { ...next, android: { ...next.android, minVersion: '0.1.0' } },
      sections,
      web: '0.1.3',
      shell: '0.1.0',
      urls,
    })
    expect(soft.required).toBe(false)
  })
})
