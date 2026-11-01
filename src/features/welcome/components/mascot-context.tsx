'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'

/** 落地页上选的形象：顶部切换后，整页的团团 / 墩墩一起换 */
const MascotContext = createContext<{
  character: MascotCharacter
  setCharacter: (c: MascotCharacter) => void
}>({ character: 'tuan', setCharacter: () => {} })

export function WelcomeMascotProvider({ children }: { children: ReactNode }) {
  const [character, setCharacter] = useState<MascotCharacter>('tuan')
  return <MascotContext value={{ character, setCharacter }}>{children}</MascotContext>
}

export function useWelcomeMascot() {
  return use(MascotContext)
}
