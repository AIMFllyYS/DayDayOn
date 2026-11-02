import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { friendActions } from '@/features/friend/friend-store'
import { AgentFloatingLayer, isFloatingPetHidden } from './agent-host'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
}))

vi.mock('./components/floating-pet', () => ({
  FloatingPet: () => <div data-testid="floating-pet">FloatingPet</div>,
}))

vi.mock('./components/agent-panel', () => ({
  AgentPanel: () => <div data-testid="agent-panel">AgentPanel</div>,
}))

describe('Decision #1: FloatingPet 悬浮宠物显示与隐藏守则', () => {
  beforeEach(() => {
    currentPathname = '/'
    friendActions.selectFriend(null)
  })

  describe('isFloatingPetHidden 纯逻辑判定', () => {
    it('在主页且 viewingFriendId === null (查看我) 时，悬浮宠物可见 (isFloatingPetHidden 为 false)', () => {
      expect(isFloatingPetHidden('/', null)).toBe(false)
    })

    it('在主页但 viewingFriendId !== null (串门好友小窝) 时，悬浮宠物严格隐藏 (Decision #1)', () => {
      expect(isFloatingPetHidden('/', 'friend-u1')).toBe(true)
      expect(isFloatingPetHidden('/', 'friend-ayou')).toBe(true)
      expect(isFloatingPetHidden('/', 'friend-doudou')).toBe(true)
    })

    it('从好友小窝切回「我」(viewingFriendId 重置为 null) 时，悬浮宠物恢复可见', () => {
      let viewingFriendId: string | null = 'friend-u1'
      expect(isFloatingPetHidden('/', viewingFriendId)).toBe(true)

      viewingFriendId = null
      expect(isFloatingPetHidden('/', viewingFriendId)).toBe(false)
    })

    it('在 /me 页面中，无论是否在好友视角，均隐藏悬浮宠物（已有个人资料大团团）', () => {
      expect(isFloatingPetHidden('/me', null)).toBe(true)
      expect(isFloatingPetHidden('/me', 'friend-u1')).toBe(true)
    })

    it('在 /agent 全屏页或其子路由中，无论是否在好友视角，均隐藏悬浮宠物', () => {
      expect(isFloatingPetHidden('/agent', null)).toBe(true)
      expect(isFloatingPetHidden('/agent/new', null)).toBe(true)
      expect(isFloatingPetHidden('/agent/conv-123', 'friend-u1')).toBe(true)
    })
  })

  describe('AgentFloatingLayer 组件渲染判定', () => {
    it('当查看「我」时，渲染 FloatingPet 与 AgentPanel', () => {
      currentPathname = '/'
      friendActions.selectFriend(null)

      const html = renderToStaticMarkup(<AgentFloatingLayer />)
      expect(html).toContain('data-testid="floating-pet"')
      expect(html).toContain('data-testid="agent-panel"')
    })

    it('当切换到好友房间 (viewingFriendId !== null) 时，组件返回 null，不渲染悬浮宠物 (Decision #1)', () => {
      currentPathname = '/'
      friendActions.selectFriend('friend-user-42')

      const html = renderToStaticMarkup(<AgentFloatingLayer />)
      expect(html).toBe('')
      expect(html).not.toContain('floating-pet')
    })

    it('当从好友房间切回「我」时，悬浮宠物立即恢复渲染', () => {
      currentPathname = '/'
      // 1. 进入好友空间
      friendActions.selectFriend('friend-user-42')
      expect(renderToStaticMarkup(<AgentFloatingLayer />)).toBe('')

      // 2. 切回「我」
      friendActions.selectFriend(null)
      const restoredHtml = renderToStaticMarkup(<AgentFloatingLayer />)
      expect(restoredHtml).toContain('data-testid="floating-pet"')
    })

    it('当好友被解除好友 (handleUnfriend) 时，状态自动切回「我」，悬浮宠物自动恢复', () => {
      currentPathname = '/'
      friendActions.selectFriend('friend-user-removed')
      expect(renderToStaticMarkup(<AgentFloatingLayer />)).toBe('')

      // 触发解除好友
      friendActions.handleUnfriend('friend-user-removed')
      const restoredHtml = renderToStaticMarkup(<AgentFloatingLayer />)
      expect(restoredHtml).toContain('data-testid="floating-pet"')
    })

    it('在 /me 页面无论状态如何均不渲染 AgentFloatingLayer', () => {
      currentPathname = '/me'
      friendActions.selectFriend(null)
      expect(renderToStaticMarkup(<AgentFloatingLayer />)).toBe('')

      friendActions.selectFriend('friend-user-1')
      expect(renderToStaticMarkup(<AgentFloatingLayer />)).toBe('')
    })
  })
})
