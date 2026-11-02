'use client'

import { useState } from 'react'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { UserMessage } from '@/features/agent/components/user-message'
import type { AgentTurnView } from '@/features/agent/types'

/*
 * 移动端（360px 窄屏）适配与四大不可折行内容族群（表格/公式/导图/代码）防溢出演示。
 * 在 Playbook 中模拟极端窄屏环境，检验：
 *   1. 头部身份行（头像 + IP 名称 + 状态）让出横向空间；
 *   2. 正文等比例缩微至 14px (text-caption)，单行容纳更多字符；
 *   3. 5 列超宽表格、长公式、Mermaid 导图、长单行代码在各自容器内局部横划，绝对不撑爆外层对话视口。
 */

const RICH_MARKDOWN_DEMO = `我为你整理了今天与本周的完整数据分析：

### 今日打卡与工具执行汇总

| 工具名称 | 调用入参摘要 | 执行耗时 | 校验状态 | 返回结果概述 |
|---|---|---|---|---|
| getProfile | userId: current_user | 28ms | 正常通过 | 获取到性别、身高、体重基础资料 |
| queryGoals | range: "2026-11-02", active: true | 45ms | 正常通过 | 检索到 5 个常驻打卡目标 |
| calcCalories | met: 7.0, weight: 52.4kg, min: 32 | 12ms | 正常通过 | 估算慢跑热量消耗约为 196 kcal |
| draftCheckin | target: "exercise", val: 32min | 18ms | 草稿就绪 | 生成待确认打卡记录草稿 |

> 小提示：上面表格包含 5 列长文本，在 360px 手机屏上已设为舒适阈值，你可以在表格内左右滑动浏览全貌，外层对话完全不会晃动。

### 能量消耗估算公式

一碗米饭（150 克）的热量与运动消耗换算：

$$E_{\\text{total}} = \\sum_{i=1}^{n} (\\text{MET}_i \\times 3.5 \\times m_{\\text{body}} \\div 200 \\times t_i) + \\Delta E_{\\text{basal}}$$

### 本周计划思维导图

\`\`\`mermaid
mindmap
  root((本周打卡目标))
    跑步
      周一 3公里
      周三 5公里
      周六 慢跑放松
    饮食
      每天记午餐
      少喝含糖饮料
    睡眠
      晚上11点前入睡
      保证7小时深睡
\`\`\`

### 控制台核验代码

可以在控制台执行下面的指令验证记录：

\`\`\`ts
const record = await fetch('/api/v1/checkins/today?category=exercise&limit=10').then(res => res.json())
console.log("今日打卡同步结果:", record.data)
\`\`\`
`

const mobileTurnData: AgentTurnView = {
  id: 'mobile-demo-turn',
  status: 'done',
  durationMs: 820,
  parts: [
    {
      type: 'reasoning',
      id: 'r-1',
      text: '正在综合读取个人偏好与本周记录，并调用计算工具汇总数据…',
      state: 'done',
    },
    {
      type: 'tool',
      id: 'call-1',
      toolName: 'getUserProfile',
      state: 'output-available',
      input: { user: 'me' },
      output: { name: '羽升' },
    },
    {
      type: 'tool',
      id: 'call-2',
      toolName: 'listGoals',
      state: 'output-available',
      input: { active: true },
      output: { count: 5 },
    },
    {
      type: 'tool',
      id: 'call-3',
      toolName: 'draftCheckin',
      state: 'output-available',
      input: { goal: '跑步' },
      output: { draftId: 'd-123' },
    },
    {
      type: 'text',
      id: 't-1',
      text: RICH_MARKDOWN_DEMO,
      state: 'done',
    },
  ],
}

