'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import { PetAvatar } from '@/features/agent/components/pet-avatar'
import type { AgentPart, AgentTurnView } from '@/features/agent/types'
import { PET_SIZE } from '@/features/agent/use-pet-drag'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, softToneClass, type ModuleTone, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import {
  CheckinModeTabs,
  SMART_PRESETS,
  SmartScannerLens,
  type ScanPhase,
} from '../../../_components/smart-recognition-demos'
import { FillSection } from './fill-section'
import { FolderCard } from './folder-card'
import type {
  DocPageSpec,
  FillSectionSpec,
  FlowMode,
  PhoneFlowConfig,
  ReportSpec,
  Verdict,
} from './flow-types'

type Page = 'fill' | 'rules' | 'basis' | 'report'

interface PhoneFlowProps {
  config: PhoneFlowConfig
  /** Tab 栏下面常驻的主选择器：饮食的餐次、运动的类型。没有就不传 */
  selector?: ReactNode
  sections: FillSectionSpec[]
  /** 智能识别完成后的一行结论：「午餐 · 3 道菜」 */
  aiSummary: string
  verdict: Verdict
  /** 内容没填够时主按钮置灰 */
  canSubmit: boolean
  report: ReportSpec
  /** 切换记录方式时通知板块：手动 → 清空；智能 → 载入当前场景的识别结果 */
  onModeChange: (mode: FlowMode) => void
  /** 盖在整个手机屏幕上的板块专属浮层（设置页、加餐时间卡等） */
  overlay?: ReactNode
}

/**
 * 打卡页（手机内）。进来就是填写页，不再先过一层菜单：
 *   标题行（左：通用名；右：「达标规则」「评判依据」两个小标签 + 天数）
 *   → 记录方式 Tab（手动填写 | 智能拍照 | 智能上传，全站统一）
 *   → 主选择器（餐次 / 运动类型）
 *   → 折叠分区（一次只开一个，整页不用滚动）
 *   → 最底固定「有效打卡」按钮。
 * 打卡后弹窗，进入分析页（文件夹）；两个小标签点开是二级文档页。
 * 用 key={场景 id} 挂载：切换场景时整个流程回到初始状态。
 */
