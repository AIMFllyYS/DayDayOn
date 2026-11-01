import { describe, expect, it } from 'vitest'
import { ApiError } from '@/server/api/errors'
import { IMAGE_MAX_BYTES, imageToFilePart } from './image'

const jpeg = (size = 16) => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xe0])
  return new File([bytes], 'x.jpg', { type: 'image/jpeg' })
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof ApiError ? e.code : 'other'
  }
}

describe('imageToFilePart', () => {
  it('合法 JPEG 转成内联 file part', async () => {
    const part = await imageToFilePart(jpeg())
    expect(part.type).toBe('file')
    expect(part.mediaType).toBe('image/jpeg')
    expect(part.data).toBeInstanceOf(Uint8Array)
    expect('filename' in part).toBe(false)
  })

  it('不是文件：VALIDATION_FAILED', async () => {
    expect(await codeOf(imageToFilePart('abc'))).toBe('VALIDATION_FAILED')
    expect(await codeOf(imageToFilePart(undefined))).toBe('VALIDATION_FAILED')
  })

  it('不是 image/jpeg：VALIDATION_FAILED', async () => {
    const png = new File([new Uint8Array([0x89, 0x50])], 'x.png', { type: 'image/png' })
    expect(await codeOf(imageToFilePart(png))).toBe('VALIDATION_FAILED')
  })

  it('类型声称是 JPEG 但文件头不对：VALIDATION_FAILED', async () => {
    const fake = new File([new Uint8Array([1, 2, 3, 4])], 'x.jpg', { type: 'image/jpeg' })
    expect(await codeOf(imageToFilePart(fake))).toBe('VALIDATION_FAILED')
  })

  it('超过 4 MB：PAYLOAD_TOO_LARGE', async () => {
    expect(await codeOf(imageToFilePart(jpeg(IMAGE_MAX_BYTES + 1)))).toBe('PAYLOAD_TOO_LARGE')
  })
})
