import { fitWithinPixels, JPEG_QUALITY, MAX_PIXELS, MAX_UPLOAD_BYTES } from './size'

/*
 * 浏览器端图片压缩（ai-and-quota.md 第 5 节、ADR-0011）：只在客户端组件里调用。
 * createImageBitmap 解码 → canvas 缩放到像素总量 ≤ 约 1300×1300 → toBlob('image/jpeg', 0.8)。
 * 重新编码会去掉 EXIF（包括 GPS 位置）。图片只在内存里，不写任何存储、不进缓存。
 */

export type ImageCompressErrorReason = 'decode-failed' | 'encode-failed' | 'too-large'

const MESSAGES: Record<ImageCompressErrorReason, string> = {
  'decode-failed': '这张图打不开，换一张或截个图试试',
  'encode-failed': '这张图处理不了，换一张或截个图试试',
  'too-large': '图片太大了，换一张或截个图试试',
}

/** 压缩失败；message 是可以直接展示给用户的文案 */
export class ImageCompressError extends Error {
  readonly reason: ImageCompressErrorReason

  constructor(reason: ImageCompressErrorReason, options?: { cause?: unknown }) {
    super(MESSAGES[reason], options)
    this.name = 'ImageCompressError'
    this.reason = reason
  }
}

export interface CompressedImage {
  /** image/jpeg；上传时作为 multipart 字段 image */
  blob: Blob
  width: number
  height: number
}

export interface CompressOptions {
  maxPixels?: number
  quality?: number
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    // from-image：按 EXIF 方向摆正，手机竖拍的照片不会躺倒
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (cause) {
    // 例如桌面 Chrome 打不开 HEIC
    throw new ImageCompressError('decode-failed', { cause })
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageCompressError('encode-failed'))),
      'image/jpeg',
      quality,
    )
  })
}

/** 把用户选的图片压成 JPEG。失败抛 ImageCompressError，界面直接显示它的 message */
export async function compressImage(
  file: Blob,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const bitmap = await decode(file)
  const canvas = document.createElement('canvas')
  try {
    const size = fitWithinPixels(
      { width: bitmap.width, height: bitmap.height },
      options.maxPixels ?? MAX_PIXELS,
    )
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageCompressError('encode-failed')
    // JPEG 没有透明通道：先铺白底，透明 PNG 不会变黑
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    const blob = await toJpeg(canvas, options.quality ?? JPEG_QUALITY)
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageCompressError('too-large')
    return { blob, ...size }
  } catch (err) {
    if (err instanceof ImageCompressError) throw err
    throw new ImageCompressError(err instanceof RangeError ? 'decode-failed' : 'encode-failed', {
      cause: err,
    })
  } finally {
    bitmap.close()
    // 释放画布内存（iOS Safari 对画布总内存有限制）
    canvas.width = 0
    canvas.height = 0
  }
}