export function PhoneFlow({
  config,
  selector,
  sections,
  aiSummary,
  verdict,
  canSubmit,
  report,
  onModeChange,
  overlay,
}: PhoneFlowProps) {
  const [stack, setStack] = useState<Page[]>(['fill'])
  const [mode, setMode] = useState<FlowMode>('smart-capture')
  const [openId, setOpenId] = useState<string | null>(null)
  // 智能模式的扫描阶段；Agent 分析阶段（手动提交后、或智能扫描完成后自动开始）
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [agent, setAgent] = useState<'none' | 'analyzing' | 'done'>('none')
  const [stepIdx, setStepIdx] = useState(0)
  const [agentOpen, setAgentOpen] = useState(true)
  const [popup, setPopup] = useState(false)
  const [bonus, setBonus] = useState(0)
  const page = stack[stack.length - 1] ?? 'fill'
  const smart = mode !== 'manual'
  const steps = config.agentSteps ?? DEFAULT_AGENT_STEPS

  // 智能扫描完成 → 自动交给 Agent 分析
  useEffect(() => {
    if (scanPhase !== 'scanning') return
    const t = setTimeout(() => {
      setScanPhase('done')
      setStepIdx(0)
      setAgent('analyzing')
      setAgentOpen(true)
    }, 1400)
    return () => clearTimeout(t)
  }, [scanPhase])

  // Agent 思考步骤逐条流出，全部出完后进入「分析完成」
  useEffect(() => {
    if (agent !== 'analyzing') return
    if (stepIdx >= steps.length) {
      const t = setTimeout(() => setAgent('done'), 450)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStepIdx((i) => i + 1), 600)
    return () => clearTimeout(t)
  }, [agent, stepIdx, steps.length])

  const push = (p: Page) => setStack((s) => [...s, p])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  function changeMode(next: FlowMode) {
    if (next === mode) return
    setMode(next)
    onModeChange(next)
    // 手动：先填内容，第一个分区直接展开；智能：先看上传 / 拍照区
    setOpenId(next === 'manual' ? (sections[0]?.id ?? null) : null)
    setScanPhase('idle')
    setAgent('none')
    setStepIdx(0)
  }

  /** 手动：提交后内容区折叠，底部抽屉弹出 Agent 分析 */
  function startAnalyze() {
    setOpenId(null)
    setStepIdx(0)
    setAgentOpen(true)
    setAgent('analyzing')
  }

  function startScan() {
    setAgent('none')
    setScanPhase('scanning')
  }

  function confirm() {
    if (verdict.passed) setBonus((b) => b + 1)
    setPopup(true)
  }

  function resetAfterDone() {
    setPopup(false)
    setAgent('none')
    setStepIdx(0)
    setScanPhase('idle')
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {page === 'fill' && (
        <>
          <PageBar title={`${moduleMeta[config.tone].label}打卡`} onBack={() => undefined} />

          <div className="shrink-0 px-3.5 pt-1">
            <Card
              className="flex items-center gap-3 px-3 py-0.5"
              data-ann="playbook.modules.flow.header"
            >
              <IconTile icon={moduleMeta[config.tone].icon} tone={config.tone} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-caption truncate font-bold">{config.title}</span>
                <div className="flex items-center gap-1.5">
                  <TagChip
                    tone="success"
                    icon="shield"
                    label="达标规则"
                    onClick={() => push('rules')}
                  />
                  <TagChip
                    tone="primary"
                    icon="bulb"
                    label="评判依据"
                    onClick={() => push('basis')}
                  />
                </div>
              </div>
              <ProgressRing
                value={config.progress.done + bonus}
                max={config.progress.total}
                tone={config.tone}
                size={52}
                thickness={5}
                label={`打卡周期 ${config.progress.done + bonus}/${config.progress.total} 天`}
                className="shrink-0"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-tiny font-display leading-none font-bold">DAY</span>
                  <span className="text-tiny font-display leading-none font-bold whitespace-nowrap tabular-nums">
                    {config.progress.done + bonus}/{config.progress.total}
                  </span>
                </span>
              </ProgressRing>
            </Card>
          </div>

          <SectionDivider />

          <div className="flex shrink-0 flex-col gap-2.5 px-3.5">
            <CheckinModeTabs value={mode} onValueChange={(m) => changeMode(m)} />
            {selector}
          </div>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pt-3 [&>*]:shrink-0',
              agent !== 'none' && agentOpen ? 'pb-96' : 'pb-28',
            )}
          >
            {smart ? (
              <SmartScannerLens
                preset={SMART_PRESETS[config.tone]}
                phase={scanPhase}
                mode={mode}
                tone={config.tone}
                onRescan={startScan}
              />
            ) : (
              sections.map((s) => (
                <FillSection
                  key={s.id}
                  spec={s}
                  tone={config.tone}
                  open={openId === s.id}
                  ai={false}
                  onToggle={() => {
                    // 再次展开内容 = 要改内容，之前的分析作废
                    if (openId !== s.id && agent !== 'none') setAgent('none')
                    setOpenId((cur) => (cur === s.id ? null : s.id))
                  }}
                />
              ))
            )}
            {agent === 'done' && (
              <div className="flex flex-col gap-2.5" data-ann="playbook.modules.flow.report-inline">
                <ReportDivider />
                {smart && <p className="text-tiny text-muted px-1 pb-1">识别内容：{aiSummary}</p>}
                {report.folders.map((f, i) => (
                  <FolderCard key={f.id} spec={f} defaultOpen={f.defaultOpen ?? i <= 1} />
                ))}
              </div>
            )}
          </div>

          {/* 固定在底部（不随内容滚动）：Agent 抽屉 + 玻璃拟态操作条 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col">
            {agent !== 'none' && (
              <AgentDrawer
                turn={buildAgentTurn(config.tone, steps, stepIdx, agent === 'done')}
                done={agent === 'done'}
                open={agentOpen}
                onToggle={() => setAgentOpen((v) => !v)}
                verdict={verdict}
              />
            )}
            <div className="border-border/60 bg-background/55 pointer-events-auto rounded-t-lg border-t px-3.5 pt-2.5 pb-4 backdrop-blur-md">
              {!smart && agent === 'none' ? (
                <Button
                  icon="sparkles"
                  className="w-full"
                  disabled={!canSubmit}
                  onClick={startAnalyze}
                  data-ann="playbook.modules.flow.submit"
                >
                  提交并 Agent 自动解析
                </Button>
              ) : scanPhase === 'scanning' || agent === 'analyzing' ? (
                <Button className="w-full" loading data-ann="playbook.modules.flow.submit">
                  {agent === 'analyzing' ? 'Agent 解析中…' : '识别中…'}
                </Button>
              ) : (
                <Button
                  variant={agent === 'done' && !verdict.passed ? 'secondary' : 'primary'}
                  icon={agent === 'done' && !verdict.passed ? 'alert' : 'check'}
                  className="w-full"
                  disabled={agent !== 'done'}
                  onClick={confirm}
                  data-ann="playbook.modules.flow.submit"
                >
                  {agent === 'done' && !verdict.passed
                    ? '仅保存记录（不计有效打卡）'
                    : '确认有效打卡'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {(page === 'rules' || page === 'basis') && (
        <>
          <PageBar
            title={(page === 'rules' ? config.rulesDoc : config.basisDoc).title}
            onBack={back}
          />
          <DocBody doc={page === 'rules' ? config.rulesDoc : config.basisDoc} />
        </>
      )}

      {page === 'report' && (
        <>
          <PageBar title={report.title} onBack={back} />
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-6">
            <div
              className={cn(
                'text-tiny mb-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 font-semibold',
                verdict.passed
                  ? 'bg-success-soft text-success-ink'
                  : 'bg-warning-soft text-warning-ink',
              )}
            >
              <Icon name={verdict.passed ? 'check-double' : 'alert'} size={16} />
              {verdict.detail}
            </div>
            {report.folders.map((f, i) => (
              <FolderCard key={f.id} spec={f} defaultOpen={f.defaultOpen ?? i === 0} />
            ))}
          </div>
        </>
      )}

      {popup && (
        <div
          className="bg-foreground/30 absolute inset-0 z-20 flex items-end"
          role="dialog"
          aria-label="打卡结果"
        >
          <div className="bg-surface animate-fade-up flex w-full flex-col items-center gap-3 rounded-t-3xl px-5 pt-6 pb-6 text-center">
            <div className="relative">
              <Mascot mood={verdict.passed ? 'cheer' : 'sleepy'} size={72} />
              {verdict.passed && (
                <Stamp
                  text="已达标"
                  caption="有效卡"
                  tone={config.tone}
                  animate
                  size={54}
                  className="absolute -top-2 -right-12"
                />
              )}
            </div>
            <div>
              <p className="text-subhead font-bold">
                {verdict.passed ? '打卡成功，连击 +1' : '已存档，今天先不盖章'}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button
                icon="chart"
                className="w-full"
                onClick={() => {
                  setPopup(false)
                  push('report')
                }}
                data-ann="playbook.modules.flow.view-report"
              >
                查看分析
              </Button>
              <Button variant="ghost" className="w-full" onClick={resetAfterDone}>
                完成
              </Button>
            </div>
          </div>
        </div>
      )}

      {overlay}
    </div>
  )
}

/** 标题行右侧的小标签：点开进二级文档页 */
function TagChip({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: IconName
  label: string
  tone: Tone
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[0.625rem] leading-none font-semibold whitespace-nowrap transition-all hover:brightness-95 active:scale-95',
        softToneClass[tone],
      )}
    >
      <Icon name={icon} size={9} />
      {label}
    </button>
  )
}

const DEFAULT_AGENT_STEPS = [
  '读取你提交的内容',
  '对照达标规则逐项核验',
  '联网核验权威资料',
  '生成分析结果与评分',
]

/** 每个板块 Agent 会调用的工具（名字取自 features/agent/tool-meta.ts，图标和文案由 ActivityTrail 自动渲染） */
const AGENT_TOOLS: Record<ModuleTone, string[]> = {
  diet: ['webSearch', 'estimateFoodNutrition'],
  exercise: ['lookupMet', 'calcExerciseKcal'],
  sleep: ['getDaySummary', 'listCheckins'],
  study: ['listCheckins', 'webSearch'],
  custom: ['listGoals', 'draftCheckin'],
}

/** 把流程里的分析进度，翻译成路由里 Agent 原子组件吃的 AgentTurnView（结论不走文字气泡，由 VerdictCard 单独呈现） */
function buildAgentTurn(
  tone: ModuleTone,
  steps: string[],
  stepIdx: number,
  done: boolean,
): AgentTurnView {
  const parts: AgentPart[] = [
    { type: 'step-start' },
    {
      type: 'reasoning',
      id: 'r1',
      text: steps[0] ?? '',
      state: done || stepIdx >= 1 ? 'done' : 'streaming',
    },
  ]
  AGENT_TOOLS[tone].forEach((toolName, i) => {
    if (!done && stepIdx < i + 1) return
    const finished = done || stepIdx > i + 1
    parts.push({
      type: 'tool',
      id: `t${i}`,
      toolName,
      state: finished ? 'output-available' : 'input-available',
      summary: steps[i + 1],
      durationMs: finished ? 400 + i * 300 : undefined,
    })
  })
  return {
    id: 'agent-flow',
    status: done ? 'done' : 'streaming',
    parts,
    durationMs: (stepIdx + 1) * 600,
  }
}

const STATIC_PET = {
  position: { left: 0, top: 0, edge: 'none' as const },
  swaying: false,
  spinning: false,
  peeking: false,
  dragging: false,
}

/**
 * Agent 分析抽屉：贴在底部操作条上方，圆角小；头部右侧是状态徽章 + 折叠按钮。
 * 折叠后缩成真实项目里的小宠物（PetAvatar），点它再展开。
 * 思考与工具调用复用路由里的 <AgentTurn>（整体 zoom 缩小一档），完成后追加评分结论卡；
 * 完整的分析报告在页面内容区里，不塞在抽屉里。
 */
function AgentDrawer({
  turn,
  done,
  open,
  onToggle,
  verdict,
}: {
  turn: AgentTurnView
  done: boolean
  open: boolean
  onToggle: () => void
  verdict: Verdict
}) {
  if (!open) {
    return (
      <div
        className="pointer-events-auto flex justify-end px-3 pb-2"
        data-ann="playbook.modules.flow.agent"
      >
        <button
          type="button"
          aria-label="展开 Agent 分析"
          onClick={onToggle}
          className="animate-fade-up relative active:scale-95"
          style={{ width: PET_SIZE, height: PET_SIZE }}
        >
          <PetAvatar pet={STATIC_PET} size={PET_SIZE} />
          <span
            className={cn(
              'ring-surface absolute top-0 right-0 size-3 rounded-full ring-2',
              done ? 'bg-success' : 'bg-primary animate-pulse',
            )}
          />
        </button>
      </div>
    )
  }
  return (
    <div className="pointer-events-auto px-3 pb-2" data-ann="playbook.modules.flow.agent">
      <div className="border-border bg-surface/90 shadow-float animate-fade-up rounded-xl border backdrop-blur-md">
        <button
          type="button"
          aria-expanded
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-2 px-3.5 py-2.5 text-left"
        >
          <span className="text-caption min-w-0 flex-1 truncate font-bold">Agent 分析</span>
          <Badge tone={done ? 'success' : 'primary'} icon={done ? 'check' : 'loader'}>
            {done ? '已完成' : '解析中'}
          </Badge>
          <span className="bg-surface-sunken text-muted grid size-7 shrink-0 place-items-center rounded-full">
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
        <div className="max-h-64 overflow-y-auto px-3.5 pb-3">
          <div className="flex [zoom:0.88] flex-col gap-2.5">
            <AgentTurn turn={turn} />
            {done && <VerdictCard verdict={verdict} />}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 内容区里「备注」下面的分隔栏：两侧渐细的线 + 中间小标题，下面是完整的分析报告 */
function ReportDivider() {
  return (
    <div className="flex items-center gap-2.5 py-2" aria-hidden>
      <span className="bg-border h-[3px] flex-1 [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
      <span className="text-tiny text-muted font-bold">分析报告</span>
      <span className="bg-border h-[3px] flex-1 [clip-path:polygon(0_0,100%_50%,0_100%)]" />
    </div>
  )
}

/** 评分结论卡：达标 = 绿，未达标 = 红；有分数时右侧放大显示 */
function VerdictCard({ verdict }: { verdict: Verdict }) {
  return (
    <div
      role="status"
      data-ann="playbook.modules.flow.verdict"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        verdict.passed
          ? 'border-success/40 bg-success-soft text-success-ink'
          : 'border-danger/40 bg-danger-soft text-danger-ink',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full',
          verdict.passed ? 'bg-success text-on-primary' : 'bg-danger text-on-primary',
        )}
      >
        <Icon name={verdict.passed ? 'check' : 'x'} size={16} lineOnly strokeWidth={2.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption font-bold">{verdict.passed ? '达标' : '未达标'}</span>
        <span className="text-tiny leading-snug opacity-90">{verdict.detail}</span>
      </span>
      {verdict.score && (
        <span className="font-display flex shrink-0 flex-col items-end leading-none font-bold">
          <span className="text-heading tabular-nums">{verdict.score}</span>
          {verdict.scoreHint && (
            <span className="text-tiny mt-1 font-semibold opacity-80">{verdict.scoreHint}</span>
          )}
        </span>
      )}
    </div>
  )
}

/** 顶部返回栏：安卓规范的紧凑样式，返回箭头 + 小标题 */
function PageBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2.5 pt-10 pb-2 max-sm:pt-4">
      <IconButton icon="chevron-left" label="返回" size="sm" onClick={onBack} />
      <h2 className="text-subhead min-w-0 flex-1 truncate font-bold">{title}</h2>
    </div>
  )
}

function DocBody({ doc }: { doc: DocPageSpec }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 pb-6"
      data-ann="playbook.modules.flow.doc"
    >
      {doc.sections.map((s) => (
        <section key={s.heading} className="border-border bg-surface rounded-2xl border p-3.5">
          <h3 className="text-caption mb-2 font-bold">{s.heading}</h3>
          <ul className="flex flex-col gap-1.5">
            {s.items.map((it) => (
              <li key={it} className="text-tiny text-muted flex items-start gap-2 leading-relaxed">
                <Icon name="check" size={13} className="text-success mt-0.5 shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Badge tone="neutral" icon="alert">
        估算结果，非医疗建议
      </Badge>
    </div>
  )
}

/** 模块之间的分隔线：整行宽、很浅，中间略粗、两端渐细 */
function SectionDivider() {
  return (
    <div
      aria-hidden
      className="bg-border mx-3.5 my-2 h-[3px] shrink-0 [clip-path:polygon(0_50%,50%_0,100%_50%,50%_100%)]"
    />
  )
}
