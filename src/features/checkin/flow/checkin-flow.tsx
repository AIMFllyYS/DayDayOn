'use client'

import { useMemo, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta } from '@/components/ui/tone'
import { useRefereeRun } from '@/features/agent/use-referee-run'
import { effectiveRules } from '@/features/referee/defaults'
import { judge } from '@/features/referee/rules'
import type { RefereeTier, RulesOf, Verdict } from '@/features/referee/schemas'
import { judgeInputOf } from '@/features/referee/subject'
import type { Module } from '@/features/shared/schemas'
import { newIdempotencyKey } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { CheckinClock, CheckinGoal, SmartFillContext } from '../components/form-types'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
} from '../components/smart-scanner'
import type { CheckinModuleDef } from '../modules/types'
import type { Checkin, CreateCheckinInput } from '../schemas'
import { AgentDrawer, ReportDivider, SectionDivider } from './agent-drawer'
import { DocBody, PageBar, TagChip } from './doc-page'
import { FillSection } from './fill-section'
import { FolderCard } from './folder-card'
import type { FillSectionSpec } from './types'

/*
 * 打卡页骨架（checkin-modules.md 第 5 节，Playbook phone-flow 的正式版）：
 *   标题栏 → 头部卡（目标名 + 「达标规则」「评判依据」标签 + 周期环）→ 记录方式 Tab → 主选择器
 *   → 折叠分区 / 扫描镜 → 分析报告 → 底部 Agent 抽屉 + 玻璃拟态操作条 → 结果弹窗。
 * 板块只提供 CheckinModuleDef，这里不出现任何板块分支。
 */

type Page = 'fill' | 'rules' | 'basis' | 'report'

export interface CheckinFlowProps {
  def: CheckinModuleDef
  goal: CheckinGoal & { refereeRules: unknown }
  clock: CheckinClock
  today: string
  tier: RefereeTier
  /** 打卡周期：有效天数 / 周期总天数 */
  period: { done: number; total: number }
  initialMode: CheckinInputMode
  /** 确认入库；返回服务端重算后的记录 */
  onConfirm: (input: CreateCheckinInput) => Promise<Checkin>
  onBack: () => void
  onDone: () => void
}

