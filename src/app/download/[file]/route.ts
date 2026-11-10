import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { apkPath } from '@/server/services/app-update'

/*
 * /download/<文件名>：App 安装包从自有服务器下载（生产环境优先由 Nginx 别名直出 /www/wwwroot/daydayon/releases/apk/，
 * 本 Route Handler 作为本地开发与回源兜底，支持 HTTP Range 断点续传）。
 * 只放行 download/manifest.json 里登记的那个文件名，其余一律 404，不做目录浏览。
 */

export async function GET(req: Request, ctx: RouteContext<'/download/[file]'>) {
  const { file } = await ctx.params
  const found = await apkPath(file)
  if (!found) return new Response('Not Found', { status: 404 })
  const info = await stat(/* turbopackIgnore: true */ found.path).catch(() => null)
  if (!info?.isFile() || info.size <= 0) return new Response('Not Found', { status: 404 })

  const totalSize = info.size
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="${file}"`,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  }

  const rangeHeader = req.headers.get('range')
  if (rangeHeader) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim())
    if (match) {
      const start = Number.parseInt(match[1] ?? '0', 10)
      const end = match[2] ? Number.parseInt(match[2], 10) : totalSize - 1
      if (start >= 0 && start < totalSize && end >= start && end < totalSize) {
        const chunkLength = end - start + 1
        const stream = Readable.toWeb(
          createReadStream(/* turbopackIgnore: true */ found.path, { start, end }),
        ) as ReadableStream<Uint8Array>
        return new Response(stream, {
          status: 206,
          headers: {
            ...baseHeaders,
            'Content-Length': String(chunkLength),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          },
        })
      }
    }
  }

  const body = Readable.toWeb(
    createReadStream(/* turbopackIgnore: true */ found.path),
  ) as ReadableStream<Uint8Array>
  return new Response(body, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Length': String(totalSize),
    },
  })
}
