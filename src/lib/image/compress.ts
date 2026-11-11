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

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|dng)$/i
const ISO_IMAGE_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
  'avif',
  'avis',
])

/** 检查文件前 16 字节是否匹配常见图片魔数（兼容安卓 DocumentsUI 无扩展名或 octet-stream 文件） */
export function hasImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  // GIF: GIF87a / GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true
  // BMP: BM
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true
  // TIFF / DNG: II*\0 or MM\0*
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return true
  }
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true
  }
  // ISO BMFF (HEIC / HEIF / AVIF): ....ftyp<brand>
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase()
    if (ISO_IMAGE_BRANDS.has(brand)) return true
  }
  return false
}

/** 判断所选 File 是否为图片（先查 MIME 与后缀，不确定时嗅探前 16 字节文件头） */
export async function sniffIsImageFile(file: File): Promise<boolean> {
  if (file.type.startsWith('image/')) return true
  if (IMAGE_EXT_RE.test(file.name)) return true
  if (file.type && file.type !== 'application/octet-stream') return false
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    return hasImageMagicBytes(head)
  } catch {
    return false
  }
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
