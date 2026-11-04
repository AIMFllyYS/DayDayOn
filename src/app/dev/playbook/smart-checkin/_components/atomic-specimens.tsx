'use client'

import { useState } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/components/ui/toast'
import { moduleMeta, moduleTones, softToneClass, type ModuleTone } from '@/components/ui/tone'
import { SmartPartitionSearchLoader } from '@/features/checkin/components/smart-magic-stream'
import { cn } from '@/lib/cn'
import { Specimen } from '../../_components/section'
import {
  CheckinModeTabs,
  CustomSmartFill,
  DietSmartFill,
  ExerciseSmartFill,
  SMART_PRESETS,
  SleepSmartFill,
  SmartModuleDetector,
  SmartScannerLens,
  StudySmartFill,
  type CheckinInputMode,
} from '../../_components/smart-recognition-demos'

// ============================================================================
// 1. 扫描镜原子组件（SmartScannerLens）四种核心状态机拆解
//    顶部仅保留状态指示与「重新扫描」，不放多余小标签与文件名路径
// ============================================================================

export function ScannerLensStatesMatrix() {
  const [interactivePhase, setInteractivePhase] = useState<'scanning' | 'done'>('scanning')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 状态 1：待上传 / 待拍摄空状态（Idle Dropzone） */}
      <Specimen
        ann="playbook.smart.scanner.idle"
        label="状态 01 · 待拍摄 / 待上传空状态（Idle）"
        note="单板块切到智能 Tab 或刚进入尚未选文件时的手账取景空状态"
        bg="paper"
      >
        <div className="border-border bg-surface shadow-soft flex w-full min-w-0 flex-col gap-2.5 rounded-2xl border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-border-strong size-2 shrink-0 rounded-full" />
              <span className="text-caption font-bold">等待放入图片或文本</span>
            </div>
          </div>
          <div className="border-primary/30 bg-surface-sunken/70 relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center">
            <span className="border-primary/60 pointer-events-none absolute top-2 left-2 size-3.5 rounded-tl-md border-t-2 border-l-2" />
            <span className="border-primary/60 pointer-events-none absolute top-2 right-2 size-3.5 rounded-tr-md border-t-2 border-r-2" />
            <span className="border-primary/60 pointer-events-none absolute bottom-2 left-2 size-3.5 rounded-bl-md border-b-2 border-l-2" />
            <span className="border-primary/60 pointer-events-none absolute right-2 bottom-2 size-3.5 rounded-br-md border-r-2 border-b-2" />

            <div className="flex items-center gap-2">
              <IconTile icon="camera" tone="primary" size="md" />
              <IconTile icon="sparkles" tone="diet" size="md" />
            </div>
            <p className="text-caption font-bold">把照片、截图或笔记放进扫描镜</p>
            <p className="text-tiny text-muted">
              支持拍照、相册选图（内存压缩不落盘），或上传 HTML / TXT 纯文本
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="soft"
                icon="camera"
                onClick={() => toast.info('已拉起相机 / 相册选择')}
              >
                拍照 / 选图
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="sparkles"
                onClick={() => toast.info('已拉起图片与 HTML/TXT 文件选择器')}
              >
                上传文件
              </Button>
            </div>
          </div>
        </div>
      </Specimen>

      {/* 状态 2：图片媒介 · 扫描进行中（Scanning · Image） */}
      <Specimen
        ann="playbook.smart.scanner.scanning-image"
        label="状态 02 · 图片扫描进行中（Scanning）"
        note="顶部仅保留状态与「重新扫描」；取景框内光束呼吸扫过，下方 3 步实时推进"
        bg="paper"
      >
        <div className="w-full min-w-0">
          <SmartScannerLens
            preset={SMART_PRESETS.exercise}
            phase={interactivePhase}
            onRescan={() => setInteractivePhase((p) => (p === 'scanning' ? 'done' : 'scanning'))}
          />
        </div>
      </Specimen>

      {/* 状态 3：纯文本 HTML / TXT 媒介 · 扫描完成（Done · Text/HTML） */}
      <Specimen
        ann="playbook.smart.scanner.done-text"
        label="状态 03 · 纯文本（HTML / TXT）扫描完成定格（Done）"
        note="不展示冗长文件名路径与多余标签；光束收起，3 步分析轨迹全部打勾"
        bg="paper"
      >
        <div className="w-full min-w-0">
          <SmartScannerLens
            preset={SMART_PRESETS.study}
            phase="done"
            onRescan={() => toast.info('已触发重新扫描')}
          />
        </div>
      </Specimen>

      {/* 状态 4：图片模糊 / 文本无打卡内容 · 温和降级态（Fallback） */}
      <Specimen
        ann="playbook.smart.scanner.fallback"
        label="状态 04 · 智能上传不识别温和降级态（Fallback）"
        note="当上传内容未能识别出打卡指标时，按钮文案显示为「重新上传」并提供手动填写兜底"
        bg="paper"
      >
        <div className="border-warning/35 bg-surface shadow-soft flex w-full min-w-0 flex-col gap-3 rounded-2xl border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-warning size-2 shrink-0 rounded-full" />
              <span className="text-caption font-bold">未能识别出有效打卡数据</span>
            </div>
            <button
              type="button"
              onClick={() => toast.info('已拉起文件选择器重新上传')}
              className="text-primary-ink hover:bg-primary-soft/60 text-tiny inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold"
            >
              <Icon name="sparkles" size={13} />
              <span>重新上传</span>
            </button>
          </div>
          <div className="bg-warning-soft/45 border-warning/25 rounded-xl border p-3">
            <p className="text-tiny text-muted leading-relaxed">
              上传的图片光线较暗或文本不含打卡指标，团团没能准确解析出数据。你可以点击「重新上传」换一份文件，或直接切换为手动填写（不重复扣额度）。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="soft"
              icon="sparkles"
              onClick={() => toast.info('已拉起文件选择器重新上传')}
            >
              重新上传
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="edit"
              onClick={() => toast.info('已切换至手动填写表单')}
            >
              直接手动填写
            </Button>
          </div>
        </div>
      </Specimen>
    </div>
  )
}

