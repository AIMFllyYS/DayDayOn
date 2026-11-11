'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { useAgentUi } from '@/features/agent/agent-store'
import { useBindPet, usePetIdentity } from '@/features/agent/pet-binding'
import { useRefereeRun } from '@/features/agent/use-referee-run'
import { effectiveRules } from '@/features/referee/defaults'
import { judge } from '@/features/referee/rules'
import type { PriorDietMeal } from '@/features/referee/rules/common'
import type { RefereeTier, RulesOf, Verdict } from '@/features/referee/schemas'
import { judgeInputOf } from '@/features/referee/subject'
import type { Module } from '@/features/shared/schemas'
import { newIdempotencyKey } from '@/lib/api'
import { cn } from '@/lib/cn'
import { sleepRangeForDay } from '@/lib/time'
import type { CheckinClock, CheckinGoal, SmartFillContext } from '../components/form-types'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type SmartScannerSnapshot,
} from '../components/smart-scanner'
import { analysisPrompt, checkinToInput } from '../format'
import type { CheckinModuleDef } from '../modules/types'
import type { Checkin, CreateCheckinInput, MealType } from '../schemas'
import type { SmartHistoryRecord } from '../smart-handoff'
import type { SmartRecognitionResult } from '../smart-schemas'
import { AgentDrawer, ReportDivider, SectionDivider } from './agent-drawer'
import { DocBody, PageBar, TagChip } from './doc-page'
import { FillSection } from './fill-section'
import { FolderCard } from './folder-card'
import {
  buildConfirmPayload,
  computeFlowUnconfirmed,
  hasDraftForModule,
  normalizeManualSubject,
} from './smart-session'
import type { FillSectionSpec } from './types'

/*
 * 打卡页骨架（checkin-modules.md 第 5 节）。它就是整页，不套手机外框：
 *   标题栏 → 头部卡（目标名 + 「达标规则」「评判依据」标签 + 周期环）→ 记录方式 Tab → 主选择器
 *   → 折叠分区 / 扫描镜 → 分析报告 → 底部操作条 → 结果弹窗。
 * Agent 分析：窄屏是操作条上方的抽屉，宽屏（内容区 ≥ 56rem）是右栏。
 * 全局只有一个 Agent 形象：分析状态挂在悬浮宠物身上（pet-binding.ts），这里不画第二只。
 * 板块只提供 CheckinModuleDef，这里不出现任何板块分支。
 */

type Page = 'fill' | 'rules' | 'basis' | 'report'

export interface CheckinFlowProps {
  def: CheckinModuleDef
  goal: CheckinGoal & { refereeRules: unknown }
  clock: CheckinClock
  today: string
  /** 今天已入库的打卡记录（凌晨 0 点前重进页面或切换餐次时直接从数据库恢复状态） */
  todayCheckins?: readonly Checkin[]
  tier: RefereeTier
  /** 打卡周期：有效天数 / 周期总天数 */
  period: { done: number; total: number }
  initialMode: CheckinInputMode
  /** 外部路由指定的初始餐次（如 ?meal=lunch） */
  initialMeal?: MealType
  /** 外层已有统一顶栏（如 /checkin/smart）时，在主填写视图隐藏内部 PageBar */
  hidePageBar?: boolean
  /** 头部区域上方的组合扩展位（如 /checkin/smart 的一行 5 板块切换胶囊条与目标切换条） */
  topSlot?: ReactNode
  /** 预识别结果快照（从 /checkin/smart 识别完成后原地挂载时自动填表并启动团团裁判） */
  initialSmart?: {
    result: SmartRecognitionResult
    preview?: SmartScannerSnapshot | null
  } | null
  /** 扫描镜重新识别出结果时的可选通知（如在 /checkin/smart 内重新传图识别到了另一板块） */
  onSmartRecognized?: (
    result: SmartRecognitionResult,
    savedRecord: SmartHistoryRecord,
    preview?: SmartScannerSnapshot,
  ) => void
  /** 将二级页（rules/basis/report）返回动作桥接到外层顶栏返回键 */
  registerSubPageBack?: (handler: () => boolean) => () => void
  /** 当前是否存在未确认入库的草稿或裁判结论（供外层顶栏返回守卫同步状态） */
  onUnconfirmedChange?: (unconfirmed: boolean) => void
  /** 确认入库；返回服务端重算后的记录 */
  onConfirm: (input: CreateCheckinInput) => Promise<Checkin>
  onBack: () => void
}

