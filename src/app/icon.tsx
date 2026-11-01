import { ImageResponse } from 'next/og'
import { logoDataUri } from '@/components/layout/logo-svg'

/*
 * 标签页图标（ADR-0022）：团团大头，32px 下也认得出。Next 按 app/icon.tsx 自动加 <link rel="icon">。
 * 构建时生成为静态 PNG（没有读请求数据）。
 */
export const size = { width: 64, height: 64 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse 里只能用 <img>
    <img src={logoDataUri('mark')} width={size.width} height={size.height} alt="" />,
    size,
  )
}