export function CheckinFlow(props: CheckinFlowProps) {
  const { def, goal, clock, today, tier, period } = props
  const tone = def.tone
  const form = def.useForm({ goal, clock, today })
  const referee = useRefereeRun(goal.id)
  const rules = effectiveRules(def.module, goal.refereeRules) as RulesOf<Module>
  const docs = useMemo(() => def.docs(rules as never, goal), [def, rules, goal])

  const [stack, setStack] = useState<Page[]>(['fill'])
  const [mode, setMode] = useState<CheckinInputMode>(props.initialMode)
  const [openId, setOpenId] = useState<string | null>(
    props.initialMode === 'manual' ? (form.sections[0]?.id ?? null) : null,
  )
  const [indOpen, setIndOpen] = useState<Record<string, boolean>>({})
  const [seenAutoOpen, setSeenAutoOpen] = useState(form.autoOpen)
  if (form.autoOpen !== seenAutoOpen) {
    setSeenAutoOpen(form.autoOpen)
    setOpenId(form.autoOpen ?? null)
  }
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [smart, setSmart] = useState<SmartFillContext | null>(null)
  const [subject, setSubject] = useState<CreateCheckinInput | null>(null)
  const [agentOpen, setAgentOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Checkin | null>(null)
  const [popup, setPopup] = useState(false)
  const [bonus, setBonus] = useState(0)

  const page = stack[stack.length - 1] ?? 'fill'
  const isSmart = mode !== 'manual'
  const push = (p: Page) => setStack((s) => [...s, p])
  const back = () => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : props.onBack())

  // Agent 交卷就用 Agent 的结论；没交卷（额度不足、AI 暂停、模型没调 submitVerdict）就按规则离线判定
  const offlineVerdict = useMemo<Verdict | null>(() => {
    if (!subject || referee.status !== 'failed') return null
    return judge(
      judgeInputOf(subject, {
        timeZone: clock.timeZone,
        fields: goal.fields ?? null,
        storedRules: goal.refereeRules,
        facts: null,
        tier,
      }),
    )
  }, [subject, referee.status, clock.timeZone, goal.fields, goal.refereeRules, tier])
  const verdict = saved?.verdict ?? referee.verdict ?? offlineVerdict
  const agent: 'none' | 'analyzing' | 'done' =
    subject === null ? 'none' : referee.status === 'running' || !verdict ? 'analyzing' : 'done'

  function startAnalyze(override?: CreateCheckinInput | null) {
    const input = override ?? form.toInput()
    if (!input) return
    setOpenId(null)
    setIndOpen(
      Object.fromEntries(form.sections.filter((s) => s.independent).map((s) => [s.id, false])),
    )
    setAgentOpen(true)
    setSubject(input)
    referee.start(input, newIdempotencyKey())
  }

  function invalidateAnalysis() {
    if (subject === null) return
    setSubject(null)
    referee.reset()
  }

  function changeMode(next: CheckinInputMode) {
    if (next === mode) return
    setMode(next)
    setOpenId(next === 'manual' ? (form.sections[0]?.id ?? null) : null)
    setIndOpen({})
    setScanPhase('idle')
    invalidateAnalysis()
  }

  const isOpen = (s: FillSectionSpec) => (s.independent ? (indOpen[s.id] ?? true) : openId === s.id)
  function toggleSection(s: FillSectionSpec) {
    const open = isOpen(s)
    // 再次展开内容 = 要改内容，之前的分析作废
    if (!open) invalidateAnalysis()
    if (s.independent) setIndOpen((m) => ({ ...m, [s.id]: !open }))
    else setOpenId((cur) => (cur === s.id ? null : s.id))
  }

  async function confirm() {
    if (!subject || !verdict || saving) return
    setSaving(true)
    try {
      const result = await props.onConfirm({
        ...subject,
        ...(smart
          ? {
              source: 'ai' as const,
              aiRunId: smart.aiRunId,
              parsedText: smart.draft.summary.slice(0, 500),
            }
          : {}),
        ...(verdict.facts ? { facts: verdict.facts } : {}),
        ...(verdict.refereeRunId ? { refereeRunId: verdict.refereeRunId } : {}),
        ...(verdict.citations.length > 0 ? { citations: verdict.citations } : {}),
        ...(verdict.advice.length > 0 ? { advice: verdict.advice.map((a) => a.slice(0, 80)) } : {}),
      })
      setSaved(result)
      if (result.isValid) setBonus((b) => b + 1)
      setPopup(true)
    } catch {
      // 错误提示由 onConfirm 负责
    } finally {
      setSaving(false)
    }
  }

  const report = verdict && subject ? def.buildReport(verdict, subject, goal) : null
  const savedValid = saved?.isValid ?? verdict?.isValid ?? false

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden">
      {page === 'fill' && (
        <>
          <PageBar title={`${moduleMeta[tone].label}打卡`} onBack={back} />

          <div className="shrink-0 px-3.5 pt-1">
            <Card className="flex items-center gap-3 px-3 py-2">
              <IconTile icon={moduleMeta[tone].icon} tone={tone} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-caption truncate font-bold">{goal.title}</span>
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
                value={Math.min(period.done + bonus, period.total)}
                max={period.total}
                tone={tone}
                size={52}
                thickness={5}
                label={`打卡周期 ${period.done + bonus}/${period.total} 天`}
                className="shrink-0"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-tiny font-display leading-none font-bold">DAY</span>
                  <span className="text-tiny font-display leading-none font-bold whitespace-nowrap tabular-nums">
                    {period.done + bonus}/{period.total}
                  </span>
                </span>
              </ProgressRing>
            </Card>
          </div>

          <SectionDivider />

          <div className="flex shrink-0 flex-col gap-2.5 px-3.5">
            <CheckinModeTabs value={mode} onValueChange={changeMode} />
            {form.selector}
          </div>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pt-3 [&>*]:shrink-0',
              agent !== 'none' && agentOpen ? 'pb-96' : 'pb-28',
            )}
          >
            {form.leadSection && (
              <div key={form.leadSection.id} className="animate-fade-up">
                <FillSection
                  spec={form.leadSection}
                  tone={tone}
                  open={openId === form.leadSection.id}
                  ai={false}
                  onToggle={() => toggleSection(form.leadSection!)}
                />
              </div>
            )}
            {isSmart && (
              <SmartScannerLens
                mode={mode}
                hintModule={goal.module}
                goalId={goal.id}
                tone={tone}
                onScanStart={() => {
                  invalidateAnalysis()
                  setSmart(null)
                  setScanPhase('scanning')
                }}
                onRecognized={(res) => {
                  setSmart(res)
                  setScanPhase('done')
                  // 识别结果填进表单，同时直接交给 Agent 裁判
                  const next = form.applySmart(res.draft)
                  if (next) startAnalyze(next)
                }}
                onScanError={() => setScanPhase('idle')}
                onManualFallback={() => changeMode('manual')}
              />
            )}
            {(!isSmart || scanPhase === 'done') &&
              form.sections.map((s) => (
                <FillSection
                  key={s.id}
                  spec={s}
                  tone={tone}
                  open={isOpen(s)}
                  ai={isSmart && smart !== null}
                  onToggle={() => toggleSection(s)}
                />
              ))}
            {!isSmart && form.afterSections}
            {agent === 'done' && report && (
              <div className="flex flex-col gap-2.5">
                <ReportDivider />
                {isSmart && (
                  <p className="text-tiny text-muted px-1 pb-1">识别内容：{form.aiSummary}</p>
                )}
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
                turn={referee.turn}
                phase={agent === 'done' ? 'done' : 'analyzing'}
                open={agentOpen}
                onToggle={() => setAgentOpen((v) => !v)}
                verdict={verdict}
                notice={offlineVerdict ? referee.errorText : null}
              />
            )}
            <div className="border-border/60 bg-background/55 pointer-events-auto rounded-t-lg border-t px-3.5 pt-2.5 pb-[calc(var(--safe-bottom)+1rem)] backdrop-blur-md">
              {agent === 'none' ? (
                <Button
                  icon="sparkles"
                  className="w-full"
                  disabled={!form.canSubmit || scanPhase === 'scanning'}
                  loading={scanPhase === 'scanning'}
                  onClick={() => startAnalyze()}
                >
                  {scanPhase === 'scanning' ? '识别中…' : '提交并 Agent 自动解析'}
                </Button>
              ) : agent === 'analyzing' ? (
                <Button className="w-full" loading>
                  Agent 解析中…
                </Button>
              ) : saved ? (
                <Button
                  variant="soft"
                  icon="chart"
                  className="w-full"
                  onClick={() => push('report')}
                >
                  查看分析
                </Button>
              ) : (
                <Button
                  variant={verdict?.isValid ? 'primary' : 'secondary'}
                  icon={verdict?.isValid ? 'check' : 'alert'}
                  className="w-full"
                  loading={saving}
                  onClick={() => void confirm()}
                >
                  {verdict?.isValid ? '确认有效打卡' : '仅保存记录（不计有效打卡）'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {(page === 'rules' || page === 'basis') && (
        <>
          <PageBar
            title={page === 'rules' ? docs.rulesDoc.title : docs.basisDoc.title}
            onBack={back}
          />
          <DocBody
            doc={page === 'rules' ? docs.rulesDoc : docs.basisDoc}
            glance={docs.glance}
            kind={page}
          />
        </>
      )}

      {page === 'report' && report && verdict && (
        <>
          <PageBar title={report.title} onBack={back} />
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-6">
            <div
              className={cn(
                'text-tiny mb-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 font-semibold',
                verdict.isValid
                  ? 'bg-success-soft text-success-ink'
                  : 'bg-warning-soft text-warning-ink',
              )}
            >
              <Icon name={verdict.isValid ? 'check-double' : 'alert'} size={16} />
              {verdict.detail}
            </div>
            {report.folders.map((f, i) => (
              <FolderCard key={f.id} spec={f} defaultOpen={f.defaultOpen ?? i === 0} />
            ))}
            {verdict.advice.length > 0 && (
              <Card className="flex flex-col gap-1.5 p-3">
                <span className="text-caption font-bold">团团的建议</span>
                {verdict.advice.map((a) => (
                  <p key={a} className="text-tiny text-muted flex items-start gap-1.5">
                    <Icon name="bulb" size={13} className="text-primary-ink mt-px shrink-0" />
                    {a}
                  </p>
                ))}
              </Card>
            )}
          </div>
        </>
      )}

      {popup && (
        <div
          className="bg-foreground/30 absolute inset-0 z-20 flex items-end"
          role="dialog"
          aria-label="打卡结果"
        >
          <div className="bg-surface animate-fade-up flex w-full flex-col items-center gap-3 rounded-t-3xl px-5 pt-6 pb-[calc(var(--safe-bottom)+1.5rem)] text-center">
            <div className="relative">
              <Mascot mood={savedValid ? 'cheer' : 'sleepy'} size={72} />
              {savedValid && (
                <Stamp
                  text="已达标"
                  caption="有效卡"
                  tone={tone}
                  animate
                  size={54}
                  className="absolute -top-2 -right-12"
                />
              )}
            </div>
            <p className="text-subhead font-bold">
              {savedValid ? '打卡成功，连击 +1' : '已存档，今天先不盖章'}
            </p>
            <div className="flex w-full flex-col gap-2">
              <Button
                icon="chart"
                className="w-full"
                onClick={() => {
                  setPopup(false)
                  push('report')
                }}
              >
                查看分析
              </Button>
              <Button variant="ghost" className="w-full" onClick={props.onDone}>
                完成
              </Button>
            </div>
          </div>
        </div>
      )}

      {form.overlay}
    </div>
  )
}
