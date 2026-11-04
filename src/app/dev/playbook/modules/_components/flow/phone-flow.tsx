'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, softToneClass, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import {
  CheckinModeTabs,
  SMART_PRESETS,
  SmartScannerLens,
  type ScanPhase,
} from '../../../_components/smart-recognition-demos'
import { FillSection } from './fill-section'
import { Collapse, FolderCard } from './folder-card'
import type {
  DocPageSpec,
  FillSectionSpec,
  FlowMode,
  FolderSpec,
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
              'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pt-3',
              agent === 'none' ? 'pb-28' : agentOpen ? 'pb-96' : 'pb-48',
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
          </div>

          {/* 固定在底部（不随内容滚动）：Agent 抽屉 + 玻璃拟态操作条 */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 px-3 pb-3">
            {agent !== 'none' && (
              <AgentDrawer
                steps={steps}
                stepIdx={stepIdx}
                done={agent === 'done'}
                open={agentOpen}
                onToggle={() => setAgentOpen((v) => !v)}
                folders={report.folders}
                recognized={smart ? aiSummary : undefined}
                verdict={verdict}
              />
            )}
            <div className="border-border/60 bg-background/55 shadow-float pointer-events-auto rounded-2xl border p-2 backdrop-blur-md">
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
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3.5 pb-6">
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
              <FolderCard key={f.id} spec={f} defaultOpen={i === 0} />
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

/**
 * Agent 分析抽屉：从底部圆角处向上弹出，默认展开，胶囊右侧的按钮可折叠 / 展开。
 * 里面是 Agent 的思考步骤（逐条流出），完成后给出各项分析结果与结论。
 */
function AgentDrawer({
  steps,
  stepIdx,
  done,
  open,
  onToggle,
  folders,
  recognized,
  verdict,
}: {
  steps: string[]
  stepIdx: number
  done: boolean
  open: boolean
  onToggle: () => void
  folders: FolderSpec[]
  recognized?: string
  verdict: Verdict
}) {
  const shown = done ? steps : steps.slice(0, Math.min(stepIdx + 1, steps.length))
  return (
    <div
      className="border-border bg-surface/90 shadow-float animate-fade-up pointer-events-auto rounded-3xl border backdrop-blur-md"
      data-ann="playbook.modules.flow.agent"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center gap-2.5 px-3.5 text-left"
      >
        <span className="bg-primary-soft text-primary-ink grid size-7 shrink-0 place-items-center rounded-full">
          <Icon
            name={done ? 'sparkles' : 'loader'}
            size={14}
            className={cn(!done && 'animate-spin-slow')}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption font-bold">Agent 分析</span>
          <span className="text-tiny text-muted">{done ? '分析完成' : '正在解析…'}</span>
        </span>
        <span className="bg-surface-sunken text-muted grid size-7 shrink-0 place-items-center rounded-full">
          <Icon
            name="chevron-down"
            size={14}
            className={cn('transition-transform duration-(--dur-base)', open && 'rotate-180')}
          />
        </span>
      </button>
      <Collapse open={open}>
        <div className="flex max-h-64 flex-col gap-3 overflow-y-auto px-3.5 pb-3.5">
          <ol className="flex flex-col gap-1.5">
            {shown.map((s, i) => {
              const finished = done || i < stepIdx
              return (
                <li key={s} className="text-tiny flex items-center gap-2">
                  <Icon
                    name={finished ? 'check' : 'loader'}
                    size={12}
                    className={cn(
                      'shrink-0',
                      finished ? 'text-success' : 'text-primary animate-spin-slow',
                    )}
                  />
                  <span className={finished ? 'text-muted' : 'text-foreground font-semibold'}>
                    {s}
                  </span>
                </li>
              )
            })}
          </ol>
          {done && (
            <div className="border-border flex flex-col gap-2 border-t border-dashed pt-3">
              {recognized && <ResultRow label="识别内容" value={recognized} />}
              {folders.map((f) => (
                <ResultRow key={f.id} label={f.title} value={f.headline} />
              ))}
              <p
                className={cn(
                  'text-tiny mt-1 rounded-xl px-3 py-2 font-semibold',
                  verdict.passed
                    ? 'bg-success-soft text-success-ink'
                    : 'bg-warning-soft text-warning-ink',
                )}
              >
                {verdict.detail}
              </p>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-tiny text-muted shrink-0">{label}</span>
      <span className="text-tiny text-right font-bold">{value}</span>
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
