/*
 * 零依赖纯 TypeScript QR Code 编码器（ISO/IEC 18004，Byte 模式，纠错等级 M，支持 Version 1–6）。
 * 用于原生 Canvas 打卡分享海报的推广二维码绘制，不引入任何第三方库。
 * Version 1–6（ECC-M）最多支持 106 UTF-8 字节；主站 URL `https://daydayon.husteread.com/`（31 字节）
 * 自动落入 Version 3（29×29 模块），纠错率 15%，小尺寸也能秒扫。
 */

interface QrVersionSpec {
  version: number
  size: number
  dataCodewords: number
  ecPerBlock: number
  blocks: number
  alignmentCenters: readonly number[]
}

/** ISO/IEC 18004 Table 9（ECC Level M）& Annex E Table E.1 */
const QR_SPECS: readonly QrVersionSpec[] = [
  { version: 1, size: 21, dataCodewords: 16, ecPerBlock: 10, blocks: 1, alignmentCenters: [] },
  { version: 2, size: 25, dataCodewords: 28, ecPerBlock: 16, blocks: 1, alignmentCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, ecPerBlock: 26, blocks: 1, alignmentCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, ecPerBlock: 18, blocks: 2, alignmentCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 86, ecPerBlock: 24, blocks: 2, alignmentCenters: [6, 30] },
  {
    version: 6,
    size: 41,
    dataCodewords: 108,
    ecPerBlock: 16,
    blocks: 4,
    alignmentCenters: [6, 34],
  },
]

// GF(256) 查表，本原多项式 x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!
  }
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!
}

/** 构造度为 degree 的 Reed-Solomon 生成多项式（最高次系数 1 省略在首项之后按降幂排列） */
function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const factor = GF_EXP[i]!
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j]! ^ poly[j]!) & 0xff
      next[j + 1] = (next[j + 1]! ^ gfMul(poly[j]!, factor)) & 0xff
    }
    poly = next
  }
  return poly
}

/** 计算单个数据块的 Reed-Solomon 纠错字节 */
export function rsComputeEcBytes(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount)
  const rem = new Uint8Array(ecCount)
  for (const byte of data) {
    const factor = byte ^ rem[0]!
    rem.copyWithin(0, 1)
    rem[ecCount - 1] = 0
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] = rem[j]! ^ gfMul(gen[j + 1]!, factor)
      }
    }
  }
  return rem
}

/** 计算 15 位格式信息（ECC Level M = 0b00，掩码 0..7，与 0x5412 异或） */
export function qrFormatBits(mask: number): number {
  const data = (0b00 << 3) | (mask & 7)
  let rem = data << 10
  for (let bit = 14; bit >= 10; bit--) {
    if ((rem >> bit) & 1) {
      rem ^= 0x537 << (bit - 10)
    }
  }
  return ((data << 10) | rem) ^ 0x5412
}

function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0
    case 1:
      return r % 2 === 0
    case 2:
      return c % 3 === 0
    case 3:
      return (r + c) % 3 === 0
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
    default:
      return false
  }
}

function buildDataCodewords(bytes: Uint8Array, totalDataCodewords: number): Uint8Array {
  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  // Byte mode indicator (0100) + 8-bit byte length
  pushBits(0b0100, 4)
  pushBits(bytes.length, 8)
  for (const b of bytes) {
    pushBits(b, 8)
  }

  const maxBits = totalDataCodewords * 8
  const terminatorLen = Math.min(4, maxBits - bits.length)
  for (let i = 0; i < terminatorLen; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const out = new Uint8Array(totalDataCodewords)
  const dataBytesLen = bits.length / 8
  for (let i = 0; i < dataBytesLen; i++) {
    let v = 0
    for (let b = 0; b < 8; b++) {
      v = (v << 1) | bits[i * 8 + b]!
    }
    out[i] = v
  }
  // 交替填充 0xEC / 0x11
  for (let i = dataBytesLen; i < totalDataCodewords; i++) {
    out[i] = (i - dataBytesLen) % 2 === 0 ? 0xec : 0x11
  }
  return out
}

function buildCodewordStream(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const data = buildDataCodewords(bytes, spec.dataCodewords)
  const blockDataLen = spec.dataCodewords / spec.blocks
  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []

  for (let b = 0; b < spec.blocks; b++) {
    const slice = data.subarray(b * blockDataLen, (b + 1) * blockDataLen)
    dataBlocks.push(slice)
    ecBlocks.push(rsComputeEcBytes(slice, spec.ecPerBlock))
  }

  const total = spec.dataCodewords + spec.blocks * spec.ecPerBlock
  const stream = new Uint8Array(total)
  let offset = 0
  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      stream[offset++] = dataBlocks[b]![i]!
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      stream[offset++] = ecBlocks[b]![i]!
    }
  }
  return stream
}

function placeFormatInfo(modules: Uint8Array, size: number, mask: number) {
  const bits = qrFormatBits(mask)
  const set = (r: number, c: number, bitIndex: number) => {
    modules[r * size + c] = (bits >> bitIndex) & 1
  }

  // Copy 1: 左上定位符周围
  for (let i = 0; i <= 5; i++) set(8, i, 14 - i)
  set(8, 7, 8)
  set(8, 8, 7)
  set(7, 8, 6)
  for (let i = 0; i <= 5; i++) set(5 - i, 8, 5 - i)

  // Copy 2: 左下 + 右上
  for (let i = 0; i <= 6; i++) set(size - 1 - i, 8, 14 - i)
  for (let i = 0; i <= 7; i++) set(8, size - 8 + i, 7 - i)
}

