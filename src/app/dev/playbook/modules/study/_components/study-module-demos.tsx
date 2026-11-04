'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { ProgressBar } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import { deckClass } from '../../_components/deck'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type ScanPhase,
  type SmartSamplePreset,
} from '../../../_components/smart-recognition-demos'

// ============================================================================
// 学习板块双机制科学裁判纯函数：
// 门槛 1：单次专注时长 ≥ 设定最低专注门槛（默认 25 分钟，即 1 个标准番茄钟）
// 门槛 2：实质学习内容核验（主题明确 + 包含具体知识点摘要或刷题复盘，非敷衍单字）
// ============================================================================

export type MinFocusOption = '25' | '45' | '60'

export interface StudyRefereeEvaluation {
  durationPassed: boolean
  contentPassed: boolean
  isValidCheckin: boolean
  shortByMinutes: number
  verdictTitle: string
  verdictDetail: string
}

export function evaluateStudyCheckin(
  what: string,
  minutes: number,
  note: string,
  minFocusMinutes = 25,
): StudyRefereeEvaluation {
  const durationPassed = minutes >= minFocusMinutes
  const shortByMinutes = Math.max(0, minFocusMinutes - minutes)
  const cleanWhat = what.trim()
  const cleanNote = note.trim()
  const contentPassed = cleanWhat.length >= 2 && cleanNote.length >= 8
  const isValidCheckin = durationPassed && contentPassed

  if (isValidCheckin) {
    return {
      durationPassed: true,
      contentPassed: true,
      isValidCheckin: true,
      shortByMinutes: 0,
      verdictTitle: '专注时长与知识要点双达标 · 有效打卡',
      verdictDetail: `已完成 ${minutes} 分钟深度专注（达标 ≥ ${minFocusMinutes}m），且提炼出清晰的学习收获要点，计入「学一点」有效连击！`,
    }
  }

  if (!durationPassed && contentPassed) {
    return {
      durationPassed: false,
      contentPassed: true,
      isValidCheckin: false,
      shortByMinutes,
      verdictTitle: `未满 ${minFocusMinutes} 分钟专注门槛 · 暂存碎片记录`,
      verdictDetail: `当前专注 ${minutes} 分钟，距离最低番茄钟门槛还差 ${shortByMinutes} 分钟。建议继续专注凑满 ${minFocusMinutes} 分钟后再盖章，或先暂存为碎片学习流水。`,
    }
  }

  if (durationPassed && !contentPassed) {
    return {
      durationPassed: true,
      contentPassed: false,
      isValidCheckin: false,
      shortByMinutes: 0,
      verdictTitle: '缺少实质收获摘录 · 请补充要点',
      verdictDetail: `专注 ${minutes} 分钟很棒！但要点摘录过于简略（当前仅 ${cleanNote.length} 字），写下 1–2 句今天学会的核心概念或错题复盘即可盖章～`,
    }
  }

  return {
    durationPassed: false,
    contentPassed: false,
    isValidCheckin: false,
    shortByMinutes,
    verdictTitle: '时长未达番茄钟门槛且内容过简 · 拦截糊弄卡',
    verdictDetail: `仅填写「${cleanWhat || '未填'}」且专注 ${minutes} 分钟（未满 ${minFocusMinutes} 分钟门槛），再专注 ${shortByMinutes} 分钟并补充具体收获后再来盖章吧！`,
  }
}

// ============================================================================
// Section 01 组件：专注时长与实质内容核验双机制演示（每行 2 卡 md:grid-cols-2）
// ============================================================================

