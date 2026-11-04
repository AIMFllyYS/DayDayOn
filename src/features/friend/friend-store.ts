'use client'

import { useSyncExternalStore } from 'react'

/*
 * 好友体系全局交互状态（ADR-0026）：
 * - viewingFriendId：主页仪表盘视角（null = 我自己，非空 = 查看指定好友的只读仪表盘）
 * - addSheetOpen：控制「添加好友」底部抽屉开关
 * - meteorFlight：接受好友邀请后，从屏幕正中央飞向左上角头像的流星动画状态
 * - avatarPopping：流星抵达左上角时触发头像堆叠 Q 弹展开状态
 * - hintBubbleOpen：添加好友完成后左上角头像下方的气泡引导提示
 */

export interface MeteorFlight {
  id: number
  friendUserId: string
  friendNickname: string
  friendAvatar: string | null
}

export interface UnfriendTarget {
  userId: string
  nickname: string
  avatar?: string | null
}

export interface FriendStoreState {
  viewingFriendId: string | null
  viewingFriendNickname: string | null
  viewingFriendAvatar: string | null
  addSheetOpen: boolean
  unfriendTarget: UnfriendTarget | null
  meteorFlight: MeteorFlight | null
  avatarPopping: boolean
  hintBubbleOpen: boolean
}

const INITIAL_STATE: FriendStoreState = {
  viewingFriendId: null,
  viewingFriendNickname: null,
  viewingFriendAvatar: null,
  addSheetOpen: false,
  unfriendTarget: null,
  meteorFlight: null,
  avatarPopping: false,
  hintBubbleOpen: false,
}

let state: FriendStoreState = INITIAL_STATE
const listeners = new Set<() => void>()
let popTimer: ReturnType<typeof setTimeout> | null = null
let hintTimer: ReturnType<typeof setTimeout> | null = null

function setState(patch: Partial<FriendStoreState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const friendActions = {
  selectFriend: (
    friendUserId: string | null,
    meta?: { nickname?: string | null; avatar?: string | null },
  ) => {
    if (hintTimer) {
      clearTimeout(hintTimer)
      hintTimer = null
    }
    setState({
      viewingFriendId: friendUserId,
      viewingFriendNickname: friendUserId ? (meta?.nickname ?? null) : null,
      viewingFriendAvatar: friendUserId ? (meta?.avatar ?? null) : null,
      hintBubbleOpen: false,
    })
  },
  openAddSheet: () => {
    setState({ addSheetOpen: true })
  },
  closeAddSheet: () => {
    setState({ addSheetOpen: false })
  },
  requestUnfriend: (friend: UnfriendTarget) => {
    setState({ unfriendTarget: friend, hintBubbleOpen: false })
  },
  cancelUnfriend: () => {
    setState({ unfriendTarget: null })
  },
  launchAcceptMeteor: (friend: { userId: string; nickname: string; avatar: string | null }) => {
    setState({
      addSheetOpen: false,
      meteorFlight: {
        id: Date.now(),
        friendUserId: friend.userId,
        friendNickname: friend.nickname,
        friendAvatar: friend.avatar,
      },
    })
  },
  completeMeteorFlight: () => {
    if (popTimer) clearTimeout(popTimer)
    if (hintTimer) clearTimeout(hintTimer)
    setState({
      meteorFlight: null,
      avatarPopping: true,
      hintBubbleOpen: true,
    })
    popTimer = setTimeout(() => {
      setState({ avatarPopping: false })
    }, 520)
    hintTimer = setTimeout(() => {
      setState({ hintBubbleOpen: false })
    }, 7000)
  },
  dismissHintBubble: () => {
    if (hintTimer) {
      clearTimeout(hintTimer)
      hintTimer = null
    }
    if (!state.hintBubbleOpen) return
    setState({ hintBubbleOpen: false })
  },
  /**
   * 解除好友关系后的全局状态清理：
   * 若当前主页仪表盘正处于被解除好友的视角，立即重置回 null（"我"）
   */
  handleUnfriend: (friendUserId: string) => {
    const isViewing = state.viewingFriendId === friendUserId
    const isTarget = state.unfriendTarget?.userId === friendUserId
    if (isViewing) {
      if (hintTimer) {
        clearTimeout(hintTimer)
        hintTimer = null
      }
    }
    setState({
      ...(isViewing
        ? {
            viewingFriendId: null,
            viewingFriendNickname: null,
            viewingFriendAvatar: null,
            hintBubbleOpen: false,
          }
        : {}),
      ...(isTarget ? { unfriendTarget: null } : {}),
    })
  },
  onFriendRemoved: (friendUserId: string) => {
    const isViewing = state.viewingFriendId === friendUserId
    const isTarget = state.unfriendTarget?.userId === friendUserId
    if (isViewing) {
      if (hintTimer) {
        clearTimeout(hintTimer)
        hintTimer = null
      }
    }
    setState({
      ...(isViewing
        ? {
            viewingFriendId: null,
            viewingFriendNickname: null,
            viewingFriendAvatar: null,
            hintBubbleOpen: false,
          }
        : {}),
      ...(isTarget ? { unfriendTarget: null } : {}),
    })
  },
}

export function handleUnfriend(friendUserId: string): void {
  friendActions.handleUnfriend(friendUserId)
}

export function onFriendRemoved(friendUserId: string): void {
  friendActions.onFriendRemoved(friendUserId)
}

export function getFriendStoreState(): FriendStoreState {
  return state
}

export function useFriendStore(): FriendStoreState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )
}
