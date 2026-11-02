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
        description="主页顶栏右上角铃铛按钮。区分「轻量动态红点（如好友来访脚印）」与「强交互未读数（如被戳、被投喂、打卡提醒、好友新私信）」，最大显示 99+。"
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
        description="仅支持纯文本（≤300 字）与预设治愈贴纸/短语，绝不开放图片、语音或外链上传。发送采用 clientMsgId 幂等键乐观更新，网络失败时可原位点击重试。"
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
            '手机端严格采用「一级消息总列表 → 二级具体详情/会话」两级钻取，二级页面隐藏底部主导航并在顶栏左上角提供返回按钮',
            '桌面端（≥1024px）采用左侧消息列表（320px）+ 右侧详情/聊天面板的双栏自适应布局',
            '解除好友后保留历史私聊记录供只读查阅，底部输入栏置灰显示「你们已解除好友关系，无法继续发送消息」',
            '同一好友 5 分钟内的连续打卡合并为 1 张动态卡；24 小时内的重复造访合并为 1 条脚印',
            '宠物每日互动上限（戳戳 3 次 / 投喂 1 次 / 提醒打卡 1 次）统一按被互动好友的时区与 dayStartHour 计算自然日重置',
            '敏感词拦截时保留输入框文字不清空，举报交互在面板内原地切换视图',
          ]}
          donts={[
            '不要在 Sheet / Dialog 里再弹出二级 Modal（严禁弹层套弹层）',
            '不要在好友私聊中开放图片、语音、视频、文件上传（服务器零媒体落盘铁律）',
            '不要因敏感词校验消耗用户的 DeepSeek AI 额度，也不要在日志里记录被拦截的明文内容',
            '不要对今日已完成全部目标或今日无计划（0/0）的好友开放「提醒打卡」按钮',
          ]}
        />
      </Section>
    </>
  )
}
