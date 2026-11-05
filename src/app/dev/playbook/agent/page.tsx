import type { Metadata } from 'next'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { ChangeDraftCard } from '@/features/agent/components/change-draft-card'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { UserMessage } from '@/features/agent/components/user-message'
import { AgentPlayback, ErrorTurnDemo } from '../_components/agent-demos'
import { BoundedPetStage, EdgeStates, PanelLayoutDemo } from '../_components/floating-agent-demos'
import { EditableDraftDemo, QuotaCardDemo, RecognizerPhasesDemo } from './_d6-demos'
import { MobilePreviewDemo } from './_mobile-demos'
import { manyToolsTurn, quickTurn, runningTurn } from '../_components/agent-script'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import {
  GlobalSmartRecognitionDemo,
  UnifiedModuleCheckinTabDemo,
} from '../_components/smart-recognition-demos'

export const metadata: Metadata = { title: 'Agent 组件' }

const anatomy = [
  {
    name: '活动条',
    part: 'reasoning + tool-*',
    body: '一行：正在做什么 + 按步分组的工具小方块；点开是时间线',
  },
  { name: '正文', part: 'text', body: '流式输出带光标；只支持分段和加粗' },
  { name: '产物', part: '（业务组件）', body: 'AI 草稿卡、图表，放在正文后面' },
  { name: '来源', part: 'source-url', body: '联网时引用的网页，去重后编号' },
  { name: '错误', part: 'status = error', body: '原因 + 重试，替代后续内容' },
]

