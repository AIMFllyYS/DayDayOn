import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FriendSummary } from '../schemas'
import { FriendRoomBanner } from './friend-room-banner'

const baseFriend: FriendSummary = {
  userId: 'u_friend_ayou',
  nickname: '阿柚',
  avatar: 'mascot:tuan:cheer:exercise',
  mascot: 'tuan',
  streak: 14,
  todayDone: 3,
  todayPlanned: 3,
  todayMood: 5,
  createdAt: '2026-10-20T00:00:00.000Z',
}

describe('FriendRoomBanner 串门只读小窝横幅', () => {
  it('渲染正在串门的好友昵称与连续打卡天数', () => {
    const html = renderToStaticMarkup(<FriendRoomBanner friend={baseFriend} onBack={() => {}} />)
    expect(html).toContain('正在串门 阿柚 的小窝')
    expect(html).toContain('连续 14 天')
    expect(html).toContain('返回我的主页')
    expect(html).toContain('陪伴伙伴：团团')
  })

  it('当好友今日打卡全部达标时，宠物呈现欢呼神态与达成文案', () => {
    const html = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, todayDone: 3, todayPlanned: 3 }}
        onBack={() => {}}
      />,
    )
    expect(html).toContain('太棒啦！阿柚今天目标全部达成！')
  })

  it('当好友今日尚未开始打卡时，宠物呈现犯困打瞌睡提示文案', () => {
    const html = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, todayDone: 0, todayPlanned: 3 }}
        onBack={() => {}}
      />,
    )
    expect(html).toContain('阿柚今天还没动静，待会儿再来看看吧～')
  })

  it('当好友今日为休息日 (todayPlanned === 0) 时，呈现悠闲陪伴文案', () => {
    const html = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, todayDone: 0, todayPlanned: 0 }}
        onBack={() => {}}
      />,
    )
    expect(html).toContain('今天 阿柚 休息，团团陪你晒太阳～')
  })

  it('当好友伴宠为其他角色（如墩墩、绵绵、柚柚）时，正确显示对应伙伴名称', () => {
    const dunHtml = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, nickname: '豆豆', mascot: 'dun' }}
        onBack={() => {}}
      />,
    )
    expect(dunHtml).toContain('正在串门 豆豆 的小窝')
    expect(dunHtml).toContain('陪伴伙伴：墩墩')

    const mianHtml = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, nickname: '七七', mascot: 'mian' }}
        onBack={() => {}}
      />,
    )
    expect(mianHtml).toContain('正在串门 七七 的小窝')
    expect(mianHtml).toContain('陪伴伙伴：绵绵')

    const youHtml = renderToStaticMarkup(
      <FriendRoomBanner
        friend={{ ...baseFriend, nickname: '南风', mascot: 'you' }}
        onBack={() => {}}
      />,
    )
    expect(youHtml).toContain('正在串门 南风 的小窝')
    expect(youHtml).toContain('陪伴伙伴：柚柚')
  })
})
