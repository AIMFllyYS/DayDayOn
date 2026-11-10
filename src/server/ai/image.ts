import 'server-only'
import type { FilePart } from 'ai'
import { ApiError } from '@/server/api/errors'

/*
 * 上传图片 → 内联 file part（ai-and-quota.md 第 5 节）。签名 F1，实现 P1。
 * 只在内存里处理：不写磁盘、不进日志、不缓存；禁止 uploadFile / Files API。
 * 错误信息里不出现文件名、内容或 base64。
 */

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024

const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const

/**
 * 校验 multipart 里的 image：必须是 File、image/jpeg、JPEG 文件头（FF D8 FF）、≤ 4 MB。
 * 不合法抛 ApiError('VALIDATION_FAILED' | 'PAYLOAD_TOO_LARGE')。
 */
export async function imageToFilePart(file: unknown): Promise<FilePart> {
  if (!(file instanceof Blob)) {
    throw new ApiError('VALIDATION_FAILED', '缺少图片', { fields: { image: ['请选择一张照片'] } })
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', '图片超过 4 MB')
  }
  if (file.type !== 'image/jpeg') {
    throw new ApiError('VALIDATION_FAILED', '只接受 image/jpeg', {
      fields: { image: ['图片格式不对'] },
    })
  }
  const data = new Uint8Array(await file.arrayBuffer())
  if (data.byteLength === 0 || JPEG_MAGIC.some((b, i) => data[i] !== b)) {
    throw new ApiError('VALIDATION_FAILED', '文件头不是 JPEG', {
      fields: { image: ['图片格式不对'] },
    })
  }
  return { type: 'file', mediaType: 'image/jpeg', data }
}

const DATA_URL_JPEG_PREFIX = 'data:image/jpeg;base64,'

/**
 * 校验 Agent 对话内联传入的 JPEG dataURL（单条最多 2 张，每张解码后 ≤ 4 MB 且文件头为 FF D8 FF）。
 * 严守隐私规范：异常详情不包含任何 base64 片段。
 */
export function validateInlineJpegDataUrl(url: unknown): void {
  if (typeof url !== 'string' || !url.startsWith(DATA_URL_JPEG_PREFIX)) {
    throw new ApiError('VALIDATION_FAILED', '只接受压缩后的 JPEG 图片', {
      fields: { message: ['图片格式不对，请重新选择'] },
    })
  }
  const base64 = url.slice(DATA_URL_JPEG_PREFIX.length)
  if (base64.length === 0) {
    throw new ApiError('VALIDATION_FAILED', '图片内容为空', {
      fields: { message: ['图片格式不对，请重新选择'] },
    })
  }
  const approxBytes = Math.floor((base64.length * 3) / 4)
  if (approxBytes > IMAGE_MAX_BYTES) {
    throw new ApiError('PAYLOAD_TOO_LARGE', '单张图片超过 4 MB')
  }
  let head: Buffer
  try {
    head = Buffer.from(base64.slice(0, 16), 'base64')
  } catch {
    throw new ApiError('VALIDATION_FAILED', '图片编码无效', {
      fields: { message: ['图片格式不对，请重新选择'] },
    })
  }
  if (head.byteLength < 3 || JPEG_MAGIC.some((b, i) => head[i] !== b)) {
    throw new ApiError('VALIDATION_FAILED', '文件头不是 JPEG', {
      fields: { message: ['图片格式不对，请重新选择'] },
    })
  }
}
