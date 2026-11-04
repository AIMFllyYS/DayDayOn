'use client'

import { useEffect, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { moduleMeta, moduleTones, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import {
  SMART_PRESETS,
  SmartModuleDetector,
  SmartScannerLens,
  smartModuleFillComponents,
  type ScanPhase,
} from '../../_components/smart-recognition-demos'

/*
 * 智能识别页面预览（/checkin/smart）：
 * 从打卡弹层底部「智能拍照」或「智能上传」进入的二级页面（隐藏底栏，顶栏带返回）。
 * 手机端（360px）：纵向三段流（扫描镜 + 组件1一行识别方向条 + 组件2五选一板块填充表单）。
 * 桌面端（@3xl ≥1000px）：自适应左右双栏（左栏：扫描镜取景 + 一行识别方向条；右栏：组件2动态挂载的板块表单）。
 */

export function SmartCheckinScreen() {
  const [sampleKey, setSampleKey] = useState<ModuleTone>('exercise')
  const [selectedModule, setSelectedModule] = useState<ModuleTone>('exercise')
  const [phase, setPhase] = useState<ScanPhase>('done')
  const [stampedText, setStampedText] = useState<string | null>(null)

  const preset = SMART_PRESETS[sampleKey]
  const activePreset = SMART_PRESETS[selectedModule]
  const FillComponent = smartModuleFillComponents[selectedModule]

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 1000)
    return () => clearTimeout(timer)
  }, [phase])

  function switchSample(m: ModuleTone) {
    setSampleKey(m)
    setSelectedModule(m)
    setStampedText(null)
    setPhase('scanning')
  }

  return (
    <div className="@container flex flex-col gap-3.5 pb-6" data-ann="playbook.pages.smart-checkin">
      {/* 顶部样本快捷切换条：方便在页面预览里一键测试 5 种不同图片/HTML/TXT 输入 */}
      <div className="border-border bg-surface/90 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Icon name="sparkles" size={14} className="text-primary-ink" />
          <span className="text-tiny font-bold">测试不同上传内容：</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {moduleTones.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchSample(m)}
              className={cn(
                'text-tiny inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-all',
                sampleKey === m
                  ? 'bg-primary text-on-primary shadow-2xs'
                  : 'bg-surface-sunken text-muted hover:text-foreground',
              )}
            >
              <Icon name={moduleMeta[m].icon} size={12} lineOnly={sampleKey === m} />
              <span>
                {m === 'study'
                  ? '学习HTML'
                  : m === 'custom'
                    ? '饮水TXT'
                    : `${moduleMeta[m].label}图`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 主体：手机端单列纵向流，桌面端（@3xl）左右双栏 */}
      <div className="grid items-start gap-4 @3xl:grid-cols-[370px_minmax(0,1fr)]">
        {/* 左栏：扫描镜取景器 + 组件 01 一行识别方向条 */}
        <div className="flex min-w-0 flex-col gap-3">
          <SmartScannerLens
            preset={preset}
            phase={phase}
            tone={selectedModule}
            onRescan={() => setPhase('scanning')}
          />

          <SmartModuleDetector
            detectedModule={preset.module}
            selectedModule={selectedModule}
            scanning={phase === 'scanning'}
            onSelectModule={(m) => {
              setSelectedModule(m)
              setStampedText(null)
            }}
          />
        </div>

        {/* 右栏：组件 02 · 根据识别出的板块动态加载 5 选 1 填充子组件 */}
        <Card className="flex min-w-0 flex-col gap-3.5">
          <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={moduleMeta[selectedModule].icon} tone={selectedModule} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-subhead truncate font-bold">{activePreset.goalTitle}</span>
                  <Badge tone={selectedModule}>{moduleMeta[selectedModule].label}</Badge>
                </div>
                <p className="text-tiny text-muted truncate">
                  AI 已自动填入识别数值，核对无误后点击底部确认即可入库
                </p>
              </div>
            </div>
          </div>

          {stampedText ? (
            <div className="flex flex-col items-center gap-2.5 py-8 text-center">
              <div className="relative">
                <Mascot mood="cheer" size={88} />
                <Stamp
                  caption="11.03"
                  tone={selectedModule}
                  animate
                  size={64}
                  className="absolute -top-2 -right-10"
                />
              </div>
              <p className="text-subhead font-bold">{stampedText}</p>
              <p className="text-tiny text-muted">
                已确认入库并盖章，原始图片/附件已在内存中自动释放（ADR-0002）
              </p>
              <Button variant="soft" size="sm" onClick={() => setStampedText(null)}>
                返回继续编辑
              </Button>
            </div>
          ) : (
            <FillComponent
              key={activePreset.id}
              preset={activePreset}
              onConfirm={(summary) => {
                setStampedText(summary)
                toast.success(summary)
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
