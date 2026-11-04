import type { ReactNode } from 'react'
import type { IconName } from '@/components/ui/icon'
import type { ModuleTone, Tone } from '@/components/ui/tone'

/**
 * 打卡流程（PhoneFlow）的数据契约。
 * 五个板块共用同一套页面骨架：菜单 → 独立填写页 → 结果弹窗 → 分析页；
 * 「达标规则」「评判依据」是标签，点开进二级文档页。板块只提供数据，不改版式。
 */

/** 与全站统一的打卡模式 Tab（CheckinModeTabs）同一套取值 */
export type FlowMode = 'manual' | 'smart-capture' | 'smart-upload'

export interface DocSection {
  heading: string
  items: string[]
}

/** 二级文档页：规则与依据这类「像文档的内容」不挤在填写页，放进标签后的独立页面 */
export interface DocPageSpec {
  title: string
  sections: DocSection[]
}

export interface Verdict {
  passed: boolean
  /** 底部一行说明：「本餐 4.8 分，超过 3.0 分有效线」 */
  detail: string
  /** 评分结论卡右侧的大数字，例如「4.8」；没有分数的板块不传 */
  score?: string
  /** 分数下方的小字，例如「/ 5.0」 */
  scoreHint?: string
}

export interface FolderRow {
  label: string
  value: string
  sub?: string
  /** 0–1，有值时画一条进度条 */
  ratio?: number
  tone?: Tone
}

export interface ReportCheck {
  text: string
  ok: boolean
  /** 依据来源，例如「《中国居民膳食指南 2022》」 */
  source?: string
}

/** 分析页里的「文件夹」：顶部是标签，点开看明细，可以嵌套 */
export interface FolderSpec {
  id: string
  title: string
  icon: IconName
  tone?: Tone
  /** 报告里是否默认展开；不写则前两张展开 */
  defaultOpen?: boolean
  /** 折叠时就能看到的一句话结论 */
  headline: string
  badge?: { text: string; tone: Tone }
  rows?: FolderRow[]
  children?: FolderSpec[]
  checks?: ReportCheck[]
  note?: string
}

export interface ReportSpec {
  title: string
  folders: FolderSpec[]
}

export interface FillSectionSpec {
  id: string
  label: string
  icon: IconName
  /** 折叠时显示的当前值 */
  summary: string
  filled: boolean
  content: ReactNode
}

export interface FlowScenario {
  id: string
  /** 标签：A / B / C / D */
  code: string
  title: string
  description: string
  passed: boolean
}

export interface PhoneFlowConfig {
  tone: ModuleTone
  /** 通用名：「科学饮食打卡」，不带天数、不带具体目标 */
  title: string
  progress: { done: number; total: number }
  /** Agent 思考步骤（逐条流出）；不传则用通用步骤 */
  agentSteps?: string[]
  rulesDoc: DocPageSpec
  basisDoc: DocPageSpec
}
