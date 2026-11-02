import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatRoom } from './chat-room'

/*
 * ChatRoom 1v1 好友私聊会话室组件测试（Issue #25 · #26 · Decision #4 & #6）
 * 1. 空状态呈现（伴宠犯困打瞌睡 + 温暖引导文案）
 * 2. 消息流与外部左侧状态机（我方已读 check-double、已送达 check、对方头像与时间）
 * 3. 解除好友只读归档（Decision #6）：冻结横幅呈现、输入框禁用文案
 */

const mockQueryState = vi.hoisted(() => ({
  data: {
    messages: [] as Array<{
      id: string
      senderId: string
      recipientId: string
      content: string
      createdAt: string
      readAt: string | null
      isMine: boolean
    }>,
    nextCursor: null as string | null,
    isFrozen: false,
    friend: {
      userId: 'u_friend_ayou',
      nickname: '阿柚',
      avatar: 'mascot:tuan:cheer:diet',
    },
  },
  isLoading: false,
}))

vi.mock('@/lib/api/queries/chat', () => ({
  useChatMessages: () => ({
    data: mockQueryState.data,
    isLoading: mockQueryState.isLoading,
    refetch: vi.fn(),
  }),
  useSendChatMessage: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

beforeEach(() => {
  mockQueryState.isLoading = false
  mockQueryState.data = {
    messages: [],
    nextCursor: null,
    isFrozen: false,
    friend: {
      userId: 'u_friend_ayou',
      nickname: '阿柚',
      avatar: 'mascot:tuan:cheer:diet',
    },
  }
})

describe('ChatRoom 组件渲染与状态机', () => {
  it('1. 空状态下呈现陪伴伙伴与指引文案', () => {
    const html = renderToStaticMarkup(
      <ChatRoom
        friendUserId="u_friend_ayou"
        friendNickname="阿柚"
        friendAvatar="mascot:tuan:cheer:diet"
      />,
    )
    expect(html).toContain('信箱干干净净')
    expect(html).toContain('送出一句今日鼓励，或者和好友聊聊今天的打卡心得吧～')
    expect(html).toContain('阿柚')
  })

  it('2. 正常聊天记录：我方消息呈现左侧状态（已读 / 已送达），对方消息呈现头像与时间', () => {
    mockQueryState.data.messages = [
      {
        id: 'msg-1',
        senderId: 'u_me',
        recipientId: 'u_friend_ayou',
        content: '我刚刚完成了跑步打卡！',
        createdAt: '2026-11-02T12:00:00.000Z',
        readAt: '2026-11-02T12:05:00.000Z',
        isMine: true,
      },
      {
        id: 'msg-2',
        senderId: 'u_friend_ayou',
        recipientId: 'u_me',
        content: '太棒啦！我正在背单词～',
        createdAt: '2026-11-02T12:06:00.000Z',
        readAt: null,
        isMine: false,
      },
    ]

    const html = renderToStaticMarkup(
      <ChatRoom
        friendUserId="u_friend_ayou"
        friendNickname="阿柚"
        friendAvatar="mascot:tuan:cheer:diet"
        friendStreak={7}
      />,
    )

    // 验证连续打卡天数角标
    expect(html).toContain('7 天')
    // 验证我方消息内容与左侧已读状态
    expect(html).toContain('我刚刚完成了跑步打卡！')
    expect(html).toContain('已读')
    // 验证对方消息内容
    expect(html).toContain('太棒啦！我正在背单词～')
  })

  it('3. 解除好友只读归档（Decision #6）：展示冻结横幅且底部输入栏禁用', () => {
    mockQueryState.data.isFrozen = true
    mockQueryState.data.messages = [
      {
        id: 'msg-old',
        senderId: 'u_friend_ayou',
        recipientId: 'u_me',
        content: '这是曾经留下的珍贵鼓励',
        createdAt: '2026-10-30T10:00:00.000Z',
        readAt: '2026-10-30T10:01:00.000Z',
        isMine: false,
      },
    ]

    const html = renderToStaticMarkup(
      <ChatRoom
        friendUserId="u_friend_ayou"
        friendNickname="阿柚"
        friendAvatar="mascot:tuan:cheer:diet"
      />,
    )

    // 验证 Decision #6 冻结横幅与标签
    expect(html).toContain('双方已解除好友关系，历史聊天记录仅供存档查阅')
    expect(html).toContain('已解除好友 · 只读归档')
    expect(html).toContain('已解除好友关系，无法发送新消息')
    // 验证历史消息仍旧保留展示
    expect(html).toContain('这是曾经留下的珍贵鼓励')
  })
})
