/*
 * 浏览器端图片处理入口（ai-and-quota.md 第 5 节）。compressImage 只能在客户端组件里调用。
 */
export {
  compressImage,
  ImageCompressError,
  type CompressedImage,
  type CompressOptions,
  type ImageCompressErrorReason,
} from './compress'
export { fitWithinPixels, JPEG_QUALITY, MAX_PIXELS, MAX_UPLOAD_BYTES, type Size } from './size'