function computePenalty(modules: Uint8Array, size: number): number {
  let score = 0
  const at = (r: number, c: number) => modules[r * size + c]!

  // Rule 1: 连续 5 个及以上同色模块
  for (let r = 0; r < size; r++) {
    let runColor = at(r, 0)
    let runLen = 1
    for (let c = 1; c < size; c++) {
      const v = at(r, c)
      if (v === runColor) {
        runLen++
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5)
        runColor = v
        runLen = 1
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5)
  }
  for (let c = 0; c < size; c++) {
    let runColor = at(0, c)
    let runLen = 1
    for (let r = 1; r < size; r++) {
      const v = at(r, c)
      if (v === runColor) {
        runLen++
      } else {
        if (runLen >= 5) score += 3 + (runLen - 5)
        runColor = v
        runLen = 1
      }
    }
    if (runLen >= 5) score += 3 + (runLen - 5)
  }

  // Rule 2: 2×2 同色块
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = at(r, c)
      if (v === at(r, c + 1) && v === at(r + 1, c) && v === at(r + 1, c + 1)) {
        score += 3
      }
    }
  }

  // Rule 3: 类定位符样式 1:1:3:1:1 伴随 4 白边
  const matchFinder = (arr: number[], start: number): boolean => {
    const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
    const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
    let m1 = true
    let m2 = true
    for (let i = 0; i < 11; i++) {
      if (arr[start + i] !== p1[i]) m1 = false
      if (arr[start + i] !== p2[i]) m2 = false
    }
    return m1 || m2
  }
  const line = new Array<number>(size)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) line[c] = at(r, c)
    for (let c = 0; c <= size - 11; c++) {
      if (matchFinder(line, c)) score += 40
    }
  }
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) line[r] = at(r, c)
    for (let r = 0; r <= size - 11; r++) {
      if (matchFinder(line, r)) score += 40
    }
  }

  // Rule 4: 深色占比偏离 50%
  let dark = 0
  for (const m of modules) dark += m
  const pct = (dark * 100) / (size * size)
  const k = Math.floor(Math.abs(pct - 50) / 5)
  score += k * 10
  return score
}

export interface QrMatrix {
  version: number
  size: number
  /** 长度为 size * size，1 为深色模块、0 为浅色模块（行主序） */
  modules: Uint8Array
}

/** 将 UTF-8 字符串编码为标准 QR Code 矩阵（ECC-M，Version 1–6） */
export function encodeQr(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text)
  const spec = QR_SPECS.find((s) => bytes.length + 2 <= s.dataCodewords)
  if (!spec) {
    throw new RangeError(`QR 文本超出 Version 6-M 容量上限（${bytes.length} 字节）`)
  }

  const { size, version } = spec
  const base = new Uint8Array(size * size)
  const isFunction = new Uint8Array(size * size)

  const setFn = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return
    base[r * size + c] = dark ? 1 : 0
    isFunction[r * size + c] = 1
  }

  // 1. 三个 7×7 定位符 + 1 模块白边分隔符
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr
        const c = left + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setFn(r, c, inOuter && (onRing || inCore))
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // 2. 校正图形（Version 2+）
  for (const cr of spec.alignmentCenters) {
    for (const cc of spec.alignmentCenters) {
      if (isFunction[cr * size + cc]) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc))
          setFn(cr + dr, cc + dc, dist !== 1)
        }
      }
    }
  }

  // 3. 定时图形（第 6 行与第 6 列）
  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0)
    setFn(i, 6, i % 2 === 0)
  }

  // 4. 固定深色模块 & 预留格式信息区
  setFn(4 * version + 9, 8, true)
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8 * size + i]) isFunction[8 * size + i] = 1
    if (!isFunction[i * size + 8]) isFunction[i * size + 8] = 1
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8 * size + i] = 1
    if (i > size - 8) isFunction[i * size + 8] = 1
  }

  // 5. 之字形填入数据与纠错码字比特流
  const codewords = buildCodewordStream(bytes, spec)
  let bitIdx = 0
  const totalBits = codewords.length * 8
  let upward = true
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5 // 跳过第 6 列定时图形
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step
      for (const dc of [0, -1]) {
        const c = rightCol + dc
        if (isFunction[r * size + c]) continue
        let bit = 0
        if (bitIdx < totalBits) {
          bit = (codewords[bitIdx >> 3]! >> (7 - (bitIdx & 7))) & 1
        }
        base[r * size + c] = bit
        bitIdx++
      }
    }
    upward = !upward
  }

  // 6. 评估 8 种掩码，取惩罚分最低的最优矩阵
  let bestModules = new Uint8Array(size * size)
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const candidate = new Uint8Array(base)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunction[r * size + c] && maskCondition(mask, r, c)) {
          candidate[r * size + c] ^= 1
        }
      }
    }
    placeFormatInfo(candidate, size, mask)
    const penalty = computePenalty(candidate, size)
    if (penalty < bestScore) {
      bestScore = penalty
      bestModules = candidate
    }
  }

  return { version, size, modules: bestModules }
}