// ============================================================================
// 2. 第 1 核心组件：板块智能判别器（SmartModuleDetector）与分区搜索动画
// ============================================================================

export function ModuleDetectorStatesMatrix() {
  const [selectedAuto, setSelectedAuto] = useState<ModuleTone>('diet')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Specimen
        ann="playbook.smart.detector.searching"
        label="状态 A · 扫描中：正在搜索哪个打卡分区（SmartPartitionSearchLoader）"
        note="扫描尚未得出结果前，不提前暴露下方表单，展示旋转搜索图标与 5 大分区探照灯轮询动画"
        bg="paper"
      >
        <div className="w-full min-w-0">
          <SmartPartitionSearchLoader />
        </div>
      </Specimen>

      <Specimen
        ann="playbook.smart.detector.auto"
        label="状态 B · 识别完成：锁定分区并支持点选秒切（SmartModuleDetector）"
        note="确定结果后魔法弹入并高亮识别出的「饮食」方向，用户也可点击同行胶囊秒切板块"
        bg="paper"
      >
        <div className="w-full min-w-0">
          <SmartModuleDetector
            detectedModule="diet"
            selectedModule={selectedAuto}
            magicHighlight
            onSelectModule={setSelectedAuto}
          />
        </div>
      </Specimen>
    </div>
  )
}

// ============================================================================
// 3. 第 2 核心组件：5 大打卡板块专属填充子组件全景矩阵
//    严格采用每行 2 张卡片（md:grid-cols-2），模拟真实手机宽度，根除窄列挤压溢出
// ============================================================================