export default function AgentPage() {
  return (
    <>
      <PageHeader
        title="Agent 组件"
        description="一次回复里的思考、工具调用和文字输出是同一个回合，用 <AgentTurn> 一起呈现。工具再多，过程也只占一行，回答才是重点。"
        docRef="ui-design-system.md 第 8 节"
      />

      <Section
        ann="playbook.agent.playback"
        title="完整过程回放"
        description="拍照识别午餐：3 个工具并行估算 → 搜索补充（其中一个网页打不开）→ 读取资料和今日记录 → 回答 → 草稿确认。推理过程进行中自动展开，回答出来后自动收起成一行。"
      >
        <AgentPlayback />
      </Section>

      <Section
        ann="playbook.agent.mobile"
        title="手机端紧凑布局与不可折行族群防溢出（360px 模拟视口）"
        description="头部身份栏置顶让出 44px 横向空间；正文缩微至 14px (text-caption)；5 列表格、KaTeX 长公式、Mermaid 脑图、长代码块在各自容器内局部左右横划，严格阻断全局溢出。"
      >
        <MobilePreviewDemo />
      </Section>

      <Section
        ann="playbook.agent.anatomy"
        title="回合结构"
        description="对应 AI SDK UIMessage 的 parts。按 step-start 分步：同一步里的多个工具是并行发出的。"
      >
        <ol className="grid gap-2 sm:grid-cols-5">
          {anatomy.map((a, i) => (
            <li key={a.name} className="border-border bg-surface rounded-2xl border p-3">
              <p className="font-display text-tiny text-primary-ink font-semibold">0{i + 1}</p>
              <p className="font-semibold">{a.name}</p>
              <p className="text-tiny text-muted font-mono">{a.part}</p>
              <p className="text-tiny text-muted mt-1">{a.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        ann="playbook.agent.many-tools"
        title="工具很多时"
        description="4 步 12 个工具：收起时只显示最近 5 个方块和 +N；同一步的方块叠在一起，失败的带红点。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            data-ann="playbook.agent.many-tools.collapsed"
            className="flex min-w-0 flex-col gap-2"
          >
            <p className="text-tiny text-muted font-semibold">完成后（自动收起）</p>
            <UserMessage>帮我总结一下这周</UserMessage>
            <AgentTurn turn={manyToolsTurn} />
          </div>
          <div
            data-ann="playbook.agent.many-tools.expanded"
            className="flex min-w-0 flex-col gap-2"
          >
            <p className="text-tiny text-muted font-semibold">展开时间线</p>
            <AgentTurn turn={manyToolsTurn} traceOpen />
          </div>
        </div>
      </Section>

      <Section ann="playbook.agent.states" title="状态">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.agent.states.submitted"
            label="submitted"
            note="已发出，还没有任何输出"
            bg="paper"
          >
            <AgentTurn turn={{ id: 's', status: 'submitted', parts: [] }} className="w-full" />
          </Specimen>
          <Specimen
            ann="playbook.agent.states.running"
            label="streaming · 并行工具"
            note="活动条描述当前在做的事"
            bg="paper"
          >
            <AgentTurn turn={runningTurn} className="w-full" />
          </Specimen>
          <Specimen
            ann="playbook.agent.states.quick"
            label="done · 没有工具"
            note="只有思考时活动条更短"
            bg="paper"
          >
            <AgentTurn turn={quickTurn} className="w-full" />
          </Specimen>
          <Specimen
            ann="playbook.agent.states.error"
            label="error"
            note="点重试回到 submitted"
            bg="paper"
          >
            <div className="w-full">
              <ErrorTurnDemo />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.agent.draft"
        title="AI 草稿卡"
        description="AI 结果先是草稿，用户确认后才入库。把握度低于 0.6 时提示核对，并提供“手动填写”。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <AiDraftCard
            module="exercise"
            title="慢跑 · 07:10"
            confidence={0.91}
            estimate
            fields={[
              { label: '时长', value: '32 分钟' },
              { label: '强度', value: '中等（MET 7）' },
              { label: '消耗', value: '约 196 kcal', hint: '按体重 52.4kg 计算' },
            ]}
          />
          <AiDraftCard
            module="sleep"
            title="睡眠截图解析"
            confidence={0.48}
            estimate
            fields={[
              { label: '入睡', value: '00:40' },
              { label: '起床', value: '07:55' },
              { label: '深睡', value: '1 小时 12 分', hint: '截图里这一项比较模糊' },
            ]}
          />
        </div>
      </Section>

      <Section
        ann="playbook.agent.draft-edit"
        title="可编辑的饮食草稿"
        description="传 items 时草稿卡逐项列出，点“修改”可以改名称、份量、热量，可删可加；合计自动重算。热量初值取 AI 区间的中值。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <EditableDraftDemo />
        </div>
      </Section>

      <Section
        ann="playbook.agent.draft-verdict"
        title="草稿卡上的裁判结论"
        description="对话里记打卡和打卡页走同一套裁判：草稿卡确认前就显示「达标 · 计入进度」或「未达标 · 只存档」，以及饮食分数和没过的检查项。没有事实时标「按规则估算」。用户改过饮食条目后，结论条换成提示，入库时按新条目重新判定。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <AiDraftCard
            module="diet"
            title="好好吃饭"
            confidence={0.88}
            estimate
            fields={[
              { label: '番茄炒蛋', value: '220 kcal', hint: '一盘' },
              { label: '米饭', value: '230 kcal', hint: '一碗约 200 克' },
              { label: '合计', value: '450 kcal' },
            ]}
            verdict={{
              isValid: true,
              score: 4.2,
              scoreMax: 5,
              detail: '蛋白和主食都有，蔬菜少了点',
              offline: false,
              checks: [
                { text: '蛋白质 ≥ 20 克', ok: true },
                { text: '有一份蔬菜', ok: false },
              ],
              advice: ['下一餐加一份绿叶菜'],
            }}
          />
          <AiDraftCard
            module="exercise"
            title="动一动"
            confidence={0.9}
            estimate
            fields={[
              { label: '饭后散步', value: '10 分钟 · 0.6 公里' },
              { label: '估算消耗', value: '约 32 千卡' },
            ]}
            verdict={{
              isValid: false,
              score: null,
              scoreMax: null,
              detail: '时长和距离都没到门槛，算日常活动',
              offline: true,
              checks: [
                { text: '时长 ≥ 20 分钟', ok: false },
                { text: '距离 ≥ 2 公里', ok: false },
              ],
              advice: [],
            }}
          />
        </div>
      </Section>

      <Section
        ann="playbook.agent.draft-change"
        title="改打卡 / 删打卡草稿"
        description="团团只能改、删今天和昨天的打卡。卡片写清哪天的哪条、为什么改、改前改后的内容和是否达标；删除用危险色按钮。确认后才调修改 / 删除接口，改动和删除都会留痕。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ChangeDraftCard
            mode="update"
            module="diet"
            title="好好吃饭"
            dateLabel="今天 11月5日"
            reason="米饭记多了，其实是半碗"
            before={{
              summary: '午餐：番茄炒蛋、米饭 · 450 千卡',
              note: null,
              isValid: true,
              score: 3.6,
            }}
            after={{
              summary: '午餐：番茄炒蛋、米饭 · 335 千卡',
              note: null,
              isValid: true,
              score: 4.1,
            }}
            fields={[
              { label: '番茄炒蛋', value: '220 kcal' },
              { label: '米饭（半碗）', value: '115 kcal' },
            ]}
            verdict={{
              isValid: true,
              score: 4.1,
              scoreMax: 5,
              detail: '主食减半后热量更合适',
              offline: false,
              checks: [{ text: '热量在这一餐的建议范围', ok: true }],
              advice: [],
            }}
          />
          <ChangeDraftCard
            mode="delete"
            module="exercise"
            title="动一动"
            dateLabel="昨天 11月4日"
            reason="重复记了一次"
            before={{
              summary: '慢跑 30 分钟 5 公里 · 约 310 千卡',
              note: '和小林一起',
              isValid: true,
              score: null,
            }}
          />
        </div>
      </Section>

      <Section
        ann="playbook.agent.smart-page"
        title="智能识别页面（扫描镜 + 组件 1 板块判别 + 组件 2 五板块子组件）"
        description="从打卡弹层底部点击「智能拍照」或「智能上传」进入。顶部扫描镜持续扫描上传的图片或纯文本（HTML / TXT / MD）并实时显示分析步骤；下方由【组件 1：板块智能判别器】判断归属板块，并动态挂载【组件 2：5 选 1 板块专属填充子组件】自动填入识别数值。"
      >
        <GlobalSmartRecognitionDemo />
      </Section>

      <Section
        ann="playbook.agent.module-tabs"
        title="单板块打卡页 · 统一 Tab 栏（跳过板块判别，直接复用子组件）"
        description="5 大打卡板块（运动 / 饮食 / 睡眠 / 学习 / 自定义）顶部统一配备「手动填写 | 智能拍照 | 智能上传」Tab。由于在单板块页内已知当前所属方向，切换到「智能拍照 / 智能上传」时直接跳过板块判别器，import 扫描镜 + 对应板块子组件完成识别填表。"
      >
        <UnifiedModuleCheckinTabDemo />
      </Section>

      <Section
        ann="playbook.agent.diet-recognizer"
        title="拍照识别饮食（原单板块草稿流）"
        description="正式组件 DietRecognizer 的展示部分：识别中活动条展开（“正在看照片”），完成后收起，草稿卡接在后面；失败给出原因和“手动填写”。"
      >
        <RecognizerPhasesDemo />
      </Section>

      <Section
        ann="playbook.agent.quota-card"
        title="额度卡（我的页）"
        description="QuotaMeter + 加购余额 + “兑换额度”抽屉 + “使用记录”抽屉。演示里以 DDON 开头的码算兑换成功。"
      >
        <QuotaCardDemo />
      </Section>

      <Section
        ann="playbook.agent.quota"
        title="AI 额度"
        description="显示“还剩多少”。金额用整数微元传入，组件只负责展示。"
      >
        <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <QuotaMeter
            weeklyLimitMicro={10_000_000}
            weeklyUsedMicro={3_420_000}
            bonusMicro={10_000_000}
          />
          <QuotaMeter
            weeklyLimitMicro={2_000_000}
            weeklyUsedMicro={1_760_000}
            resetText="新人周额度"
          />
        </div>
      </Section>

      <Section
        ann="playbook.agent.floating"
        title="悬浮团团（Agent 入口）"
        description="应用内常驻的小宠物。点一下打开弹窗、按住拖动、长按一直晃悠、双击转圈；离边缘 24px 以内才吸附并露半个脑袋。底部被 Dock 栏挡住，不能拖进去。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex justify-center">
            <BoundedPetStage />
          </div>
          <div className="flex flex-col gap-3">
            <EdgeStates />
            <p className="text-caption text-muted">
              在右边这个框里直接拖动团团试试：靠近左右上三边会自动吸附，停在中间就停在原地。
              顶部吸附时它会倒立，往下看两下。
            </p>
          </div>
        </div>
      </Section>

      <Section
        ann="playbook.agent.panel"
        title="对话弹窗"
        description="从团团所在的角落弹出：手机顶部留 1/4、左侧留 1/5；桌面是右下角卡片。顶部小导航栏：全屏放大 / 团团 / 历史 / 新对话 / 关闭。打开期间团团隐藏。"
      >
        <div className="flex justify-center">
          <PanelLayoutDemo />
        </div>
      </Section>

      <Section ann="playbook.agent.rules" title="规则">
        <Rules
          dos={[
            '进行中默认展开推理过程，回答完成后自动收起成一行；用户手动开合过就以用户为准',
            '同一步的工具并行展示，失败的直接显示原因和降级方案',
            '工具中文名、进行时说法、图标在 tool-meta.ts 登记',
            '联网结果附上来源；热量、睡眠类结果标注“估算结果，非医疗建议”',
            '写操作一律出草稿，用户确认后才调普通接口；改、删只限今天和昨天的打卡',
            '对话里记的打卡和打卡页用同一套裁判，草稿卡上先显示结论',
          ]}
          donts={[
            '不要给每个工具一张大卡片',
            '不要自动保存 AI 结果，也不要展示原始图片',
            '不要在过程里显示 token 数、模型名等技术细节',
            '不要在弹层里再开弹层（历史用下拉菜单）',
          ]}
        />
      </Section>
    </>
  )
}
