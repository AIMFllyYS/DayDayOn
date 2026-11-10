import 'server-only'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  decideUpdate,
  parseChangelog,
  type ChangelogSection,
} from '@/features/app-update/changelog'
import { AppManifestSchema, type AppManifest, type AppUpdate } from '@/features/app-update/schemas'

/*
 * 检查更新与自托管安装包检测（download/README.md）：
 * - 优先读取服务器独立持久化目录 `/www/wwwroot/daydayon/releases/`（或环境变量 DAYDAYON_RELEASES_DIR），
 *   不存在时回退至应用目录下的 `download/`；
 * - 基于文件 mtimeMs 动态刷新缓存，并在磁盘存在真实 APK 文件时实时校准其字节大小与 SHA-256，
 *   支持直接向服务器独立目录放入新 APK / 清单即刻生效（无需重启 PM2 或依赖 GitHub Release）；
 * - 全链路只返回自有服务器下载地址 `/download/<文件名>`，彻底移除 GitHub 下载外链。
 */

const PERSISTENT_RELEASES_DIR =
  process.env.DAYDAYON_RELEASES_DIR || '/www/wwwroot/daydayon/releases'
const FALLBACK_DOWNLOAD_DIR = path.join(process.cwd(), 'download')

interface CachedReleaseData {
  dir: string
  manifestMtimeMs: number
  changelogMtimeMs: number
  apkMtimeMs: number
  apkSize: number
  manifest: AppManifest
  sections: ChangelogSection[]
}

let cache: CachedReleaseData | null = null

async function resolveActiveDir(): Promise<string> {
  const persistentManifest = await stat(
    /* turbopackIgnore: true */ path.join(PERSISTENT_RELEASES_DIR, 'manifest.json'),
  ).catch(() => null)
  if (persistentManifest?.isFile()) {
    return PERSISTENT_RELEASES_DIR
  }
  return FALLBACK_DOWNLOAD_DIR
}

async function resolveApkFileStat(fileName: string): Promise<{
  filePath: string
  mtimeMs: number
  size: number
} | null> {
  const candidates = [
    path.join(PERSISTENT_RELEASES_DIR, 'apk', fileName),
    path.join(FALLBACK_DOWNLOAD_DIR, 'apk', fileName),
  ]
  for (const candidate of candidates) {
    const info = await stat(/* turbopackIgnore: true */ candidate).catch(() => null)
    if (info?.isFile() && info.size > 0) {
      return { filePath: candidate, mtimeMs: info.mtimeMs, size: info.size }
    }
  }
  return null
}

async function computeFileSha256(filePath: string): Promise<string> {
  const buf = await readFile(/* turbopackIgnore: true */ filePath)
  return createHash('sha256').update(buf).digest('hex')
}

async function load(): Promise<{ manifest: AppManifest; sections: ChangelogSection[] }> {
  const dir = await resolveActiveDir()
  const manifestPath = path.join(dir, 'manifest.json')
  const changelogPath = path.join(dir, 'CHANGELOG.md')

  const [mStat, cStat] = await Promise.all([
    stat(/* turbopackIgnore: true */ manifestPath).catch(() => null),
    stat(/* turbopackIgnore: true */ changelogPath).catch(() => null),
  ])
  const manifestMtimeMs = mStat?.mtimeMs ?? 0
  const changelogMtimeMs = cStat?.mtimeMs ?? 0

  if (
    cache &&
    cache.dir === dir &&
    cache.manifestMtimeMs === manifestMtimeMs &&
    cache.changelogMtimeMs === changelogMtimeMs
  ) {
    const apkStat = await resolveApkFileStat(cache.manifest.android.file)
    const apkMtimeMs = apkStat?.mtimeMs ?? 0
    const apkSize = apkStat?.size ?? cache.manifest.android.size
    if (cache.apkMtimeMs === apkMtimeMs && cache.apkSize === apkSize) {
      return { manifest: cache.manifest, sections: cache.sections }
    }
  }

  const [rawManifest, rawChangelog] = await Promise.all([
    readFile(/* turbopackIgnore: true */ manifestPath, 'utf8'),
    readFile(/* turbopackIgnore: true */ changelogPath, 'utf8').catch(() =>
      readFile(
        /* turbopackIgnore: true */ path.join(FALLBACK_DOWNLOAD_DIR, 'CHANGELOG.md'),
        'utf8',
      ),
    ),
  ])

  const parsedManifest = AppManifestSchema.parse(JSON.parse(rawManifest))
  const apkStat = await resolveApkFileStat(parsedManifest.android.file)
  let finalManifest = parsedManifest
  if (apkStat) {
    const actualSha256 = await computeFileSha256(apkStat.filePath)
    finalManifest = {
      ...parsedManifest,
      android: {
        ...parsedManifest.android,
        size: apkStat.size,
        sha256: actualSha256,
      },
    }
  }

  const sections = parseChangelog(rawChangelog)
  cache = {
    dir,
    manifestMtimeMs,
    changelogMtimeMs,
    apkMtimeMs: apkStat?.mtimeMs ?? 0,
    apkSize: finalManifest.android.size,
    manifest: finalManifest,
    sections,
  }
  return { manifest: finalManifest, sections }
}

/** 安装包下载地址：统一指向自有服务器 `/download/<文件名>`（Nginx 静态直出，支持断点续传） */
export function apkUrls(file: string, sourceTag?: string) {
  const cleanTag = sourceTag ? encodeURIComponent(sourceTag) : 'latest'
  return {
    url: `/download/${file}`,
    fallbackUrl: `/download/${file}?v=${cleanTag}`,
  }
}

export async function checkAppUpdate(input: { web: string; shell?: string }): Promise<AppUpdate> {
  const { manifest, sections } = await load()
  return decideUpdate({
    manifest,
    sections,
    web: input.web,
    ...(input.shell ? { shell: input.shell } : {}),
    urls: apkUrls(manifest.android.file, manifest.android.sourceTag),
  })
}

/** `/download/<文件名>` 用：优先从服务器独立目录 `releases/apk/` 读取，回退至 `download/apk/` */
export async function apkPath(file: string): Promise<{ path: string; size: number } | null> {
  const { manifest } = await load()
  if (file !== manifest.android.file) return null
  const apkStat = await resolveApkFileStat(manifest.android.file)
  if (apkStat) {
    return { path: apkStat.filePath, size: apkStat.size }
  }
  return {
    path: path.join(FALLBACK_DOWNLOAD_DIR, 'apk', manifest.android.file),
    size: manifest.android.size,
  }
}
