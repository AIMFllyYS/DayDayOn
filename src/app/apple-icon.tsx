import { ImageResponse } from 'next/og'
import { logoDataUri } from '@/components/layout/logo-svg'

/*
 * iPhone 添加到主屏幕的图标（ADR-0022）：团团和墩墩肩并肩。
 * 满版方块，iOS 会自己切圆角；不能有透明区域，否则 iOS 会垫黑底。
 */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse 里只能用 <img>
    <img src={logoDataUri('full', 'square')} width={size.width} height={size.height} alt="" />,
    size,
  )
}
