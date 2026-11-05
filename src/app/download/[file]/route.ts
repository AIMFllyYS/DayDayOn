import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { apkPath } from '@/server/services/app-update'

/*
 * /download/<文件名>：App 安装包从我们自己的服务器下载（download/README.md），GitHub Release 只作备用。
 * 只放行 download/manifest.json 里登记的那个文件名，其余一律 404，不做目录浏览。
 * 安装包不进 Git，部署制品打包时放进 download/apk/；本地开发没有这个文件时返回 404。
 */

export async function GET(_req: Request, ctx: RouteContext<'/download/[file]'>) {
  const { file } = await ctx.params
  const found = await apkPath(file)
  if (!found) return new Response('Not Found', { status: 404 })
  const info = await stat(found.path).catch(() => null)
  if (!info?.isFile()) return new Response('Not Found', { status: 404 })

  const body = Readable.toWeb(createReadStream(found.path)) as ReadableStream<Uint8Array>
  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(info.size),
      'Content-Disposition': `attachment; filename="${file}"`,
      // 文件名固定、内容随版本变：每次都回源校验，不让 CDN / 浏览器长期缓存旧包
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
