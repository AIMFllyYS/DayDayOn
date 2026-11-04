import type { Metadata } from 'next'
import { SheetDemo } from '../_components/component-demos'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import { SmartActionBarShowcase } from '../_components/smart-action-bar'
import {
  GlobalSmartRecognitionDemo,
  UnifiedModuleCheckinTabDemo,
} from '../_components/smart-recognition-demos'
import {
  CheckinModeTabsMatrix,
  FiveModulesSubComponentMatrix,
  ModuleDetectorStatesMatrix,
  ScannerLensStatesMatrix,
} from './_components/atomic-specimens'

export const metadata: Metadata = { title: '智能打卡' }

export default function SmartCheckinPlaybookPage() {
  return (
    <>
      <PageHeader
        title="智能识别与全板块打卡"
        description="将打卡入口弹层底部的单按钮升级为浅色系双按钮（智能拍照 + 智能上传），并拆解出独立的「智能识别页面」与全板块统一的「手动填写 | 智能拍照 | 智能上传」Tab 架构：由极简手账扫描镜、一行识别方向条与 5 大板块独立填充子组件模块化拼装而成。"
        docRef="ui-design-system.md · ai-and-quota.md · ADR-0002"
      />

      <Section
        ann="playbook.smart.action-bar"
        title="01 · 打卡弹层底栏双按钮（SmartActionBar · 三套浅色方案对比）"
        description="原打卡弹层底部的单按钮「拍照记一餐」拆分为左右并列的原子组件 <SmartActionBar />（左：智能拍照，右：智能上传）。严禁使用深色实底，提供 A 微差暖调（默认推荐）、B 同色温润、C 奶油描边三套浅色手账方案，并在下方直接接入真实打卡弹层供预览。"
      >
        <div className="flex flex-col gap-4">
          <SmartActionBarShowcase />
          <Specimen
            ann="playbook.smart.action-bar.sheet"
            label="接入打卡入口弹层（Sheet 实装效果）"
            note="点击打开「记录点什么？」弹层，体验 5 大目标列表 + 底部左右浅色双按钮"
          >
            <SheetDemo />
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.smart.scanner-states"
        title="02 · 扫描镜原子组件（SmartScannerLens · 四态极简头部）"
        description="顶部仅保留左侧扫描状态指示与右侧唯一「重新扫描」按钮，不堆砌「重拍」「传图」多余小标签，也不展示文件名路径；视窗内呼吸扫描光束配合下方 3 步实时分析轨迹。"
      >
        <ScannerLensStatesMatrix />
      </Section>

      <Section
        ann="playbook.smart.detector"
        title="03 · 第 1 核心组件：板块智能判别器（SmartModuleDetector · 一行识别方向条）"
        description="仅在「全局智能识别页面」（未知板块）挂载。去掉冗余的把握度百分比与长段解释，将 5 大打卡方向浓缩在一行胶囊条内：AI 自动高亮识别方向，用户也可在同行内一键点选切换。"
      >
        <ModuleDetectorStatesMatrix />
      </Section>

      <Section
        ann="playbook.smart.subcomponents"
        title="04 · 第 2 核心组件：5 大打卡板块专属填充子组件全景矩阵（每行 2 卡 · 1:1 手机宽度）"
        description="按运动、饮食、睡眠、学习、自定义拆分为 5 个独立子组件，由 5 项静态字典 smartModuleFillComponents（Record<ModuleTone, Component>）索引。采用每行 2 张卡片布局（约 412px 真实手机宽度）且表单内部全单列垂直排布，彻底杜绝窄列挤压溢出。"
      >
        <FiveModulesSubComponentMatrix />
      </Section>

      <Section
        ann="playbook.smart.mode-tabs"
        title="05 · 全板块统一顶部 Tab 栏（CheckinModeTabs）"
        description="每一个单独的打卡板块页面顶部都配备完全一致的「手动填写（默认） | 智能拍照 | 智能上传」Tab 栏。在单板块页面内切到智能拍照或智能上传时，因为已经明确知道当前属于哪个打卡方向，直接跳过第 1 组件（一行识别方向条），import 扫描镜 + 对应板块子组件即可。"
      >
        <CheckinModeTabsMatrix />
      </Section>

      <Section
        ann="playbook.smart.global-sandbox"
        title="06 · 联动沙盒 A：全局「智能识别页面」完整交互流（手机框实机展示）"
        description="在左侧 360px 手机外框中展示 `/checkin/smart` 完整二级页面（扫描镜 + 一行识别方向条 + 5 选 1 板块填充子组件）。可通过右侧控制台切换 5 种样本或上传本地文件。"
      >
        <GlobalSmartRecognitionDemo />
      </Section>

      <Section
        ann="playbook.smart.module-sandbox"
        title="07 · 联动沙盒 B：单板块打卡页内切换 Tab 交互流（手机框实机展示）"
        description="在左侧 360px 手机外框中展示 `/goals/[goalId]/checkin` 独立板块打卡页。切换顶部 Tab 至「智能拍照 / 智能上传」时直接跳过一行识别方向条，扫描后直接填入当前板块表单。"
      >
        <UnifiedModuleCheckinTabDemo />
      </Section>

      <Section ann="playbook.smart.rules" title="智能识别与打卡设计守则">
        <Rules
          dos={[
            '打卡弹层底部双按钮必须使用 90%+ 明度的浅色手账色系（推荐 duo-warm 微差暖调或 twin-soft 同色温润），保持纸面轻盈感',
            '扫描镜（SmartScannerLens）顶部只保留左侧状态与右侧「重新扫描」，不放「重拍」「传图」多余标签，不展示冗长文件名路径',
            '板块判别器（SmartModuleDetector）采用「一行识别方向胶囊条」样式，不显示把握度百分比，5 大板块同行排开、点选秒切',
            '5 大板块填充子组件内部字段一律采用单列垂直流（NumberField、TimeRangeField 独占一行），在 Playbook 中以每行 2 卡（真实手机宽度）展示',
            '单板块打卡页顶部统一配备 <CheckinModeTabs />，切到智能模式时直接跳过一行识别方向条，复用扫描镜 + 当前板块子组件',
            '严守 ADR-0002：用户照片只在内存压缩后直传 deepseek-flash，永不落盘；AI 结果一律先填入表单草稿，用户点确认后才入库盖章',
          ]}
          donts={[
            '不要在扫描镜顶部堆砌多个操作小标签或显示本地文件名/路径',
            '不要在板块判别器上展示「把握度 91%」等技术指标或长篇解释文本',
            '不要在 Playbook 中把复杂表单塞进 3 列窄网格或把 NumberField 塞进半宽双列导致横向溢出',
            '不要在已知所属板块的单板块打卡页里重复渲染「一行识别方向条」',
          ]}
        />
      </Section>
    </>
  )
}
