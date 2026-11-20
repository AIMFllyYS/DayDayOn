import { describe, expect, it } from 'vitest'
import { encodeQr, qrFormatBits, rsComputeEcBytes } from './qr'

describe('QR Code 编码器 (ISO/IEC 18004 ECC-M)', () => {
  it('格式信息比特与 ISO/IEC 18004 Annex C 表完全一致', () => {
    // Level M (00) + mask 0..3
    expect(qrFormatBits(0)).toBe(0x5412)
    expect(qrFormatBits(1)).toBe(0x5125)
    expect(qrFormatBits(2)).toBe(0x5e7c)
    expect(qrFormatBits(3)).toBe(0x5b4b)
  })

  it('Reed-Solomon 纠错字节与标准测试向量一致', () => {
    // ISO/IEC 18004 Version 1-M: 16 data bytes -> 10 EC bytes
    const data = new Uint8Array([
      0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec,
      0x11,
    ])
    const ec = rsComputeEcBytes(data, 10)
    expect(Array.from(ec)).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85])
  })

  it('主站 URL 自动落入 Version 3 (29×29) 且定位符、定时图形、暗模块均准确', () => {
    const qr = encodeQr('https://daydayon.husteread.com/')
    expect(qr.version).toBe(3)
    expect(qr.size).toBe(29)
    expect(qr.modules.length).toBe(29 * 29)

    const at = (r: number, c: number) => qr.modules[r * qr.size + c]
    // 左上定位符外框与中心 3×3
    expect(at(0, 0)).toBe(1)
    expect(at(0, 6)).toBe(1)
    expect(at(1, 1)).toBe(0)
    expect(at(3, 3)).toBe(1)
    // 右上与左下定位符中心
    expect(at(3, qr.size - 4)).toBe(1)
    expect(at(qr.size - 4, 3)).toBe(1)
    // 固定深色模块 (4*v + 9, 8) = (21, 8)
    expect(at(21, 8)).toBe(1)
    // 定时图形
    expect(at(6, 8)).toBe(1)
    expect(at(6, 9)).toBe(0)
    expect(at(8, 6)).toBe(1)
    expect(at(9, 6)).toBe(0)
    // Version 3 校正图形中心 (22, 22)
    expect(at(22, 22)).toBe(1)
    expect(at(21, 22)).toBe(0)
    expect(at(20, 20)).toBe(1)
  })

  it('支持不同长度并自动切换版本 1–6', () => {
    expect(encodeQr('hi').version).toBe(1)
    expect(encodeQr('https://daydayon.husteread.com/').version).toBe(3)
    expect(encodeQr('a'.repeat(90)).version).toBe(6)
    expect(() => encodeQr('a'.repeat(120))).toThrow()
  })
})
