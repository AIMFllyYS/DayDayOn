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
