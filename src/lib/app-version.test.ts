import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppManifestSchema } from '@/features/app-update/schemas'
import { parseChangelog } from '@/features/app-update/changelog'
import { APP_VERSION } from './app-version'
import { compareVersions, isNewer, parseVersion } from './semver'

/* 发版时三处版本号必须一致：package.json、APP_VERSION、download/manifest.json（download/README.md） */

const root = process.cwd()
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }
const manifest = AppManifestSchema.parse(
  JSON.parse(readFileSync(path.join(root, 'download', 'manifest.json'), 'utf8')),
)
const changelog = parseChangelog(readFileSync(path.join(root, 'download', 'CHANGELOG.md'), 'utf8'))

describe('版本号一致', () => {
  it('package.json = APP_VERSION = manifest.latest', () => {
    expect(APP_VERSION).toBe(pkg.version)
    expect(manifest.latest).toBe(pkg.version)
  })

  it('更新日志最上面一节就是最新版本', () => {
    expect(changelog[0]?.version).toBe(manifest.latest)
  })

  it('安卓壳版本不高于网页版本，最低版本不高于壳版本', () => {
    expect(compareVersions(manifest.android.version, manifest.latest)).toBeLessThanOrEqual(0)
    expect(
      compareVersions(manifest.android.minVersion, manifest.android.version),
    ).toBeLessThanOrEqual(0)
  })
})

describe('semver', () => {
  it('解析 v 前缀与预发布后缀，非法返回 null', () => {
    expect(parseVersion('v0.1.2')).toEqual([0, 1, 2])
    expect(parseVersion('1.10.0-beta+3')).toEqual([1, 10, 0])
    expect(parseVersion('1.2')).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
  })

  it('按数字逐段比较（0.1.10 > 0.1.9）', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBeGreaterThan(0)
    expect(compareVersions('0.2.0', '0.10.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
  })

  it('isNewer：无法解析的当前版本当作最低', () => {
    expect(isNewer('0.1.3', '0.1.2')).toBe(true)
    expect(isNewer('0.1.3', '0.1.3')).toBe(false)
    expect(isNewer('0.1.3', 'garbage')).toBe(true)
    expect(isNewer('garbage', '0.1.0')).toBe(false)
  })
})
