import 'server-only'
import type { FilePart } from 'ai'

/*
 * 上传图片 → 内联 file part（ai-and-quota.md 第 5 节）。签名 F1，实现 P1。
 * 只在内存里处理：不写磁盘、不进日志、不缓存；禁止 uploadFile / Files API。
 */

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024

/**
 * 校验 multipart 里的 image：必须是 File、image/jpeg、JPEG 文件头（FF D8 FF）、≤ 4 MB。
 * 不合法抛 ApiError('VALIDATION_FAILED' | 'PAYLOAD_TOO_LARGE')。实现：P1
 */
export async function imageToFilePart(file: unknown): Promise<FilePart> {
  void file
  throw new Error('not implemented: P1')
}
