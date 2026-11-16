import { describe, expect, it } from 'vitest'
import type { DbOrTx } from '@/server/db/client'
import { loadPetName } from './pet-name'

function fakeDb(mascot: string | null | undefined): DbOrTx {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mascot === undefined ? [] : [{ mascot }]),
        }),
      }),
    }),
  } as unknown as DbOrTx
}

describe('loadPetName', () => {
  it('正确映射全部 4 个陪伴角色（tuan / dun / mian / you）', async () => {
    await expect(loadPetName(fakeDb('tuan'), 'u1')).resolves.toBe('团团')
    await expect(loadPetName(fakeDb('dun'), 'u1')).resolves.toBe('墩墩')
    await expect(loadPetName(fakeDb('mian'), 'u1')).resolves.toBe('绵绵')
    await expect(loadPetName(fakeDb('you'), 'u1')).resolves.toBe('柚柚')
  })

  it('无资料行或未知角色时安全回退为团团', async () => {
    await expect(loadPetName(fakeDb(undefined), 'u1')).resolves.toBe('团团')
    await expect(loadPetName(fakeDb(null), 'u1')).resolves.toBe('团团')
    await expect(loadPetName(fakeDb('unknown'), 'u1')).resolves.toBe('团团')
  })
})
