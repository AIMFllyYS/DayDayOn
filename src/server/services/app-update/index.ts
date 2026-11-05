import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  decideUpdate,
  parseChangelog,
  type ChangelogSection,
} from '@/features/app-update/changelog'
import { AppManifestSchema, type AppManifest, type AppUpdate } from '@/features/app-update/schemas'
import { GITHUB_REPO_URL } from '@/features/welcome/download'

/*
 * 检查更新（download/README.md）：读部署目录下的 download/manifest.json 与 download/CHANGELOG.md。
 * 部署制品把 download/ 放在 server.js 旁边（scripts/build/pack-artifact.sh），本地开发就是仓库根目录。
 * 文件随部署一起换，进程内缓存到下次部署（进程重启）为止。
 */

const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

let cache: { manifest: AppManifest; sections: ChangelogSection[] } | null = null

async function load() {
  if (cache) return cache
  const [rawManifest, changelog] = await Promise.all([
    readFile(path.join(DOWNLOAD_DIR, 'manifest.json'), 'utf8'),
    readFile(path.join(DOWNLOAD_DIR, 'CHANGELOG.md'), 'utf8'),
  ])
  const manifest = AppManifestSchema.parse(JSON.parse(rawManifest))
  cache = { manifest, sections: parseChangelog(changelog) }
  return cache
}

/** 安装包下载地址：自己服务器上的 /download/<文件名> 为主，GitHub Release 为备用 */
export function apkUrls(file: string, sourceTag: string) {
  return {
    url: `/download/${file}`,
    fallbackUrl: `${GITHUB_REPO_URL}/releases/download/${sourceTag}/${file}`,
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

/** /download/<文件名> 用：清单里登记的安装包在磁盘上的路径；不是登记的文件返回 null */
export async function apkPath(file: string): Promise<{ path: string; size: number } | null> {
  const { manifest } = await load()
  if (file !== manifest.android.file) return null
  return {
    path: path.join(DOWNLOAD_DIR, 'apk', manifest.android.file),
    size: manifest.android.size,
  }
}