export function FiveModulesSubComponentMatrix() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 2.1 运动子组件 */}
      <Card data-ann="playbook.smart.sub.exercise" className="flex min-w-0 flex-col gap-3">
        <div className="border-border flex items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon="exercise" tone="exercise" size="sm" />
            <div className="min-w-0">
              <p className="text-caption truncate font-bold">动一动 · ExerciseSmartFill</p>
              <p className="text-tiny text-muted truncate">运动品类 + 时长 + 强度 + 备注</p>
            </div>
          </div>
          <Badge tone="exercise">运动</Badge>
        </div>
        <ExerciseSmartFill preset={SMART_PRESETS.exercise} onConfirm={(s) => toast.success(s)} />
      </Card>

      {/* 2.2 饮食子组件 */}
      <Card data-ann="playbook.smart.sub.diet" className="flex min-w-0 flex-col gap-3">
        <div className="border-border flex items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon="diet" tone="diet" size="sm" />
            <div className="min-w-0">
              <p className="text-caption truncate font-bold">好好吃饭 · DietSmartFill</p>
              <p className="text-tiny text-muted truncate">餐次切换 + 食物清单可编辑 + 热量合计</p>
            </div>
          </div>
          <Badge tone="diet">饮食</Badge>
        </div>
        <DietSmartFill preset={SMART_PRESETS.diet} onConfirm={(s) => toast.success(s)} />
      </Card>

      {/* 2.3 睡眠子组件 */}
      <Card data-ann="playbook.smart.sub.sleep" className="flex min-w-0 flex-col gap-3">
        <div className="border-border flex items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon="sleep" tone="sleep" size="sm" />
            <div className="min-w-0">
              <p className="text-caption truncate font-bold">早点睡 · SleepSmartFill</p>
              <p className="text-tiny text-muted truncate">跨午夜起止时间 + 睡眠质量表情评分</p>
            </div>
          </div>
          <Badge tone="sleep">睡眠</Badge>
        </div>
        <SleepSmartFill preset={SMART_PRESETS.sleep} onConfirm={(s) => toast.success(s)} />
      </Card>

      {/* 2.4 学习子组件 */}
      <Card data-ann="playbook.smart.sub.study" className="flex min-w-0 flex-col gap-3">
        <div className="border-border flex items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon="study" tone="study" size="sm" />
            <div className="min-w-0">
              <p className="text-caption truncate font-bold">学一点 · StudySmartFill</p>
              <p className="text-tiny text-muted truncate">学习主题 + 专注时长 + HTML/TXT 摘录</p>
            </div>
          </div>
          <Badge tone="study">学习</Badge>
        </div>
        <StudySmartFill preset={SMART_PRESETS.study} onConfirm={(s) => toast.success(s)} />
      </Card>

      {/* 2.5 自定义子组件 */}
      <Card data-ann="playbook.smart.sub.custom" className="flex min-w-0 flex-col gap-3">
        <div className="border-border flex items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon="custom" tone="custom" size="sm" />
            <div className="min-w-0">
              <p className="text-caption truncate font-bold">我的小目标 · CustomSmartFill</p>
              <p className="text-tiny text-muted truncate">按自定义目标字段自动映射填入</p>
            </div>
          </div>
          <Badge tone="custom">自定义</Badge>
        </div>
        <CustomSmartFill preset={SMART_PRESETS.custom} onConfirm={(s) => toast.success(s)} />
      </Card>

      {/* 第 6 格：5 项静态映射与双路径复用说明卡（保持 2 列网格对称） */}
      <Card
        variant="sunken"
        data-ann="playbook.smart.sub.architecture"
        className="flex min-w-0 flex-col justify-between gap-3"
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="primary" icon="bulb">
              5 项静态映射 · 免复杂注册表
            </Badge>
            <span className="text-tiny text-muted font-mono">Record&lt;ModuleTone, FC&gt;</span>
          </div>
          <h4 className="text-subhead font-bold">为什么拆成 5 个独立子组件最清爽？</h4>
          <ul className="text-caption text-muted space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">全局智能识别页</strong>
                ：先由「一行识别方向条」给出 `module`，再从静态字典取出对应子组件填入数据。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">5 个独立打卡页顶部 Tab</strong>
                ：已知当前属于哪个板块，切到「智能拍照 / 智能上传」时
                <strong className="text-primary-ink">直接跳过识别方向条</strong>，import
                扫描镜与当前板块子组件即可。
              </span>
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {moduleTones.map((m) => (
            <Badge key={m} tone={m} icon={moduleMeta[m].icon}>
              {moduleMeta[m].label}SmartFill
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// 4. 全板块统一顶部 Tab 栏（CheckinModeTabs）三态 Specimen 展示
// ============================================================================

export function CheckinModeTabsMatrix() {
  const [demoTab, setDemoTab] = useState<CheckinInputMode>('manual')
  const [previewTone, setPreviewTone] = useState<ModuleTone>('exercise')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Specimen
        ann="playbook.smart.tabs.states"
        label="三态静态对照（默认手动填写 / 智能拍照 / 智能上传）"
        note="5 个打卡板块顶部全部采用此一模一样的 3 栏胶囊 Tab"
        bg="paper"
      >
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">
              1. 默认进入态（manual · 手动填写数值）
            </span>
            <CheckinModeTabs value="manual" onValueChange={() => {}} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">
              2. 切换至智能拍照（smart-capture · 拉起相机或拍截图）
            </span>
            <CheckinModeTabs value="smart-capture" onValueChange={() => {}} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-tiny text-muted font-semibold">
              3. 切换至智能上传（smart-upload · 传相册图 / HTML / TXT）
            </span>
            <CheckinModeTabs value="smart-upload" onValueChange={() => {}} />
          </div>
        </div>
      </Specimen>

      <Specimen
        ann="playbook.smart.tabs.interactive"
        label="单板块顶栏 + Tab 组合头部（支持切换 5 大板块看配色协调度）"
        note="点选不同板块，观察统一 Tab 栏在 5 种马卡龙板块色下的视觉一致性"
        bg="paper"
      >
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {moduleTones.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPreviewTone(m)}
                className={cn(
                  'text-tiny inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-all',
                  previewTone === m
                    ? cn(softToneClass[m], 'ring-2 ring-current/30')
                    : 'bg-surface text-muted hover:text-foreground',
                )}
              >
                <Icon name={moduleMeta[m].icon} size={13} />
                <span>{moduleMeta[m].label}</span>
              </button>
            ))}
          </div>

          <div className="border-border bg-surface shadow-soft flex flex-col gap-3 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <IconTile icon={moduleMeta[previewTone].icon} tone={previewTone} size="md" />
                <div className="min-w-0">
                  <p className="text-caption truncate font-bold">
                    {SMART_PRESETS[previewTone].goalTitle}
                  </p>
                  <p className="text-tiny text-muted truncate">
                    已知板块：{moduleMeta[previewTone].label}（切换智能 Tab 时免判别）
                  </p>
                </div>
              </div>
              <Badge tone={previewTone}>{moduleMeta[previewTone].label}</Badge>
            </div>
            <CheckinModeTabs value={demoTab} onValueChange={setDemoTab} />
          </div>
        </div>
      </Specimen>
    </div>
  )
}
