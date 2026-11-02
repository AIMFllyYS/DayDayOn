import type { Metadata } from 'next'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import {
  ChatBubbleStatesDemo,
  FeedCardsShowcase,
  NotificationBellBadge,
  SafetyModerationDemo,
  TwoLevelNotificationCenterDemo,
} from './_components/social-demos'

export const metadata: Metadata = { title: '消息与社交' }

export default function SocialPlaybookPage() {
  return (
    <>
      <PageHeader
        title="消息与社交"
        description="好友小窝通知引擎、手机端优先的两级消息中心（一级消息列表 → 二级详情/1v1 好友私聊）、5 分钟打卡动态聚合、宠物轻互动回礼，以及纯本地 DFA 敏感词温柔拦截与解除好友只读归档规范。"
        docRef="ui-design-system.md · Epic #18 (Issues #19–#26)"
      />

      <Section
        ann="playbook.social.bell"
        title="顶栏铃铛与未读角标（Issue #20）"
        description="主页顶栏右上角铃铛按钮。无论是轻量红点还是数字角标（最大 99+），统一使用不随主题色切换改变的柔和浅红底色（bg-danger #e06464）配纯白文字（text-on-primary #fffaf3），符合手机系统直觉。"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Specimen
            ann="playbook.social.bell.empty"
            label="无未读（默认）"
            note="unreadCount = 0"
            bg="paper"
          >
            <NotificationBellBadge unreadCount={0} />
          </Specimen>
          <Specimen
            ann="playbook.social.bell.dot"
            label="轻量红点"
            note="仅造访足迹等弱提醒"
            bg="paper"
          >
            <NotificationBellBadge hasLightDot />
          </Specimen>
          <Specimen
            ann="playbook.social.bell.count"
            label="数字角标（1–99）"
            note="互动提醒 / 好友私信"
            bg="paper"
          >
            <NotificationBellBadge unreadCount={3} />
            <NotificationBellBadge unreadCount={18} />
          </Specimen>
          <Specimen
            ann="playbook.social.bell.overflow"
            label="溢出态（99+）"
            note="unreadCount > 99 时截断"
            bg="paper"
          >
            <NotificationBellBadge unreadCount={128} />
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.social.two-level-app"
        title="两级消息与通知中心（Issue #20 · #26 · Decision #4 & #6）"
        description="手机端优先采用独立两级页面结构：点击铃铛先进入第 1 级「消息总列表」（置顶通知频道 + 好友私聊列表，行尾带未读红点与摘要）；再次点击某一行钻取进入第 2 级详情页或 1v1 聊天室。桌面端（≥1024px）自动自适应为「左列表 + 右详情」双栏视图。可点击下方列表体验钻取、发送鼓励语、内嵌举报及「已解除好友（南风）」的只读冻结状态。"
      >
        <TwoLevelNotificationCenterDemo />
      </Section>

      <Section
        ann="playbook.social.feed-cards"
        title="通知动态卡片与防刷屏聚合（Issue #19 · #22）"
        description="5 分钟内同一好友连续完成多项打卡时，自动合并为单张聚合卡片；同一好友 24 小时内多次切换查看你的房间只静默更新一条足迹。"
      >
        <FeedCardsShowcase />
      </Section>

      <Section
        ann="playbook.social.chat-states"
        title="1v1 私聊气泡状态机与空状态（Issue #25 · #26）"
        description="对方发来的气泡为暖白色（bg-surface），我方发出的气泡采用当前主题色的浅色底（bg-primary-soft）配深褐护眼文字；已读、发送中、未送达重试等状态统一置于我方气泡左侧外部。"
      >
        <ChatBubbleStatesDemo />
      </Section>

      <Section
        ann="playbook.social.safety"
        title="内容安全：本地 DFA 温柔拦截与禁言冷却（Issue #23 · #24）"
        description="纯本地内存级 DFA 词库匹配（零外部 API 开销、不扣减 DeepSeek AI 额度）。触发拦截时以温和横幅提示并保留用户输入草稿，不清空输入框；举报功能采用内嵌视图切换，绝不在弹层内再叠二级弹窗。"
      >
        <SafetyModerationDemo />
      </Section>

      <Section ann="playbook.social.rules" title="消息与社交设计守则">
        <Rules
          dos={[
            '未读红点与数字角标固定采用柔和浅红底（bg-danger）+ 纯白字（text-on-primary），不随主题色切换变色',
            '1v1 聊天中对方气泡用暖白底（bg-surface），我方气泡用当前主题浅色底（bg-primary-soft）+ 深色字，已读/发送中/重试状态统一放在我方气泡左侧外部',
            '手机端严格采用「一级消息总列表 → 二级具体详情/会话」两级钻取，二级页面隐藏底部主导航并在顶栏左上角提供返回按钮',
            '桌面端（≥1024px）采用左侧消息列表（320px）+ 右侧详情/聊天面板的双栏自适应布局',
            '解除好友后保留历史私聊记录供只读查阅，底部输入栏置灰显示「你们已解除好友关系，无法继续发送消息」',
            '同一好友 5 分钟内的连续打卡合并为 1 张动态卡；24 小时内的重复造访合并为 1 条脚印',
            '敏感词拦截时保留输入框文字不清空，举报交互在面板内原地切换视图',
          ]}
          donts={[
            '不要让未读角标跟随主题色变成绿点/棕点，也不要在角标或深色气泡里使用黑色文字',
            '不要用高饱和深色（bg-primary）作为我方聊天长文气泡底色，避免阅读刺眼',
            '不要在 Sheet / Dialog 里再弹出二级 Modal（严禁弹层套弹层）',
            '不要在好友私聊中开放图片、语音、视频、文件上传（服务器零媒体落盘铁律）',
            '不要因敏感词校验消耗用户的 DeepSeek AI 额度，也不要在日志里记录被拦截的明文内容',
          ]}
        />
      </Section>
    </>
  )
}
