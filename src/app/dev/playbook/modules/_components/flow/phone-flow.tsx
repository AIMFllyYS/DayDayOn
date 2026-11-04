'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { CheckinModeTabs } from '../../../_components/smart-recognition-demos'
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
  const [scanning, setScanning] = useState(false)
  const [popup, setPopup] = useState(false)
  const [bonus, setBonus] = useState(0)
  const page = stack[stack.length - 1] ?? 'fill'
  const smart = mode !== 'manual'

  useEffect(() => {
    if (!scanning) return
    const t = setTimeout(() => setScanning(false), 1100)
    return () => clearTimeout(t)
  }, [scanning])

  const push = (p: Page) => setStack((s) => [...s, p])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  function changeMode(next: FlowMode) {
    if (next === mode) return
    setMode(next)
    onModeChange(next)
    // 手动：先填内容，第一个分区直接展开；智能：识别完先收起，让用户看结论
    setOpenId(next === 'manual' ? (sections[0]?.id ?? null) : null)
    setScanning(next !== 'manual')
  }

  function submit() {
    if (verdict.passed) setBonus((b) => b + 1)
    setPopup(true)
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {page === 'fill' && (
        <>
          <PageBar title={`${moduleMeta[config.tone].label}打卡`} onBack={() => undefined} />

          <div className="shrink-0 px-3.5 pt-1">
            <Card
              className="flex items-center gap-3 px-3 py-2.5"
              data-ann="playbook.modules.flow.header"
            >
              <IconTile icon={moduleMeta[config.tone].icon} tone={config.tone} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-caption truncate font-bold">{config.title}</span>
                <div className="flex items-center gap-1.5">
                  <TagChip icon="shield" label="达标规则" onClick={() => push('rules')} />
                  <TagChip icon="bulb" label="评判依据" onClick={() => push('basis')} />
                </div>
              </div>
              <ProgressRing
                value={config.progress.done + bonus}
                max={config.progress.total}
                tone={config.tone}
                size={56}
                thickness={6}
                label={`打卡周期 ${config.progress.done + bonus}/${config.progress.total} 天`}
                className="shrink-0"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="bg-success-soft text-success-ink inline-flex h-3.5 items-center rounded-full px-1.5 text-[0.5625rem] leading-none font-bold">
                    Day
                  </span>
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

          <SectionDivider />
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-3">
            {smart && <AiBar scanning={scanning} summary={aiSummary} mode={mode} />}
            {sections.map((s) => (
              <FillSection
                key={s.id}
                spec={s}
                tone={config.tone}
                open={openId === s.id}
                ai={smart && !scanning}
                onToggle={() => setOpenId((cur) => (cur === s.id ? null : s.id))}
              />
            ))}
          </div>

          <div className="border-border bg-background flex shrink-0 flex-col gap-2 border-t px-3.5 pt-2.5 pb-4">
            <p
              className={cn(
                'text-tiny text-center font-semibold',
                !canSubmit
                  ? 'text-subtle'
                  : verdict.passed
                    ? 'text-success-ink'
                    : 'text-warning-ink',
              )}
            >
              {canSubmit ? verdict.detail : '先填写内容，这里会实时告诉你能不能盖章'}
            </p>
            <Button
              variant={verdict.passed ? 'primary' : 'secondary'}
              icon={verdict.passed ? 'check' : 'alert'}
              className="w-full"
              disabled={!canSubmit || scanning}
              onClick={submit}
              data-ann="playbook.modules.flow.submit"
            >
              {verdict.passed ? '确认有效打卡' : '仅保存记录（不计有效打卡）'}
            </Button>
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
              <p className="text-tiny text-muted mt-1">{verdict.detail}</p>
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
              <Button variant="ghost" className="w-full" onClick={() => setPopup(false)}>
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
function TagChip({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-surface-sunken text-muted hover:text-foreground inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[0.625rem] leading-none font-semibold whitespace-nowrap transition-colors active:scale-95"
    >
      <Icon name={icon} size={9} />
      {label}
    </button>
  )
}

function AiBar({
  scanning,
  summary,
  mode,
}: {
  scanning: boolean
  summary: string
  mode: FlowMode
}) {
  return (
    <div
      className="bg-primary-soft text-primary-ink flex min-h-10 items-center gap-2 rounded-2xl px-3.5 py-2"
      data-ann="playbook.modules.flow.ai-bar"
    >
      <Icon
        name={scanning ? 'loader' : 'sparkles'}
        size={16}
        className={cn('shrink-0', scanning && 'animate-spin-slow')}
      />
      <span className="text-tiny font-semibold">
        {scanning
          ? mode === 'smart-capture'
            ? '正在识别照片…'
            : '正在解析文件…'
          : `AI 已识别：${summary}，点开下面各项可微调`}
      </span>
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
