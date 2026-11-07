import type { ReactNode } from 'react'
import type { ModuleTone } from '@/components/ui/tone'
import type { RulesOf, Verdict } from '@/features/referee/schemas'
import type { Module } from '@/features/shared/schemas'
import type { DocGlance } from '../flow/doc-page'
import type { DocPageSpec, FillSectionSpec, ReportSpec } from '../flow/types'
import type { CheckinClock, CheckinGoal } from '../components/form-types'
import type { Checkin, CreateCheckinInput } from '../schemas'
import type { SmartRecognitionDraft } from '../smart-schemas'

/*
 * 打卡板块的定义（checkin-modules.md 第 2 节）。一个板块 = 一个目录，导出一个 CheckinModuleDef，
 * 由 registry.ts 汇总；CheckinFlow 只认这个接口，不知道具体是哪个板块。
 */

/** 板块表单 hook 的返回：骨架往里填什么、怎么组装请求体 */
export interface ModuleFormApi {
  /** Tab 栏下面常驻的主选择器（饮食的餐次） */
  selector?: ReactNode
  /** 当前激活的子维度键值（饮食的 mealType），切换时用于同步该子维度的已入库状态 */
  activeKey?: string
  /** 当前填写的备注文本（供智能拍照/智能上传扫描镜共享上下文） */
  note?: string
  /** 排在最前面的分区（饮食的「加餐时间」） */
  leadSection?: FillSectionSpec | null
  sections: FillSectionSpec[]
  /** 手动模式下排在分区后面（运动的「+ 添加一项运动」） */
  afterSections?: ReactNode
  /** 盖在整页上的浮层（常用标签设置） */
  overlay?: ReactNode
  /** 值变了就展开那个分区（刚添加的那一项） */
  autoOpen?: string | null
  canSubmit: boolean
  /** 智能识别后的一行结论：「午餐 · 3 道菜」 */
  aiSummary: string
  /** 当前内容 → 创建打卡请求体（骨架再补 isMakeup / source / aiRunId / facts） */
  toInput: () => CreateCheckinInput | null
  /** 智能识别草稿 → 填进表单，并返回填好之后的请求体（骨架拿它直接交给 Agent，不等下一次渲染） */
  applySmart: (draft: SmartRecognitionDraft) => CreateCheckinInput | null
}

export interface ModuleFormProps {
  goal: CheckinGoal
  clock: CheckinClock
  /** 今天的打卡日 */
  today: string
  /** 今天已入库的打卡记录（凌晨 0 点前重进页面或切换餐次时直接读取恢复状态） */
  todayCheckins?: readonly Checkin[]
}

export interface ModuleDocs {
  glance: DocGlance
  rulesDoc: DocPageSpec
  basisDoc: DocPageSpec
}

export interface RulesEditorProps<M extends Module = Module> {
  rules: RulesOf<M>
  onChange: (next: RulesOf<M>) => void
  goal: CheckinGoal
}

export interface CheckinModuleDef<M extends Module = Module> {
  module: M
  tone: ModuleTone
  /** 通用名：「科学饮食打卡」 */
  title: string
  /** Agent 抽屉在还没收到工具调用时显示的步骤 */
  agentSteps: string[]
  useForm: (props: ModuleFormProps) => ModuleFormApi
  /** 目标设置页与新人引导共用的规则面板（checkin-modules.md 第 5 节） */
  RulesEditor: (props: RulesEditorProps<M>) => ReactNode
  /** 规则 → 二级页文档（阈值随用户设置变化） */
  docs: (rules: RulesOf<M>, goal: CheckinGoal) => ModuleDocs
  /** 裁判结论 + 请求体 → 分析页的文件夹 */
  buildReport: (verdict: Verdict, input: CreateCheckinInput, goal: CheckinGoal) => ReportSpec
}
