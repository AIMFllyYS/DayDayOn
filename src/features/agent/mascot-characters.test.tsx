import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Splash } from '@/components/layout/splash'
import {
  MASCOT_CHARACTER_NAMES,
  MASCOT_IDS,
  mascotCharacterName,
  resolveMascotCharacter,
} from '@/features/me/schemas'
import { AgentMessages } from './components/agent-messages'
import { AgentTurn } from './components/agent-turn'

vi.mock('@/lib/api/queries/me', () => ({
  useMe: () => ({ data: undefined }),
}))

describe('4 吉祥物统一映射与 Agent / Splash 全链路支持', () => {
  it('resolveMascotCharacter 与 mascotCharacterName 统一支持 4 个角色并安全回退', () => {
    expect(MASCOT_IDS).toEqual(['tuan', 'dun', 'mian', 'you'])
    expect(MASCOT_CHARACTER_NAMES).toEqual({
      tuan: '团团',
      dun: '墩墩',
      mian: '绵绵',
      you: '柚柚',
    })
    expect(resolveMascotCharacter('mian')).toBe('mian')
    expect(resolveMascotCharacter('you')).toBe('you')
    expect(resolveMascotCharacter('invalid')).toBe('tuan')
    expect(mascotCharacterName('tuan')).toBe('团团')
    expect(mascotCharacterName('dun')).toBe('墩墩')
    expect(mascotCharacterName('mian')).toBe('绵绵')
    expect(mascotCharacterName('you')).toBe('柚柚')
    expect(mascotCharacterName(undefined)).toBe('团团')
  })

  it('AgentTurn 对 4 个角色均渲染对应的角色名称与读屏标签', () => {
    for (const id of MASCOT_IDS) {
      const name = MASCOT_CHARACTER_NAMES[id]
      const html = renderToStaticMarkup(
        <AgentTurn
          character={id}
          turn={{
            id: 't1',
            status: 'done',
            parts: [{ id: 'p1', type: 'text', text: '今天表现不错', state: 'done' }],
          }}
        />,
      )
      expect(html).toContain(`aria-label="${name}的回复"`)
      expect(html).toContain(`>${name}</span>`)
    }
  })

  it('AgentMessages 空态引导语对 4 个角色均显示对应的自称', () => {
    for (const id of MASCOT_IDS) {
      const name = MASCOT_CHARACTER_NAMES[id]
      const html = renderToStaticMarkup(
        <AgentMessages messages={[]} status="ready" character={id} />,
      )
      expect(html).toContain(`我是${name}，你的打卡搭子～`)
    }
  })

  it('Splash 渲染包含全部 4 个角色的容器以供纯 CSS 开屏切换', () => {
    const html = renderToStaticMarkup(<Splash />)
    for (const id of MASCOT_IDS) {
      expect(html).toContain(`splash-char-${id}`)
    }

    const previewMian = renderToStaticMarkup(<Splash preview character="mian" />)
    expect(previewMian).toContain('splash-char-mian')
    expect(previewMian).not.toContain('splash-char-tuan')
  })
})