function buildSkipFallbackInput(
  goal: CheckinGoal,
  clock: CheckinClock,
  today: string,
  activeKey?: string,
  note?: string,
): CreateCheckinInput {
  const cleanNote = note?.trim() || null
  switch (goal.module) {
    case 'diet':
      return {
        module: 'diet',
        method: 'manual',
        mealType:
          activeKey === 'breakfast' ||
          activeKey === 'lunch' ||
          activeKey === 'dinner' ||
          activeKey === 'snack'
            ? activeKey
            : 'lunch',
        items: [{ name: '跳过打卡', portion: '', kcal: null }],
        note: cleanNote,
      }
    case 'exercise':
      return {
        module: 'exercise',
        category: '跳过打卡',
        intensity: 'easy',
        durationSeconds: 60,
        note: cleanNote,
      }
    case 'sleep': {
      const r = sleepRangeForDay(today, '23:00', '07:00', clock.timeZone, clock.dayStartHour)
      const wakeAt = r ? r.wakeAt : new Date()
      const bedAt = r ? r.bedAt : new Date(wakeAt.getTime() - 8 * 3600_000)
      return {
        module: 'sleep',
        bedAt: bedAt.toISOString(),
        wakeAt: wakeAt.toISOString(),
        quality: 3,
        note: cleanNote,
      }
    }
    case 'study':
      return {
        module: 'study',
        what: '跳过打卡',
        durationSeconds: 60,
        note: cleanNote,
      }
    case 'custom':
      return {
        module: 'custom',
        fieldVersion: goal.fieldVersion ?? 1,
        values: {},
        note: cleanNote,
      }
  }
}

/** 内容区够宽（56rem）时 Agent 分析放右栏 */
const WIDE_MIN_PX = 896

function useWide(ref: React.RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWide(el.getBoundingClientRect().width >= WIDE_MIN_PX)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return wide
}