export function StudyDualMechanismDemo() {
  const [minFocus, setMinFocus] = useState<MinFocusOption>('25')

  return (
    <div className={deckClass}>
      {/* 左卡：机制 01 · 最低专注时长门槛（番茄钟防糊弄） */}
      <Card
        data-ann="playbook.modules.study.mechanism.pomodoro"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="clock" tone="study" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">
                  机制 01 · 最低专注时长门槛（≥ {minFocus} 分钟）
                </h3>
                <p className="text-tiny text-muted truncate">
                  拒绝「翻书 3 分钟、背 2 个单词」应付式打卡
                </p>
              </div>
            </div>
            <Badge tone="study" icon="shield">
              番茄钟底线
            </Badge>
          </div>

          <div className="bg-surface-sunken flex flex-col gap-2.5 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-bold">设定单次有效打卡最低专注时长</span>
              <span className="font-display text-study-ink bg-study-soft text-tiny rounded-full px-2.5 py-0.5 font-bold tabular-nums">
                ≥ {minFocus} min
              </span>
            </div>
            <SegmentedControl
              size="sm"
              label="最低专注时长档位"
              value={minFocus}
              onValueChange={setMinFocus}
              options={[
                { value: '25', label: '25m 番茄钟' },
                { value: '45', label: '45m 标准课时' },
                { value: '60', label: '60m 深度钻研' },
              ]}
            />
            <p className="text-tiny text-muted leading-relaxed">
              认知心理学研究表明，大脑从切换任务到进入深度心流（Flow）通常需要 15–20
              分钟。低于最低门槛的碎片阅读可记入累计时长，但不单独触发有效打卡印章。
            </p>
          </div>

          {/* 碎片浏览 vs 深度专注对照条 */}
          <div className="grid gap-2">
            <div className="border-border bg-background flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="bg-warning size-2 shrink-0 rounded-full" />
                <span className="text-tiny truncate font-semibold">
                  5 分钟随手翻书 / 刷 3 个单词
                </span>
              </div>
              <Badge tone="warning">仅存碎片流水</Badge>
            </div>
            <div className="border-study/35 bg-study-soft/45 flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="bg-success size-2 shrink-0 rounded-full" />
                <span className="text-tiny text-study-ink truncate font-semibold">
                  ≥ {minFocus} 分钟完整番茄钟 + 笔记复盘
                </span>
              </div>
              <Badge tone="success" dot>
                有效打卡盖章
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* 右卡：机制 02 · HTML / TXT / Markdown 笔记提纯与实质内容核验 */}
      <Card
        data-ann="playbook.modules.study.mechanism.purify"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="study" tone="study" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">
                  机制 02 · 笔记提纯与实质内容核验
                </h3>
                <p className="text-tiny text-muted truncate">
                  支持上传 HTML / TXT / Markdown 笔记或刷题截图
                </p>
              </div>
            </div>
            <Badge tone="primary" icon="sparkles">
              AI 提纯核验
            </Badge>
          </div>

          {/* 原始 HTML 附件 -> 提纯核心要点对比 */}
          <div className="bg-surface-sunken flex flex-col gap-2.5 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">
                输入：导出笔记（HTML / TXT）或题库截图
              </span>
              <span className="text-tiny text-subtle font-mono">前端去噪 → deepseek-flash</span>
            </div>

            <div className="bg-surface border-border rounded-xl border p-2.5">
              <p className="text-tiny text-subtle font-mono">
                &lt;article class=&quot;note&quot;&gt;&lt;h2&gt;Day 12
                二叉树层序遍历&lt;/h2&gt;&lt;p&gt;利用队列记录每层 size 快照，时间复杂度
                O(n)...&lt;/p&gt;&lt;/article&gt;
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-1">
              <Icon name="sparkles" size={14} className="text-study-ink shrink-0" />
              <span className="text-tiny text-study-ink font-semibold">
                Agent 自动剥离标签并核验知识实质度：
              </span>
            </div>

            <div className="bg-study-soft/55 border-study/30 flex flex-col gap-1.5 rounded-xl border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-study-ink font-bold">
                  提炼主题：二叉树层序遍历与 BFS 模板
                </span>
                <Badge tone="study">实质度通过</Badge>
              </div>
              <ul className="text-tiny text-foreground space-y-1">
                <li>• 核心方法：使用队列并在每层外循环记录 `levelSize = queue.length` 快照</li>
                <li>• 复杂度分析：每个节点入队出队各一次，时间 `O(n)`、空间 `O(n)`</li>
              </ul>
            </div>
          </div>

          <p className="text-tiny text-muted leading-relaxed">
            无论是 Notion / 语雀导出的 HTML 笔记、纯文本读书摘抄，还是平板手写题库截图，Agent
            都会自动提取今日掌握的知识点填入「要点摘录」，省去手打长文的繁琐。
          </p>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 02 组件：学习裁判反馈卡正反对比（每行 2 卡 md:grid-cols-2）
// ============================================================================

export function StudyRefereeComparisonMatrix() {
  return (
    <div className={deckClass}>
      {/* 场景 A：上传二叉树笔记 HTML · 专注 45 分钟 · 有效打卡 */}
      <Card
        data-ann="playbook.modules.study.verdict.valid"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="study" tone="study" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">
                  场景 A · 上传二叉树笔记 HTML · 专注 45 分钟
                </p>
                <p className="text-tiny text-muted truncate">
                  Agent 提炼核心知识点摘要 + 验证专注时长达标
                </p>
              </div>
            </div>
            <Badge tone="success" dot>
              有效打卡
            </Badge>
          </div>

          {/* 双门槛核验明细 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">专注时长门槛（≥ 25 分钟）</span>
              </div>
              <span className="font-display text-success-ink text-caption font-bold tabular-nums">
                45 分钟（1.8 个番茄钟）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">实质内容核验（HTML 笔记提纯）</span>
              </div>
              <span className="text-study-ink text-tiny font-bold">已提炼 3 条算法要点</span>
            </div>
          </div>

          {/* 提炼出的知识卡片摘要 */}
          <div className="border-border bg-background rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">AI 提炼笔记摘要</span>
              <Badge tone="study">LeetCode 102 / 107 / 103</Badge>
            </div>
            <p className="text-caption mt-1 font-bold">二叉树层序遍历（BFS 队列快照法）</p>
            <p className="text-tiny text-muted mt-0.5 leading-relaxed">
              掌握通过 `queue.length`
              锁定当前层节点数的通用模板，完成锯齿形层序遍历变体练习，时间复杂度 `O(n)`。
            </p>
          </div>

          {/* 团团正向裁判评语 */}
          <div className="bg-study-soft/50 border-study/30 relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5">
            <Mascot mood="cheer" size={56} />
            <div className="min-w-0 flex-1 pr-14">
              <p className="text-caption text-study-ink font-bold">
                团团裁判：笔记详实、专注达标，盖章！
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                45 分钟沉浸刷题 + 清晰的复杂度复盘，今天又是扎实进步的一天，学一点连击 +1～
              </p>
            </div>
            <Stamp
              text="学一点"
              caption="45min"
              tone="study"
              size={60}
              className="absolute top-2.5 right-2.5"
            />
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">判定结果：计入今日「学一点」有效连击</span>
          <Badge tone="study" icon="check">
            已盖章
          </Badge>
        </div>
      </Card>

      {/* 场景 B：仅填“背单词”且时长 5 分钟 · 门槛拦截 */}
      <Card
        data-ann="playbook.modules.study.verdict.short-intercept"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="alert" tone="warning" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">
                  场景 B · 仅填「背单词」且专注 5 分钟
                </p>
                <p className="text-tiny text-muted truncate">
                  未满 25 分钟最低专注门槛 + 缺乏具体学习要点
                </p>
              </div>
            </div>
            <Badge tone="warning" icon="alert">
              门槛拦截
            </Badge>
          </div>

          {/* 双门槛核验明细 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-danger-soft text-danger-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✕
                </span>
                <span className="text-caption font-semibold">专注时长门槛（≥ 25 分钟）</span>
              </div>
              <span className="font-display text-danger-ink text-caption font-bold tabular-nums">
                仅 5 分钟（差 20m）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-warning-soft text-warning-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  !
                </span>
                <span className="text-caption font-semibold">实质内容核验（收获要点）</span>
              </div>
              <span className="text-warning-ink text-tiny font-bold">仅 3 个字，无具体收获</span>
            </div>
          </div>

          {/* 输入内容回显 */}
          <div className="border-warning/35 bg-background rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">当前填写的草稿</span>
              <Badge tone="warning">待补足 20 分钟</Badge>
            </div>
            <p className="text-caption mt-1 font-bold">学了什么：背单词（5 分钟）</p>
            <p className="text-tiny text-muted mt-0.5 leading-relaxed">
              要点摘录：「背了几个单词」（未包含具体词根、词书单元或记忆收获）
            </p>
          </div>

          {/* 团团温和拦截评语 */}
          <div className="bg-warning-soft/55 border-warning/35 flex items-center gap-3 rounded-2xl border p-3.5">
            <Mascot mood="thinking" size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-warning-ink font-bold">
                团团裁判：热身刚满 5 分钟，继续专注满 25 分钟再盖章吧～
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                「还差 20 分钟就凑满一个完整番茄钟啦！顺便记下今天印象最深的 2
                个新词，团团马上为你盖章～」
              </p>
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">
            判定结果：可暂存碎片时长，满 25 分钟后升级盖章
          </span>
          <Badge tone="neutral" icon="clock">
            待继续专注
          </Badge>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 03 组件：学习板块完整页面沙盒（PhoneFrame + 右侧场景切换器）
// ============================================================================

type StudyScenarioId = 'html-bfs-valid' | 'short-vocab-intercept' | 'photo-quiz-valid'

interface StudyScenarioPreset {
  id: StudyScenarioId
  title: string
  subtitle: string
  badge: string
  badgeTone: 'success' | 'warning'
  defaultMode: CheckinInputMode
  what: string
  minutes: number
  note: string
  scannerPreset: SmartSamplePreset
}

const STUDY_SCENARIOS: Record<StudyScenarioId, StudyScenarioPreset> = {
  'html-bfs-valid': {
    id: 'html-bfs-valid',
    title: '场景 A · 上传二叉树笔记 HTML（专注 45 分钟 · 有效打卡）',
    subtitle: 'HTML 正文自动去噪提纯 + 专注 45m ≥ 25m 门槛',
    badge: '有效打卡',
    badgeTone: 'success',
    defaultMode: 'smart-upload',
    what: '二叉树层序遍历与 BFS 队列快照笔记',
    minutes: 45,
    note: '掌握队列层长快照 levelSize 写法，完成 LeetCode 102/103，时间复杂度 O(n)',
    scannerPreset: {
      id: 'study-scan-html',
      module: 'study',
      goalTitle: '学一点',
      sourceKind: 'text',
      visualTitle: 'Day 12：二叉树层序遍历笔记.html',
      visualLines: [
        '已剥离 HTML 样式标签，提纯有效正文 680 字',
        '识别专注时长：45 分钟（完成 LeetCode 3 题）',
        '核心收获：BFS 队列层长快照，时间复杂度 O(n)',
      ],
      scanSteps: [
        '正在读取 HTML 笔记附件并剥离冗余标签…',
        '提炼学习主题「二叉树层序遍历」与 3 条算法要点',
        'AI 学习裁判：专注 45m ≥ 25m 且要点详实，符合有效打卡',
      ],
    },
  },
  'short-vocab-intercept': {
    id: 'short-vocab-intercept',
    title: '场景 B · 仅填「背单词」且时长 5 分钟（门槛拦截）',
    subtitle: '未满 25 分钟最低专注门槛，提示继续专注后再打卡',
    badge: '门槛拦截',
    badgeTone: 'warning',
    defaultMode: 'manual',
    what: '背单词',
    minutes: 5,
    note: '背了几个单词',
    scannerPreset: {
      id: 'study-scan-short',
      module: 'study',
      goalTitle: '学一点',
      sourceKind: 'text',
      visualTitle: '碎片单词记录 · 5 分钟',
      visualLines: [
        '学习主题：背单词（仅 5 分钟）',
        '距离 25 分钟最低番茄钟门槛还差 20 分钟',
        '建议：继续专注或补充今日掌握的核心词汇',
      ],
      scanSteps: [
        '正在核验专注时长与学习摘要…',
        '检测到专注时长仅 5 分钟（低于 25 分钟番茄钟底线）',
        'AI 学习裁判：建议继续专注满 25 分钟后再盖章',
      ],
    },
  },
  'photo-quiz-valid': {
    id: 'photo-quiz-valid',
    title: '场景 C · 拍照识别平板错题本截图（专注 35 分钟 · 有效打卡）',
    subtitle: '手写批注截图识别 + 专注 35m 达标',
    badge: '有效打卡',
    badgeTone: 'success',
    defaultMode: 'smart-capture',
    what: '高数定积分分部积分法错题复盘',
    minutes: 35,
    note: '理清“反对幂指三”选择 u 和 dv 的优先级，订正 4 道典型三角函数定积分错题',
    scannerPreset: {
      id: 'study-scan-photo',
      module: 'study',
      goalTitle: '学一点',
      sourceKind: 'image',
      visualTitle: '平板手写错题本实拍 · 4 道定积分',
      visualLines: [
        '识别手写标题：定积分分部积分法专项订正',
        '计时器角标：专注 35 分钟',
        '提炼规律：「反对幂指三」优先级口诀与边界代入',
      ],
      scanSteps: [
        '正在扫描平板错题本照片中的公式与红笔批注…',
        '提取主题「定积分分部积分法」及专注时长 35 分钟',
        'AI 学习裁判：时长与错题复盘均达标，可盖有效章',
      ],
    },
  },
}

export function StudyModulePhoneSandbox() {
  const [scenarioId, setScenarioId] = useState<StudyScenarioId>('html-bfs-valid')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-upload')
  const [minFocus, setMinFocus] = useState<MinFocusOption>('25')
  const [phase, setPhase] = useState<ScanPhase>('done')

  const [what, setWhat] = useState(STUDY_SCENARIOS['html-bfs-valid'].what)
  const [minutes, setMinutes] = useState<number | null>(STUDY_SCENARIOS['html-bfs-valid'].minutes)
  const [note, setNote] = useState(STUDY_SCENARIOS['html-bfs-valid'].note)
  const [submitResult, setSubmitResult] = useState<'stamped' | 'archived' | null>(null)

  const currentScenario = STUDY_SCENARIOS[scenarioId]
  const minFocusNum = Number(minFocus)
  const actualMinutes = minutes ?? 0
  const evaluation = evaluateStudyCheckin(what, actualMinutes, note, minFocusNum)

  function applyScenario(nextId: StudyScenarioId) {
    const preset = STUDY_SCENARIOS[nextId]
    setScenarioId(nextId)
    setInputMode(preset.defaultMode)
    setWhat(preset.what)
    setMinutes(preset.minutes)
    setNote(preset.note)
    setSubmitResult(null)
    if (preset.defaultMode !== 'manual') {
      setPhase('scanning')
    }
  }

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：360px 真实手机外框 */}
      <div
        className="flex justify-center max-lg:order-2"
        data-ann="playbook.modules.study.sandbox.phone"
      >
        <PhoneFrame fluid label="手机 · /goals/study/checkin（学一点专页）" className="h-[760px]">
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="学一点"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone="study">学习</Badge>}
              className="shrink-0 pt-10"
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 1. 顶部专注目标进度卡 + 三态输入 Tab */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon="study" tone="study" size="sm" />
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">
                        今日门槛：专注 ≥ {minFocus} 分钟 + 要点摘录
                      </p>
                      <p className="text-tiny text-muted truncate">
                        当前本次专注：{actualMinutes} / {minFocus} 分钟
                      </p>
                    </div>
                  </div>
                  <span className="font-display text-study-ink bg-study-soft text-tiny shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums">
                    {Math.min(100, Math.round((actualMinutes / minFocusNum) * 100))}%
                  </span>
                </div>
                <ProgressBar
                  value={actualMinutes}
                  max={minFocusNum}
                  tone="study"
                  size="sm"
                  label="本次专注时长达标度"
                />
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    setSubmitResult(null)
                    if (next !== 'manual') setPhase('scanning')
                  }}
                />
              </Card>

              {/* 2. 智能拍照/上传模式下挂载扫描镜 */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={currentScenario.scannerPreset}
                  phase={phase}
                  tone="study"
                  onRescan={() => setPhase('scanning')}
                />
              )}

              {/* 3. 学习表单与实时 AI 学习裁判卡 */}
              <Card className="flex flex-col gap-3 p-3.5">
                {submitResult ? (
                  <div className="flex flex-col items-center gap-2.5 py-4 text-center">
                    <div className="relative">
                      <Mascot mood={submitResult === 'stamped' ? 'cheer' : 'thinking'} size={76} />
                      {submitResult === 'stamped' && (
                        <Stamp
                          text="学一点"
                          caption={`${actualMinutes}m`}
                          tone="study"
                          animate
                          size={58}
                          className="absolute -top-2 -right-9"
                        />
                      )}
                    </div>
                    <Badge tone={submitResult === 'stamped' ? 'success' : 'warning'} dot>
                      {submitResult === 'stamped'
                        ? '已盖下学一点有效章 · 连击 +1'
                        : '已暂存碎片学习记录（凑满番茄钟后可升级盖章）'}
                    </Badge>
                    <p className="text-caption font-bold">
                      {what}（专注 {actualMinutes} 分钟）
                    </p>
                    <p className="text-tiny text-muted max-w-xs leading-relaxed">
                      {evaluation.verdictDetail}
                    </p>
                    <Button variant="soft" size="sm" onClick={() => setSubmitResult(null)}>
                      返回继续编辑
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-bold">
                        {inputMode === 'manual' ? '手动记录学习收获' : 'AI 提炼笔记草稿（可微调）'}
                      </span>
                      <Badge tone="study">
                        {inputMode === 'smart-upload'
                          ? 'HTML/TXT 提纯'
                          : inputMode === 'smart-capture'
                            ? '笔记截图识别'
                            : '手动录入'}
                      </Badge>
                    </div>

                    <Field label="学了什么" htmlFor="study-phone-what" aside="必填">
                      <Input
                        id="study-phone-what"
                        value={what}
                        onChange={(e) => {
                          setWhat(e.target.value)
                          setSubmitResult(null)
                        }}
                      />
                    </Field>

                    <Field
                      label="专注时长"
                      htmlFor="study-phone-min"
                      aside={`有效门槛 ≥ ${minFocus} 分钟`}
                    >
                      <NumberField
                        id="study-phone-min"
                        value={minutes}
                        onValueChange={(v) => {
                          setMinutes(v)
                          setSubmitResult(null)
                        }}
                        min={1}
                        max={600}
                        step={5}
                        unit="分钟"
                      />
                    </Field>

                    <Field label="核心收获与要点摘录" htmlFor="study-phone-note" aside="AI 核验项">
                      <Textarea
                        id="study-phone-note"
                        rows={2}
                        value={note}
                        onChange={(e) => {
                          setNote(e.target.value)
                          setSubmitResult(null)
                        }}
                      />
                    </Field>

                    {/* 实时 AI 学习裁判卡 */}
                    <div
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl border p-3',
                        evaluation.isValidCheckin
                          ? 'bg-study-soft/50 border-study/35'
                          : 'bg-warning-soft/55 border-warning/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            name={evaluation.isValidCheckin ? 'shield' : 'alert'}
                            size={15}
                            className={
                              evaluation.isValidCheckin ? 'text-study-ink' : 'text-warning-ink'
                            }
                          />
                          <span
                            className={cn(
                              'text-caption font-bold',
                              evaluation.isValidCheckin ? 'text-study-ink' : 'text-warning-ink',
                            )}
                          >
                            {evaluation.verdictTitle}
                          </span>
                        </div>
                        <Badge tone={evaluation.isValidCheckin ? 'success' : 'warning'}>
                          {evaluation.isValidCheckin ? '可盖章' : '待补足'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-surface/85 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
                          <span
                            className={cn(
                              'text-tiny font-bold',
                              evaluation.durationPassed ? 'text-success-ink' : 'text-danger-ink',
                            )}
                          >
                            {evaluation.durationPassed ? '✓' : '✕'}
                          </span>
                          <span className="text-tiny truncate font-semibold">
                            时长 {actualMinutes}m / {minFocus}m
                          </span>
                        </div>
                        <div className="bg-surface/85 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
                          <span
                            className={cn(
                              'text-tiny font-bold',
                              evaluation.contentPassed ? 'text-success-ink' : 'text-warning-ink',
                            )}
                          >
                            {evaluation.contentPassed ? '✓' : '!'}
                          </span>
                          <span className="text-tiny truncate font-semibold">
                            {evaluation.contentPassed ? '要点详实' : '要点过简'}
                          </span>
                        </div>
                      </div>

                      <p className="text-tiny text-muted leading-relaxed">
                        {evaluation.verdictDetail}
                      </p>
                    </div>

                    {evaluation.isValidCheckin ? (
                      <Button
                        icon="check"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('stamped')
                          toast.success(`学一点打卡成功：${what}（${actualMinutes} 分钟）`)
                        }}
                      >
                        确认记录 · 盖下学一点印章
                      </Button>
                    ) : (
                      <Button
                        variant="soft"
                        icon="clock"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('archived')
                          toast.info(
                            `已暂存碎片学习记录：${what}（还差 ${evaluation.shortByMinutes} 分钟满番茄钟）`,
                          )
                        }}
                      >
                        暂存碎片学习记录（满 {minFocus} 分钟再盖章）
                      </Button>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：沙盒场景切换控制台 */}
      <div
        className="flex min-w-0 flex-col gap-3.5"
        data-ann="playbook.modules.study.sandbox.console"
      >
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">学习裁判场景切换器（实时联动左侧手机）</span>
            <Badge tone="study" icon="sparkles">
              交互沙盒
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击切换下方 3
            种学习打卡场景，或在左侧手机框里用步进器加减「专注时长」，体验番茄钟门槛与实质内容核验的实时反馈：
          </p>

          <div className="flex flex-col gap-2">
            {(Object.keys(STUDY_SCENARIOS) as StudyScenarioId[]).map((key) => {
              const item = STUDY_SCENARIOS[key]
              const active = scenarioId === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyScenario(key)}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99]',
                    active
                      ? 'border-study bg-study-soft/60 shadow-soft'
                      : 'border-border bg-surface-sunken/60 hover:bg-surface-sunken',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-caption truncate font-bold">{item.title}</p>
                    <p className="text-tiny text-muted mt-0.5 truncate">{item.subtitle}</p>
                  </div>
                  <Badge tone={item.badgeTone}>{item.badge}</Badge>
                </button>
              )
            })}
          </div>

          <div className="border-border bg-surface-sunken/70 flex flex-col gap-2.5 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold">切换目标最低专注门槛（番茄钟档位）</span>
              <span className="text-tiny text-muted font-mono">门槛：≥ {minFocus} 分钟</span>
            </div>
            <SegmentedControl
              size="sm"
              label="沙盒最低专注时长"
              value={minFocus}
              onValueChange={(next) => {
                setMinFocus(next)
                setSubmitResult(null)
              }}
              options={[
                { value: '25', label: '≥ 25 分钟' },
                { value: '45', label: '≥ 45 分钟' },
                { value: '60', label: '≥ 60 分钟' },
              ]}
            />
            <p className="text-tiny text-muted">
              试试切换到「场景 B（5 分钟背单词）」，再点击左侧手机框里专注时长的「＋」号步进到 25
              分钟并补充一句收获，观察裁判卡实时变绿！
            </p>
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2 max-lg:hidden">
          <p className="text-caption font-bold">学一点板块设计要点</p>
          <ul className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li>
              • <strong className="text-foreground">HTML / TXT 笔记客户端去噪</strong>
              ：用户上传导出的网页笔记或 Markdown 时，前端先剥离 `&lt;script&gt;` / `&lt;style&gt;`
              与样式噪声，节省 AI 额度。
            </li>
            <li>
              • <strong className="text-foreground">番茄钟进度可视化</strong>
              ：顶栏下方实时展示「当前专注时长 / 最低专注门槛」百分比进度条。
            </li>
            <li>
              • <strong className="text-foreground">碎片学习不白费</strong>
              ：未满 25 分钟时允许「暂存碎片学习记录」，同一天多次碎片学习累计满门槛后可合并盖章。
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