export function MobilePreviewDemo() {
  const [character, setCharacter] = useState<MascotCharacter>('dun')
  const [traceOpen, setTraceOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-caption text-muted font-semibold">切换形象：</span>
          <Button
            size="sm"
            variant={character === 'dun' ? 'primary' : 'secondary'}
            onClick={() => setCharacter('dun')}
          >
            墩墩
          </Button>
          <Button
            size="sm"
            variant={character === 'tuan' ? 'primary' : 'secondary'}
            onClick={() => setCharacter('tuan')}
          >
            团团
          </Button>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setTraceOpen(!traceOpen)}>
          {traceOpen ? '收起活动条时间线' : '展开活动条时间线'}
        </Button>
      </div>

      {/* 演示视口比对网格 */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* 左侧：360px 真实移动端视口模拟框 */}
        <div className="flex flex-col items-center">
          <div className="text-tiny text-muted mb-2 flex items-center gap-1.5 font-semibold">
            <span>📱 手机窄屏模拟视口 (360px)</span>
          </div>

          <div
            className="border-border bg-background shadow-card relative flex h-[680px] w-[360px] max-w-full flex-col overflow-hidden rounded-[2.5rem] border-4 p-3.5"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* 模拟手机顶栏 */}
            <div className="border-border mb-3 flex items-center justify-between border-b pb-2">
              <span className="font-display text-tiny text-foreground font-bold">9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="bg-foreground inline-block h-2 w-2 rounded-full" />
                <span className="bg-foreground inline-block h-2 w-3 rounded-sm" />
              </div>
            </div>

            {/* 对话消息流：贯穿到底部，底部留出浮动输入框的高度的安全 padding，允许向上滑动穿透 */}
            <div className="flex w-full max-w-full min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto pr-0.5 pb-24">
              <UserMessage>帮我整理今天的数据与工具执行记录</UserMessage>

              <AgentTurn character={character} turn={mobileTurnData} traceOpen={traceOpen}>
                <AiDraftCard
                  module="exercise"
                  title="慢跑 · 3 公里"
                  confidence={0.92}
                  estimate
                  fields={[
                    { label: '时长', value: '32 分钟' },
                    { label: '消耗', value: '约 196 kcal' },
                  ]}
                />
              </AgentTurn>
            </div>

            {/* 底部悬浮输入层：无任何独立实色背景，浮动挂载，消息向上滑时可从背后穿透滑过 */}
            <div className="pointer-events-none absolute right-3.5 bottom-3.5 left-3.5 z-10 flex flex-col gap-1.5">
              <div className="flex items-center justify-start pl-1">
                <span className="bg-surface/90 text-muted shadow-soft border-border text-tiny pointer-events-auto flex items-center gap-1 rounded-full border px-2.5 py-1 backdrop-blur-md">
                  <Icon name="bulb" size={12} lineOnly />
                  <span>深度思考</span>
                </span>
              </div>
              <div className="border-border bg-surface shadow-soft pointer-events-auto flex items-center gap-1.5 rounded-2xl border px-2 py-1">
                <span className="text-muted flex size-7 shrink-0 items-center justify-center">
                  <Icon name="camera" size={15} lineOnly />
                </span>
                <p className="text-caption text-subtle min-w-0 flex-1 truncate px-1 py-0 leading-6">
                  和{character === 'dun' ? '墩墩' : '团团'}说点什么…
                </p>
                <span className="bg-primary text-on-primary flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm">
                  <Icon name="arrow" size={13} lineOnly />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：说明与关键检验指标 */}
        <div className="bg-surface border-border flex flex-col justify-between rounded-2xl border p-4">
          <div className="space-y-4">
            <h3 className="text-subhead text-foreground font-semibold">
              移动端适配与防溢出检验清单
            </h3>

            <div className="space-y-2">
              <div className="bg-success-soft text-success-ink text-caption flex items-start gap-2 rounded-xl p-2.5">
                <span className="font-bold">✓</span>
                <div>
                  <strong>头部身份栏独立置顶</strong>： 头像由 34px 微调为 24px，右侧清晰标注「
                  {character === 'dun' ? '墩墩' : '团团'} · AI打卡搭子」，正文整体靠左下沉，释放
                  44px 横向宽度。
                </div>
              </div>

              <div className="bg-success-soft text-success-ink text-caption flex items-start gap-2 rounded-xl p-2.5">
                <span className="font-bold">✓</span>
                <div>
                  <strong>字号等比例缩微</strong>： 正文气泡采用 14px（<code>text-caption</code>
                  ），单行汉字容量提升 ~25%，文字排版不再局促碎行。
                </div>
              </div>

              <div className="bg-success-soft text-success-ink text-caption flex items-start gap-2 rounded-xl p-2.5">
                <span className="font-bold">✓</span>
                <div>
                  <strong>输入区去白底与穿透滑动</strong>：
                  彻底移除输入框背后的实色白色底盒，输入层改为纯浮动挂载（
                  <code>absolute bottom-0</code>
                  ），向上滑动消息流时文字从深度思考与输入框背后穿透滑过，沉浸通透。
                </div>
              </div>

              <div className="bg-success-soft text-success-ink text-caption flex items-start gap-2 rounded-xl p-2.5">
                <span className="font-bold">✓</span>
                <div>
                  <strong>不可折行四大族群局部横滑</strong>： 在左侧模拟机中尝试滑动{' '}
                  <strong>5 列表格</strong>、<strong>长能量公式</strong>、
                  <strong>Mermaid 脑图</strong> 与 <strong>代码块</strong>
                  ，仅各组件内部横向滚动，外部手机视口与对话流 100% 保持不动！
                </div>
              </div>

              <div className="bg-success-soft text-success-ink text-caption flex items-start gap-2 rounded-xl p-2.5">
                <span className="font-bold">✓</span>
                <div>
                  <strong>手势防穿透保护</strong>： 所有局部滚动容器均带有{' '}
                  <code>overscroll-x-contain</code>
                  ，在移动端左右滑动到底时不会误触发浏览器的上一页/下一页手势。
                </div>
              </div>
            </div>
          </div>

          <div className="border-border text-tiny text-muted mt-4 border-t pt-3">
            注：该演示直接引用正式组件 <code>&lt;AgentTurn&gt;</code> 与{' '}
            <code>&lt;Markdown&gt;</code>，样式与全屏 /agent 及悬浮 AgentPanel 保持 100% 统一。
          </div>
        </div>
      </div>
    </div>
  )
}