export function CheckinFlow(props: CheckinFlowProps) {
  const { def, goal, clock, today, todayCheckins, tier, period } = props
  const tone = def.tone
  const form = def.useForm({
    goal,
    clock,
    today,
    todayCheckins,
    initialMeal: props.initialMeal,
  })
  const referee = useRefereeRun(goal.id)
  const rules = effectiveRules(def.module, goal.refereeRules) as RulesOf<Module>
  const docs = useMemo(() => def.docs(rules as never, goal), [def, rules, goal])

  const savedFromDb = useMemo(() => {
    if (!todayCheckins || todayCheckins.length === 0) return null
    if (goal.module === 'diet' && form.activeKey) {
      return (
        todayCheckins.find(
          (c) => c.payload.module === 'diet' && c.payload.mealType === form.activeKey,
        ) ?? null
      )
    }
    if (goal.module === 'study') {
      const studyRules = effectiveRules('study', goal.refereeRules)
      const targetMin = goal.target.kind === 'duration' ? Math.round(goal.target.value / 60) : 0
      const minMin = Math.max(targetMin, studyRules.minFocusMinutes)
      const validSec = todayCheckins
        .filter((c) => c.payload.module === 'study' && c.isValid)
        .reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0)
      const doneToday =
        minMin > 0
          ? validSec >= minMin * 60
          : todayCheckins.some((c) => c.payload.module === 'study' && c.isValid)
      return doneToday ? (todayCheckins[0] ?? null) : null
    }
    return todayCheckins[0] ?? null
  }, [todayCheckins, goal.module, goal.target, goal.refereeRules, form.activeKey])

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
  const initialHasDraft = Boolean(
    props.initialSmart && hasDraftForModule(props.initialSmart.result.draft, goal.module),
  )
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done'>(() =>
    initialHasDraft ? 'done' : 'idle',
  )
  const [smart, setSmart] = useState<SmartFillContext | null>(() =>
    initialHasDraft ? (props.initialSmart?.result ?? null) : null,
  )
  const [lensVersion, setLensVersion] = useState(0)
  const [subject, setSubject] = useState<CreateCheckinInput | null>(() =>
    savedFromDb ? checkinToInput(savedFromDb) : null,
  )
  const [agentOpen, setAgentOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Checkin | null>(savedFromDb)
  const [popup, setPopup] = useState(false)
  const [skipReason, setSkipReason] = useState('')

  // 切换子维度（如从早餐切到午餐）或初始数据库记录到位时，同步当前子维度的已入库状态并清理旧识别上下文
  const activeSyncKey = `${form.activeKey ?? 'default'}:${savedFromDb?.id ?? 'none'}`
  const [seenSyncKey, setSeenSyncKey] = useState<string>(activeSyncKey)
  if (!saving && activeSyncKey !== seenSyncKey) {
    setSeenSyncKey(activeSyncKey)
    setSaved(savedFromDb)
    setSubject(savedFromDb ? checkinToInput(savedFromDb) : null)
    setSmart(null)
    setScanPhase('idle')
    setLensVersion((v) => v + 1)
    setOpenId(!savedFromDb && mode === 'manual' ? (form.sections[0]?.id ?? null) : null)
    setSkipReason('')
    referee.reset()
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const wide = useWide(rootRef)
  const pet = usePetIdentity()
  const agentUi = useAgentUi()

  const page = stack[stack.length - 1] ?? 'fill'
  const isSmart = mode !== 'manual'
  const push = (p: Page) => setStack((s) => [...s, p])
  const back = () => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : props.onBack())

  const stackLenRef = useRef(stack.length)
  useEffect(() => {
    stackLenRef.current = stack.length
  }, [stack.length])
  const { registerSubPageBack } = props
  useEffect(() => {
    if (!registerSubPageBack) return
    return registerSubPageBack(() => {
      if (stackLenRef.current > 1) {
        setStack((s) => s.slice(0, -1))
        return true
      }
      return false
    })
  }, [registerSubPageBack])

  const priorStudyMinutes = useMemo(() => {
    if (goal.module !== 'study' || !todayCheckins) return 0
    const sec = todayCheckins
      .filter((c) => c.payload.module === 'study')
      .reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0)
    return Math.round(sec / 60)
  }, [goal.module, todayCheckins])

  const priorDietMeals = useMemo<PriorDietMeal[]>(() => {
    if (goal.module !== 'diet' || !todayCheckins) return []
    const currentMeal = subject?.module === 'diet' ? subject.mealType : null
    return todayCheckins.flatMap((c) =>
      c.payload.module === 'diet' && c.payload.mealType !== currentMeal
        ? [
            {
              mealType: c.payload.mealType,
              items: c.payload.items.map((i) => ({
                name: i.name,
                portion: i.portion ?? '',
                kcal: i.kcal,
              })),
              note: c.note,
              dishes: c.verdict?.facts?.module === 'diet' ? c.verdict.facts.dishes : null,
            },
          ]
        : [],
    )
  }, [goal.module, todayCheckins, subject])

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
        priorMinutesToday: priorStudyMinutes,
        priorDietMeals,
      }),
    )
  }, [
    subject,
    referee.status,
    clock.timeZone,
    goal.fields,
    goal.refereeRules,
    tier,
    priorStudyMinutes,
    priorDietMeals,
  ])
  const verdict = saved?.verdict ?? referee.verdict ?? offlineVerdict
  const agent: 'none' | 'analyzing' | 'done' =
    subject === null ? 'none' : referee.status === 'running' || !verdict ? 'analyzing' : 'done'

  // 分析状态挂到全局唯一的悬浮宠物上：窄屏点它展开 / 收起抽屉，宽屏（分析在右栏）点它打开对话
  const drawerShown = !wide && page === 'fill' && agent !== 'none' && agentOpen
  const onPetTap = useCallback(() => {
    if (!wide && page === 'fill') setAgentOpen((v) => !v)
    else agentUi.openPanel()
  }, [wide, page, agentUi])
  useBindPet({
    status: agent === 'none' ? null : agent,
    hidden: drawerShown || popup,
    onTap: agent === 'none' ? undefined : onPetTap,
    label:
      agent === 'none'
        ? undefined
        : !wide && page === 'fill'
          ? `${agentOpen ? '收起' : '展开'}${pet.name}分析`
          : `打开${pet.name}对话`,
  })

  function startAnalyze(override?: CreateCheckinInput | null) {
    const trimmedSkip = !isSmart ? skipReason.trim() : ''
    const rawInput =
      override ??
      form.toInput() ??
      (trimmedSkip ? buildSkipFallbackInput(goal, clock, today, form.activeKey, form.note) : null)
    if (!rawInput) return
    const normalizedInput = normalizeManualSubject(rawInput, mode)
    const input: CreateCheckinInput = trimmedSkip
      ? { ...normalizedInput, skipReason: trimmedSkip }
      : normalizedInput
    setOpenId(null)
    setIndOpen(
      Object.fromEntries(form.sections.filter((s) => s.independent).map((s) => [s.id, false])),
    )
    setAgentOpen(true)
    setSaved(null)
    setSubject(input)
    referee.start({
      checkin: input,
      text: analysisPrompt(goal.title, input, clock.timeZone),
      idempotencyKey: newIdempotencyKey(),
    })
  }

  function invalidateAnalysis() {
    if (subject === null && saved === null) return
    setSaved(null)
    setSubject(null)
    referee.reset()
  }

  function changeMode(next: CheckinInputMode) {
    if (next === mode) return
    setMode(next)
    setOpenId(next === 'manual' ? (form.sections[0]?.id ?? null) : null)
    setIndOpen({})
    setScanPhase('idle')
    setSmart(null)
    setLensVersion((v) => v + 1)
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
      const result = await props.onConfirm(buildConfirmPayload({ subject, mode, smart, verdict }))
      const savedKey =
        result.payload.module === 'diet' ? result.payload.mealType : (form.activeKey ?? 'default')
      setSeenSyncKey(`${savedKey}:${result.id}`)
      setSmart(null)
      setSaved(result)
      if (result.verdict?.settlement === 'pending') {
        setAgentOpen(false)
        const logged =
          typeof result.verdict.metrics.mealsLogged === 'number'
            ? result.verdict.metrics.mealsLogged
            : 1
        const req =
          typeof result.verdict.metrics.mealsRequired === 'number'
            ? result.verdict.metrics.mealsRequired
            : 3
        toast.success(`本餐已记录（今日 ${logged}/${req} 正餐），集齐三餐后统一结算总分`)
      } else {
        setPopup(true)
      }
    } catch {
      // 错误提示由 onConfirm 负责
    } finally {
      setSaving(false)
    }
  }

  // 「跳过本次打卡」经 Agent 判定理由通过后，自动入库并直接弹出「打卡成功，连击 +1」盖章弹窗
  const autoConfirmedRef = useRef<CreateCheckinInput | null>(null)
  useEffect(() => {
    if (
      subject?.skipReason &&
      agent === 'done' &&
      verdict?.isValid &&
      !saved &&
      !saving &&
      autoConfirmedRef.current !== subject
    ) {
      autoConfirmedRef.current = subject
      void confirm()
    }
  })

  // 承接来自 /checkin/smart 的预识别结果：自动填入对应板块表单并立即启动团团科学裁判与统一报告渲染
  const appliedInitialSmartRef = useRef<string | null>(null)
  const initialSmartBridgeRef = useRef({ form, todayCheckins, savedFromDb, startAnalyze })
  useEffect(() => {
    initialSmartBridgeRef.current = { form, todayCheckins, savedFromDb, startAnalyze }
  })
  const initialSmartResult = props.initialSmart?.result ?? null
  useEffect(() => {
    if (!initialSmartResult) return
    const token = `${goal.id}:${initialSmartResult.aiRunId}`
    if (appliedInitialSmartRef.current === token) return
    const timer = window.setTimeout(() => {
      if (appliedInitialSmartRef.current === token) return
      appliedInitialSmartRef.current = token
      const cur = initialSmartBridgeRef.current
      if (!hasDraftForModule(initialSmartResult.draft, goal.module)) {
        setSmart(null)
        setScanPhase('idle')
        setOpenId(cur.form.sections[0]?.id ?? null)
        return
      }
      setSmart(initialSmartResult)
      setScanPhase('done')
      const next = cur.form.applySmart(initialSmartResult.draft)
      if (next) {
        const nextKey = next.module === 'diet' ? next.mealType : (cur.form.activeKey ?? 'default')
        const nextSaved =
          next.module === 'diet'
            ? (cur.todayCheckins?.find(
                (c) => c.payload.module === 'diet' && c.payload.mealType === next.mealType,
              ) ?? null)
            : cur.savedFromDb
        setSeenSyncKey(`${nextKey}:${nextSaved?.id ?? 'none'}`)
        cur.startAnalyze(next)
      } else {
        setOpenId(cur.form.sections[0]?.id ?? null)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [goal.id, goal.module, initialSmartResult])

  const flowUnconfirmed = computeFlowUnconfirmed({ saved, subject, mode, smart })
  const { onUnconfirmedChange } = props
  useEffect(() => {
    onUnconfirmedChange?.(flowUnconfirmed)
  }, [onUnconfirmedChange, flowUnconfirmed])

  const noteSection = form.sections.find((s) => s.id === 'note') ?? null
  const skipSection: FillSectionSpec = {
    id: 'skip',
    label: '跳过本次打卡',
    icon: 'pen',
    filled: skipReason.trim().length > 0,
    summary: skipReason.trim() || '填写合理理由可豁免本次打卡',
    content: (
      <>
        <Input
          aria-label="跳过本次打卡"
          value={skipReason}
          maxLength={200}
          placeholder="例如：肠胃炎禁食、发烧休息、外出赶车无法按时打卡"
          onChange={(e) => {
            setSkipReason(e.target.value)
            invalidateAnalysis()
          }}
        />
        <p className="text-tiny text-subtle">
          仅手动填写可用：其他项可留空，{pet.name}核验理由合理后将自动为您记为有效打卡
        </p>
      </>
    ),
  }

  const canSubmit = form.canSubmit || (!isSmart && skipReason.trim().length > 0)
  const report = verdict && subject ? def.buildReport(verdict, subject, goal) : null
  const activeVerdict = saved?.verdict ?? verdict
  const isPendingSettlement = activeVerdict?.settlement === 'pending'
  const savedValid = saved?.isValid ?? verdict?.isValid ?? false
  const dbValidToday = Boolean(todayCheckins?.some((c) => c.isValid))
  const currentlyValidToday = saved ? saved.isValid : dbValidToday
  const dayDelta = (currentlyValidToday ? 1 : 0) - (dbValidToday ? 1 : 0)
  const effectiveDoneDays = Math.max(0, Math.min(period.done + dayDelta, period.total))
  const hasDailySummary =
    !isPendingSettlement &&
    activeVerdict !== null &&
    activeVerdict.score !== null &&
    typeof activeVerdict.metrics.dailyKcal === 'number'

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {page === 'fill' && (
          <>
            {!props.hidePageBar && (
              <PageBar title={`${moduleMeta[tone].label}打卡`} onBack={back} />
            )}
            {props.topSlot && <div className="shrink-0 px-4 pt-1.5 pb-1">{props.topSlot}</div>}

            <div className="shrink-0 px-4 pt-1">
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
                  value={effectiveDoneDays}
                  max={period.total}
                  tone={tone}
                  size={52}
                  thickness={5}
                  label={`打卡周期 ${effectiveDoneDays}/${period.total} 天`}
                  className="shrink-0"
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="text-tiny font-display leading-none font-bold">DAY</span>
                    <span className="text-tiny font-display leading-none font-bold whitespace-nowrap tabular-nums">
                      {effectiveDoneDays}/{period.total}
                    </span>
                  </span>
                </ProgressRing>
              </Card>
            </div>

            <SectionDivider />

            <div className="flex shrink-0 flex-col gap-2.5 px-4">
              <CheckinModeTabs value={mode} onValueChange={changeMode} />
              {form.selector}
              {form.statusBanner}
            </div>

            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pt-3 [&>*]:shrink-0',
                drawerShown ? 'pb-96' : 'pb-28',
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
                  key={lensVersion}
                  mode={mode}
                  hintModule={goal.module}
                  goalId={goal.id}
                  note={
                    savedFromDb && form.note === (savedFromDb.note ?? '') ? undefined : form.note
                  }
                  tone={tone}
                  initialSnapshot={lensVersion === 0 ? props.initialSmart : null}
                  onScanStart={() => {
                    invalidateAnalysis()
                    setSmart(null)
                    setScanPhase('scanning')
                  }}
                  onRecognized={(res, savedRecord, previewSnap) => {
                    props.onSmartRecognized?.(res, savedRecord, previewSnap)
                    const hasDraft = hasDraftForModule(res.draft, goal.module)
                    setSmart(hasDraft ? res : null)
                    setScanPhase(hasDraft ? 'done' : 'idle')
                    if (!hasDraft && !props.onSmartRecognized) {
                      toast.info(
                        res.draft.summary ||
                          `未从文件中识别出「${moduleMeta[goal.module].label}」板块的数据，请换个文件或手动填写`,
                      )
                    }
                    // 识别结果填进表单，同时直接交给 Agent 裁判；提前对齐 seenSyncKey 防止切餐次时渲染期误触发 reset
                    const next = hasDraft ? form.applySmart(res.draft) : null
                    if (next) {
                      const nextKey =
                        next.module === 'diet' ? next.mealType : (form.activeKey ?? 'default')
                      const nextSaved =
                        next.module === 'diet'
                          ? (todayCheckins?.find(
                              (c) =>
                                c.payload.module === 'diet' && c.payload.mealType === next.mealType,
                            ) ?? null)
                          : savedFromDb
                      setSeenSyncKey(`${nextKey}:${nextSaved?.id ?? 'none'}`)
                      startAnalyze(next)
                    } else if (hasDraft) {
                      setOpenId(form.sections[0]?.id ?? null)
                    }
                  }}
                  onScanError={() => setScanPhase('idle')}
                  onManualFallback={() => changeMode('manual')}
                />
              )}
              {isSmart && scanPhase !== 'done' && noteSection && (
                <FillSection
                  key={noteSection.id}
                  spec={noteSection}
                  tone={tone}
                  open={isOpen(noteSection)}
                  ai={false}
                  onToggle={() => toggleSection(noteSection)}
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
              {!isSmart && (
                <FillSection
                  key={skipSection.id}
                  spec={skipSection}
                  tone={tone}
                  open={isOpen(skipSection)}
                  ai={false}
                  onToggle={() => toggleSection(skipSection)}
                />
              )}
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
              {!wide && agent !== 'none' && (
                <AgentDrawer
                  turn={referee.turn}
                  phase={agent === 'done' ? 'done' : 'analyzing'}
                  open={agentOpen}
                  onToggle={() => setAgentOpen((v) => !v)}
                  verdict={verdict}
                  notice={offlineVerdict ? referee.errorText : null}
                  character={pet.character}
                  petName={pet.name}
                  onAsk={agentUi.openPanel}
                />
              )}
              <div className="border-border/60 bg-background/55 pointer-events-auto rounded-t-lg border-t px-4 pt-2.5 pb-[calc(var(--safe-bottom)+1rem)] backdrop-blur-md">
                {agent === 'none' ? (
                  <Button
                    icon="sparkles"
                    className="w-full"
                    disabled={!canSubmit || scanPhase === 'scanning'}
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
                  saved.verdict?.settlement === 'pending' && form.nextPendingAction ? (
                    <div className="flex gap-2">
                      <Button
                        variant="soft"
                        icon="chart"
                        className="flex-1"
                        onClick={() => push('report')}
                      >
                        本餐解析
                      </Button>
                      <Button
                        icon="plus"
                        className="flex-1"
                        onClick={form.nextPendingAction.activate}
                      >
                        {form.nextPendingAction.label}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="soft"
                      icon="chart"
                      className="w-full"
                      onClick={() => push('report')}
                    >
                      {hasDailySummary ? '查看今日总报告' : '查看分析'}
                    </Button>
                  )
                ) : verdict?.settlement === 'pending' ? (
                  <Button
                    variant="primary"
                    icon="check"
                    className="w-full"
                    loading={saving}
                    onClick={() => void confirm()}
                  >
                    {`保存本餐记录（今日 ${String(verdict.metrics.mealsLogged ?? 1)}/${String(verdict.metrics.mealsRequired ?? 3)}）`}
                  </Button>
                ) : (
                  <Button
                    variant={verdict?.isValid ? 'primary' : 'secondary'}
                    icon={verdict?.isValid ? 'check' : 'alert'}
                    className="w-full"
                    loading={saving}
                    onClick={() => void confirm()}
                  >
                    {verdict?.isValid
                      ? verdict.score !== null
                        ? `确认完成今日打卡（总分 ${verdict.score.toFixed(1)} 分）`
                        : '确认有效打卡'
                      : '仅保存记录（不计有效打卡）'}
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
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-6">
              <div
                className={cn(
                  'text-tiny mb-1 flex items-center gap-2 rounded-2xl px-3 py-2.5 font-semibold',
                  verdict.settlement === 'pending'
                    ? 'bg-diet-soft text-diet-ink'
                    : verdict.isValid
                      ? 'bg-success-soft text-success-ink'
                      : 'bg-warning-soft text-warning-ink',
                )}
              >
                <Icon
                  name={
                    verdict.settlement === 'pending'
                      ? 'clock'
                      : verdict.isValid
                        ? 'check-double'
                        : 'alert'
                  }
                  size={16}
                />
                {verdict.detail}
              </div>
              {report.folders.map((f, i) => (
                <FolderCard key={f.id} spec={f} defaultOpen={f.defaultOpen ?? i === 0} />
              ))}
              {verdict.advice.length > 0 && (
                <Card className="flex flex-col gap-1.5 p-3">
                  <span className="text-caption font-bold">{pet.name}的建议</span>
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
      </div>

      {wide && page === 'fill' && (
        <aside className="border-border flex w-[22rem] shrink-0 flex-col border-l @6xl:w-[26rem]">
          {agent === 'none' ? (
            <div className="text-muted flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <Icon name="sparkles" size={20} className="text-primary-ink" />
              <p className="text-caption font-bold">{pet.name}会在这里分析</p>
              <p className="text-tiny">
                填好后点「提交并 Agent 自动解析」，过程和结论都会显示在这一栏，也会存进对话历史。
              </p>
            </div>
          ) : (
            <AgentDrawer
              variant="inline"
              turn={referee.turn}
              phase={agent === 'done' ? 'done' : 'analyzing'}
              open
              onToggle={() => undefined}
              verdict={verdict}
              notice={offlineVerdict ? referee.errorText : null}
              character={pet.character}
              petName={pet.name}
              onAsk={agentUi.openPanel}
            />
          )}
        </aside>
      )}

      {popup && (
        <div
          className="bg-foreground/30 absolute inset-0 z-20 flex items-end justify-center @4xl:items-center"
          role="dialog"
          aria-label="打卡结果"
        >
          <div className="bg-surface animate-fade-up flex w-full flex-col items-center gap-3 rounded-t-3xl px-5 pt-6 pb-[calc(var(--safe-bottom)+1.5rem)] text-center @4xl:max-w-sm @4xl:rounded-3xl @4xl:pb-6">
            <div className="relative">
              <Mascot mood={savedValid ? 'cheer' : 'sleepy'} size={72} character={pet.character} />
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
              {hasDailySummary
                ? savedValid
                  ? '今日三餐集齐！打卡成功，连击 +1'
                  : '今日三餐已汇总存档，暂未达有效线'
                : savedValid
                  ? '打卡成功，连击 +1'
                  : '已存档，今天先不盖章'}
            </p>
            {hasDailySummary && activeVerdict && activeVerdict.score !== null && (
              <div className="border-border bg-surface-sunken/80 flex w-full flex-col gap-2.5 rounded-2xl border p-3 text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-caption font-bold">今日饮食全天总分</span>
                  <span
                    className={cn(
                      'font-display text-heading font-bold tabular-nums',
                      savedValid ? 'text-success-ink' : 'text-warning-ink',
                    )}
                  >
                    {activeVerdict.score.toFixed(1)}
                    <span className="text-tiny text-muted ml-1 font-semibold">/ 5.0 分</span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: '早餐', val: activeVerdict.metrics.breakfastKcal },
                    { label: '午餐', val: activeVerdict.metrics.lunchKcal },
                    { label: '晚餐', val: activeVerdict.metrics.dinnerKcal },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="border-border bg-surface flex flex-col rounded-xl border px-2 py-1.5"
                    >
                      <span className="text-tiny text-muted">{m.label}</span>
                      <span className="text-tiny font-display font-bold tabular-nums">
                        {typeof m.val === 'number' ? (m.val === 0 ? '空腹' : `${m.val} kcal`) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {typeof activeVerdict.metrics.snackKcal === 'number' && (
                  <p className="text-tiny text-muted text-center">
                    含加餐 {activeVerdict.metrics.snackKcal} kcal
                  </p>
                )}
                <p className="text-tiny text-muted border-border border-t pt-2 text-center">
                  全天合计 {String(activeVerdict.metrics.dailyKcal ?? 0)} kcal · 蛋白质{' '}
                  {String(activeVerdict.metrics.dailyProtein ?? 0)}g · 膳食纤维{' '}
                  {String(activeVerdict.metrics.dailyFiber ?? 0)}g
                </p>
              </div>
            )}
            <div className="flex w-full flex-col gap-2">
              <Button
                icon="chart"
                className="w-full"
                onClick={() => {
                  setPopup(false)
                  push('report')
                }}
              >
                {hasDailySummary ? '查看今日总报告' : '查看分析'}
              </Button>
              {/* 「完成」只收起结果弹层，留在打卡页；回哪里由用户自己点返回 */}
              <Button variant="ghost" className="w-full" onClick={() => setPopup(false)}>
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
