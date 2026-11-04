import { beforeEach, describe, expect, it } from 'vitest'
import { friendActions, getFriendStoreState, handleUnfriend, onFriendRemoved } from './friend-store'

describe('friend-store 状态机与串门流转验证', () => {
  beforeEach(() => {
    friendActions.selectFriend(null)
    friendActions.closeAddSheet()
    friendActions.cancelUnfriend()
  })

  describe('好友房间视角切换 (viewingFriendId)', () => {
    it('默认初始视角为 null ("我")', () => {
      expect(getFriendStoreState().viewingFriendId).toBeNull()
    })

    it('无缝切换到好友房间并在多个好友间切换，同步记录好友昵称与头像', () => {
      // 串门到阿柚的小窝
      friendActions.selectFriend('user-ayou', {
        nickname: '阿柚',
        avatar: 'mascot:tuan:cheer:diet',
      })
      expect(getFriendStoreState().viewingFriendId).toBe('user-ayou')
      expect(getFriendStoreState().viewingFriendNickname).toBe('阿柚')
      expect(getFriendStoreState().viewingFriendAvatar).toBe('mascot:tuan:cheer:diet')

      // 直接切换到豆豆的小窝
      friendActions.selectFriend('user-doudou', {
        nickname: '豆豆',
        avatar: 'mascot:dun:happy:study',
      })
      expect(getFriendStoreState().viewingFriendId).toBe('user-doudou')
      expect(getFriendStoreState().viewingFriendNickname).toBe('豆豆')

      // 返回我的主页
      friendActions.selectFriend(null)
      expect(getFriendStoreState().viewingFriendId).toBeNull()
      expect(getFriendStoreState().viewingFriendNickname).toBeNull()
      expect(getFriendStoreState().viewingFriendAvatar).toBeNull()
    })

    it('选择好友时自动关闭提示气泡', () => {
      // 触发引导气泡
      friendActions.completeMeteorFlight()
      expect(getFriendStoreState().hintBubbleOpen).toBe(true)

      // 切换视角
      friendActions.selectFriend('user-ayou')
      expect(getFriendStoreState().hintBubbleOpen).toBe(false)
    })
  })

  describe('添加好友抽屉状态控制', () => {
    it('正确打开与关闭添加好友抽屉', () => {
      expect(getFriendStoreState().addSheetOpen).toBe(false)

      friendActions.openAddSheet()
      expect(getFriendStoreState().addSheetOpen).toBe(true)

      friendActions.closeAddSheet()
      expect(getFriendStoreState().addSheetOpen).toBe(false)
    })
  })

  describe('流星飞行动效状态机', () => {
    it('接受好友后启动流星并关闭添加抽屉', () => {
      friendActions.openAddSheet()
      friendActions.launchAcceptMeteor({
        userId: 'u-friend-new',
        nickname: '新朋友',
        avatar: 'mascot:tuan:happy:exercise',
      })

      const state = getFriendStoreState()
      expect(state.addSheetOpen).toBe(false)
      expect(state.meteorFlight).not.toBeNull()
      expect(state.meteorFlight?.friendUserId).toBe('u-friend-new')
      expect(state.meteorFlight?.friendNickname).toBe('新朋友')

      friendActions.completeMeteorFlight()
      const endState = getFriendStoreState()
      expect(endState.meteorFlight).toBeNull()
      expect(endState.avatarPopping).toBe(true)
      expect(endState.hintBubbleOpen).toBe(true)
    })
  })

  describe('解除好友安全重置', () => {
    it('当 viewingFriendId 为被解除的好友时，立即重置为 null ("我")', () => {
      // 切换到好友 1 的视角
      friendActions.selectFriend('user-friend-1')
      expect(getFriendStoreState().viewingFriendId).toBe('user-friend-1')

      // 解除正在查看的好友 1，视角应重置为 null
      handleUnfriend('user-friend-1')
      expect(getFriendStoreState().viewingFriendId).toBeNull()

      // 切换到好友 2 的视角，通过 onFriendRemoved 解除
      friendActions.selectFriend('user-friend-2')
      expect(getFriendStoreState().viewingFriendId).toBe('user-friend-2')
      onFriendRemoved('user-friend-2')
      expect(getFriendStoreState().viewingFriendId).toBeNull()

      // 切换到好友 3 的视角，通过 friendActions.handleUnfriend 解除
      friendActions.selectFriend('user-friend-3')
      expect(getFriendStoreState().viewingFriendId).toBe('user-friend-3')
      friendActions.handleUnfriend('user-friend-3')
      expect(getFriendStoreState().viewingFriendId).toBeNull()

      // 若解除的不是当前查看的好友，视角保持不变
      friendActions.selectFriend('user-friend-keep')
      expect(getFriendStoreState().viewingFriendId).toBe('user-friend-keep')
      handleUnfriend('user-friend-other')
      expect(getFriendStoreState().viewingFriendId).toBe('user-friend-keep')

      // 清理状态回 null
      friendActions.selectFriend(null)
      expect(getFriendStoreState().viewingFriendId).toBeNull()
    })

    it('requestUnfriend 与 cancelUnfriend 正确管理二次确认目标，解除后自动清空', () => {
      expect(getFriendStoreState().unfriendTarget).toBeNull()

      friendActions.requestUnfriend({
        userId: 'user-ayou',
        nickname: '阿柚',
        avatar: 'mascot:tuan:cheer:diet',
      })
      expect(getFriendStoreState().unfriendTarget).toEqual({
        userId: 'user-ayou',
        nickname: '阿柚',
        avatar: 'mascot:tuan:cheer:diet',
      })

      friendActions.cancelUnfriend()
      expect(getFriendStoreState().unfriendTarget).toBeNull()

      // 再次发起并通过 handleUnfriend 完成解除
      friendActions.selectFriend('user-ayou', { nickname: '阿柚' })
      friendActions.requestUnfriend({ userId: 'user-ayou', nickname: '阿柚' })
      friendActions.handleUnfriend('user-ayou')
      expect(getFriendStoreState().viewingFriendId).toBeNull()
      expect(getFriendStoreState().viewingFriendNickname).toBeNull()
      expect(getFriendStoreState().unfriendTarget).toBeNull()
    })
  })
})
