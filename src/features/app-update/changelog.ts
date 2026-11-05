import { compareVersions, isNewer } from '@/lib/semver'
import type { AppManifest, AppUpdate, AppUpdateKind } from './schemas'

/*
 * 检查更新的纯规则：从更新日志里截出比当前版本新的几节、判断怎么更新。不读文件，带单测。
 */

export interface ChangelogSection {
  version: string
  /** 整节 Markdown，含 `## v…` 标题 */
  markdown: string
}

const HEADING = /^##\s+v(\d+\.\d+\.\d+)\b.*$/

/** 按 `## v<版本>` 切节；文件开头的说明（第一个版本标题之前）丢掉 */
export function parseChangelog(md: string): ChangelogSection[] {
  const sections: ChangelogSection[] = []
  let current: { version: string; lines: string[] } | null = null
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const m = HEADING.exec(line)
    if (m?.[1]) {
      if (current)
        sections.push({ version: current.version, markdown: current.lines.join('\n').trim() })
      current = { version: m[1], lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current)
    sections.push({ version: current.version, markdown: current.lines.join('\n').trim() })
  return sections
}

/** 比 current 新、且不超过 latest 的几节，新的在前；最多 maxSections 节 */
export function notesSince(
  sections: readonly ChangelogSection[],
  current: string,
  latest: string,
  maxSections = 5,
): string {
  return sections
    .filter((s) => isNewer(s.version, current) && compareVersions(s.version, latest) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .slice(0, maxSections)
    .map((s) => s.markdown)
    .join('\n\n')
}

export interface DecideInput {
  manifest: AppManifest
  sections: readonly ChangelogSection[]
  web: string
  shell?: string
  /** 安装包的两个下载地址 */
  urls: { url: string; fallbackUrl: string }
}

/**
 * 先看壳：在 APK 壳里且壳版本低于清单里的安装包版本 → install（低于 minVersion 时 required）。
 * 再看网页：页面构建版本低于服务器最新版本 → reload。都不是 → none。
 */
export function decideUpdate(input: DecideInput): AppUpdate {
  const { manifest, sections, web, shell, urls } = input
  let kind: AppUpdateKind = 'none'
  let required = false
  if (shell !== undefined && isNewer(manifest.android.version, shell)) {
    kind = 'install'
    required = compareVersions(shell, manifest.android.minVersion) < 0
  } else if (isNewer(manifest.latest, web)) {
    kind = 'reload'
  }
  return {
    kind,
    latest: manifest.latest,
    publishedAt: manifest.publishedAt,
    required,
    notes: kind === 'none' ? '' : notesSince(sections, web, manifest.latest),
    android: {
      version: manifest.android.version,
      url: urls.url,
      fallbackUrl: urls.fallbackUrl,
      sha256: manifest.android.sha256,
      size: manifest.android.size,
    },
  }
}
