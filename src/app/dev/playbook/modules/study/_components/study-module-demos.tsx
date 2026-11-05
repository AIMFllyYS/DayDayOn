'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { deckClass } from '../../_components/deck'

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
                  机制 02 · 笔记整理与实质内容核验
                </h3>
                <p className="text-tiny text-muted truncate">支持上传导出的笔记或刷题截图</p>
              </div>
            </div>
            <Badge tone="primary" icon="sparkles">
              AI 核验
            </Badge>
          </div>

          {/* 原始 HTML 附件 -> 提纯核心要点对比 */}
          <div className="bg-surface-sunken flex flex-col gap-2.5 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-muted font-semibold">你上传的笔记：</span>
            </div>

            <div className="bg-surface border-border rounded-xl border p-2.5">
              <p className="text-tiny text-muted leading-relaxed">
                Day 12 二叉树层序遍历：利用队列记录每层 size 快照，时间复杂度 O(n)……
              </p>
            </div>

            <div className="flex items-center gap-1.5 px-1">
              <Icon name="sparkles" size={14} className="text-study-ink shrink-0" />
              <span className="text-tiny text-study-ink font-semibold">
                Agent 自动整理出要点，并核验是否真的学到了东西：
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
                <li>• 核心方法：用队列逐层遍历，每层开始前先记下这一层的节点数</li>
                <li>• 复杂度分析：每个节点入队出队各一次，时间和空间都是 O(n)</li>
              </ul>
            </div>
          </div>

          <p className="text-tiny text-muted leading-relaxed">
            无论是 Notion / 语雀导出的笔记、纯文本读书摘抄，还是平板手写题库截图，Agent
            都会自动整理今日掌握的知识点填入「要点摘录」，省去手打长文的繁琐。
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
                  场景 A · 上传二叉树笔记 · 专注 45 分钟
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
                <span className="text-caption font-semibold">实质内容核验（笔记整理）</span>
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
              <span className="text-tiny text-muted font-semibold">当前填写的内容</span>
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
