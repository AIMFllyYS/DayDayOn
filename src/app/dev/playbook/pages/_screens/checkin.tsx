'use client'

import { useEffect, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { moduleMeta, moduleTones, softToneClass, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import {
  CheckinModeTabs,
  SMART_PRESETS,
  SmartScannerLens,
  smartModuleFillComponents,
  type CheckinInputMode,
  type ScanPhase,
} from '../../_components/smart-recognition-demos'

/*
 * 单板块打卡表单页预览（/goals/[goalId]/checkin）：
 * 5 大板块（运动 / 饮食 / 睡眠 / 学习 / 自定义）顶部统一配备相同的 Tab 栏：
 * 「手动填写（默认） | 智能拍照 | 智能上传」。
 * 由于进入本页时已知当前属于哪个打卡板块，切换到「智能拍照 / 智能上传」时无需再跑第 1 组件（板块判别器），
 * 直接 import 扫描镜 + 该板块对应的 SmartFill 子组件，分析后直接填充到表单中。
 * 手机端（360px）单列流式排布，桌面端（@3xl）左右双栏自适应排布。
 */

const GOAL_META: Record<
  ModuleTone,
  { progressText: string; value: number; max: number; streak: number; history: string[] }
> = {
  exercise: {
    progressText: '今日已完成 18 / 30 分钟',
    value: 18,
    max: 30,
    streak: 12,
    history: ['昨天 · 户外慢跑 32 分钟（205 kcal）', '前天 · 帕梅拉核心训练 25 分钟'],
  },
  diet: {
    progressText: '今日已记 1 / 3 餐',
    value: 1,
    max: 3,
    streak: 9,
    history: ['今天 08:10 · 早餐：全麦吐司 + 无糖豆浆（340 kcal）', '昨天 · 三餐均已记录'],
  },
  sleep: {
    progressText: '昨晚睡眠 7.2 / 8 小时',
    value: 7.2,
    max: 8,
    streak: 6,
    history: ['昨晚 · 23:20 → 07:05（质量 4/5）', '前晚 · 23:05 → 07:00（质量 5/5）'],
  },
  study: {
    progressText: '今日已完成 1 / 2 项专注',
    value: 1,
    max: 2,
    streak: 15,
    history: ['今天 10:00 · 背诵考研核心词 60 个（30 分钟）', '昨天 · 算法笔记整理 45 分钟'],
  },
  custom: {
    progressText: '今日已喝 5 / 8 杯温水',
    value: 5,
    max: 8,
    streak: 8,
    history: ['今天上午 · 已打卡 5 杯（1250ml）', '昨天 · 达成 8 杯温水目标'],
  },
}

export function CheckinScreen() {
  const [activeModule, setActiveModule] = useState<ModuleTone>('exercise')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('manual')
  const [phase, setPhase] = useState<ScanPhase>('done')
  const [stampedText, setStampedText] = useState<string | null>(null)
  const [customFileInfo, setCustomFileInfo] = useState<{
    name: string
    kind: 'image' | 'text'
    previewText?: string
    previewUrl?: string
  } | null>(null)

  const preset = SMART_PRESETS[activeModule]
  const meta = GOAL_META[activeModule]
  const FillComponent = smartModuleFillComponents[activeModule]

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div className="@container flex flex-col gap-3.5 pb-6" data-ann="playbook.pages.checkin">
      {/* 顶部切换查看 5 大打卡板块（每个板块都有完全相同的顶栏 Tab） */}
      <div className="border-border bg-surface/90 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
        <span className="text-tiny font-bold">切换预览 5 大打卡方向：</span>
        <div className="flex flex-wrap gap-1">
          {moduleTones.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setActiveModule(m)
                setStampedText(null)
                setCustomFileInfo(null)
              }}
              className={cn(
                'text-tiny inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-all',
                activeModule === m
                  ? cn(softToneClass[m], 'ring-2 ring-current/30')
                  : 'bg-surface-sunken text-muted hover:text-foreground',
              )}
            >
              <Icon name={moduleMeta[m].icon} size={13} />
              <span>{SMART_PRESETS[m].goalTitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 目标摘要头卡 + 全板块统一 Tab 栏（手动填写 | 智能拍照 | 智能上传） */}
      <Card className="flex min-w-0 flex-col gap-2.5 p-3.5 md:p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconTile icon={moduleMeta[activeModule].icon} tone={activeModule} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="text-caption truncate font-bold">{preset.goalTitle}</h3>
                <Badge tone={activeModule} className="shrink-0">
                  {moduleMeta[activeModule].label}
                </Badge>
              </div>
              <p className="text-tiny text-muted truncate">{meta.progressText}</p>
            </div>
          </div>
          <Badge tone="primary" icon="flame" className="shrink-0">
            连续 {meta.streak} 天
          </Badge>
        </div>

        <ProgressBar
          value={meta.value}
          max={meta.max}
          tone={activeModule}
          size="sm"
          label={preset.goalTitle}
        />

        {/* 核心统一 Tab 栏：默认进入是手动填数值，可切换智能拍照 / 智能上传 */}
        <CheckinModeTabs
          value={inputMode}
          onValueChange={(next) => {
            setInputMode(next)
            setStampedText(null)
            if (next !== 'manual') setPhase('scanning')
          }}
        />
      </Card>

      {/* 根据 Tab 模式切换内容区：手机端单列，桌面端（@3xl）左右双栏 */}
      {inputMode === 'manual' ? (
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 @3xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="flex min-w-0 flex-col gap-2.5 overflow-hidden p-3.5 md:p-4">
            <div className="border-border flex min-w-0 items-center justify-between gap-2 border-b pb-2">
              <span className="text-caption truncate font-bold">
                手动填写「{preset.goalTitle}」打卡数值
              </span>
              <Badge tone="neutral" className="shrink-0">
                默认 Tab · 手动模式
              </Badge>
            </div>
            {stampedText ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="relative">
                  <Mascot mood="cheer" size={84} />
                  <Stamp
                    caption="11.03"
                    tone={activeModule}
                    animate
                    size={60}
                    className="absolute -top-2 -right-9"
                  />
                </div>
                <p className="text-subhead font-bold">{stampedText}</p>
                <Button variant="soft" size="sm" onClick={() => setStampedText(null)}>
                  再记一笔
                </Button>
              </div>
            ) : (
              <FillComponent
                key={`${preset.id}-manual`}
                preset={preset}
                onConfirm={(summary) => {
                  setStampedText(summary)
                  toast.success(`已记录：${summary}`)
                }}
              />
            )}
          </Card>

          <Card variant="sunken" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold">最近打卡记录</span>
              <span className="text-tiny text-muted">可随时切到上方「智能拍照/上传」</span>
            </div>
            <ul className="space-y-2">
              {meta.history.map((h) => (
                <li
                  key={h}
                  className="border-border bg-surface text-tiny text-muted flex items-center gap-2 rounded-xl border px-3 py-2"
                >
                  <Icon name="check" size={14} className="text-success shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 @3xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* 左栏：直接挂载扫描镜（因为已知当前板块，无需挂载板块判别器！） */}
          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="border-primary/20 bg-primary-soft/50 text-primary-ink text-tiny flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2">
              <Icon name="sparkles" size={14} className="shrink-0" />
              <span className="min-w-0 break-words">
                当前已在
                <strong>
                  「{moduleMeta[activeModule].label} · {preset.goalTitle}」
                </strong>
                内，已自动跳过板块判别器，直接扫描并填入本板块表单。
              </span>
            </div>

            <SmartScannerLens
              preset={preset}
              phase={phase}
              tone={activeModule}
              customFileInfo={customFileInfo}
              onRescan={() => setPhase('scanning')}
              onPickLocalFile={(f) => {
                setCustomFileInfo({
                  name: f.name,
                  kind: f.type.startsWith('image/') ? 'image' : 'text',
                  previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                })
                setPhase('scanning')
              }}
            />
          </div>

          {/* 右栏：当前板块的专属填充子组件 */}
          <Card className="flex min-w-0 flex-col gap-2.5 overflow-hidden p-3.5 md:p-4">
            <div className="border-border flex min-w-0 items-center justify-between gap-2 border-b pb-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-caption truncate font-bold">
                  AI 识别填充 · {moduleMeta[activeModule].label}SmartFill
                </span>
              </div>
              <Badge tone={activeModule} icon="sparkles" className="shrink-0">
                {inputMode === 'smart-capture' ? '智能拍照识别' : '智能上传识别'}
              </Badge>
            </div>

            {stampedText ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="relative">
                  <Mascot mood="cheer" size={84} />
                  <Stamp
                    caption="11.03"
                    tone={activeModule}
                    animate
                    size={60}
                    className="absolute -top-2 -right-9"
                  />
                </div>
                <p className="text-subhead font-bold">{stampedText}</p>
                <Button variant="soft" size="sm" onClick={() => setStampedText(null)}>
                  返回继续微调
                </Button>
              </div>
            ) : (
              <FillComponent
                key={`${preset.id}-${inputMode}`}
                preset={preset}
                onConfirm={(summary) => {
                  setStampedText(summary)
                  toast.success(`智能识别已入库：${summary}`)
                }}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
