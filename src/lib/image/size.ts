/*
 * 压缩尺寸计算（ai-and-quota.md 第 5 节、ADR-0011）：纯函数，带单测。
 * 像素总量不超过约 1300×1300，等比缩放，只缩小不放大。
 */

/** 像素总量上限：约 1300×1300 */
export const MAX_PIXELS = 1300 * 1300

/** 重新编码的 JPEG 质量 */
export const JPEG_QUALITY = 0.8

/** 接口上限 4 MB（api-conventions.md 第 11 节）；压缩后仍超过就提示换图 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export interface Size {
  width: number
  height: number
}

/**
 * 等比缩放到像素总量 ≤ maxPixels。原图已经足够小时原样返回。
 * 结果向下取整、至少 1 像素，保证不会超过上限。
 */
export function fitWithinPixels(source: Size, maxPixels: number = MAX_PIXELS): Size {
  const { width, height } = source
  if (!(width > 0 && height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError(`无效的图片尺寸：${width}×${height}`)
  }
  if (width * height <= maxPixels) return { width, height }
  const scale = Math.sqrt(maxPixels / (width * height))
  // 先定短边（至少 1 像素），再按剩余像素预算定长边：
  // 极端长宽比时短边被钳到 1，长边也不会让总量超上限
  const fit = (short: number, long: number) => {
    const s = Math.max(1, Math.floor(short * scale))
    const l = Math.max(1, Math.min(Math.floor(long * scale), Math.floor(maxPixels / s)))
    return [s, l] as const
  }
  if (width >= height) {
    const [h, w] = fit(height, width)
    return { width: w, height: h }
  }
  const [w, h] = fit(width, height)
  return { width: w, height: h }
}
