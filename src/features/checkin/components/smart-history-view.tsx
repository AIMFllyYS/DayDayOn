'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'
import { PhotoAlbumSheet } from '@/components/ui/photo-album-sheet'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { captureNativeHighResPhoto, isNativeApp } from '@/lib/native'
import { calendarDateOf, formatMonthDay } from '@/lib/time'
import type { SmartHistoryRecord, SmartInputMode } from '../smart-handoff'
import { SmartMagicTurnBanner } from './smart-magic-stream'
import { SMART_IMAGE_ACCEPT, SMART_UPLOAD_ACCEPT } from './smart-scanner'

/*
 * 历史识别记录与打卡历史模块（/checkin/smart 历史列表与只读详情）：
 * 1. SmartHistoryListView：
 *    - 单页触底布局（100dvh 减去顶栏高度，并抵消 AppShell 底部导航预留 padding）；
 *    - 顶部为概要与「智能拍照 / 智能上传」双栏快捷入口卡片（上下分层，杜绝文字挤压省略）；
 *    - 下方为类表格结构的历史记录容器，下沿直接触底（0 间隙贴合屏幕底边），内部独立滚动。
 * 2. SmartHistoryDetailView：
 *    - 纯只读回看模式：展示当时记录的图片相对路径、无原图隐私提示、1/2/3 识别步骤与结构化识别明细；
 *    - 不挂载可编辑打卡表单，点击左上角返回键或页面内返回按钮均直接回退至历史记录列表，绝不触发未确认退出弹窗。
 */

export interface SmartHistoryListViewProps {
  records: readonly SmartHistoryRecord[]
  activeRecordId: string | null
  timeZone: string
  onSelectRecord: (record: SmartHistoryRecord) => void
  onDeleteRecord: (id: string) => void
  onStartNewScan: (file: File, mode: SmartInputMode, files?: File[]) => void
}

export function SmartHistoryListView({
  records,
  activeRecordId,
  timeZone,
  onSelectRecord,
  onDeleteRecord,
  onStartNewScan,
}: SmartHistoryListViewProps) {
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [albumOpen, setAlbumOpen] = useState(false)

  function handleCaptureChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onStartNewScan(file, 'smart-capture', [file])
  }

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (files[0]) onStartNewScan(files[0], 'smart-upload', files)
  }

  async function handleCaptureClick() {
    if (isNativeApp()) {
      try {
        const file = await captureNativeHighResPhoto()
        if (file) {
          onStartNewScan(file, 'smart-capture', [file])
          return
        }
      } catch {
        toast.error('未开启相机权限，无法调用手机原生相机', {
          description: '请前往「我的 → 权限管理」开启相机权限',
        })
        return
      }
    }
    captureInputRef.current?.click()
  }

  return (
    <div
      data-testid="smart-history-list-page"
      className="mx-auto -mb-[calc(var(--safe-bottom)+6.5rem)] flex h-[calc(100dvh-2.75rem-var(--safe-top,0px))] w-full max-w-lg min-w-0 flex-1 flex-col gap-3 overflow-hidden pt-1.5 md:-mb-8 md:h-[calc(100dvh-4.25rem)]"
    >
      <input
        ref={captureInputRef}
        type="file"
        accept={SMART_IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCaptureChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept={SMART_UPLOAD_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleUploadChange}
      />
      <PhotoAlbumSheet
        open={albumOpen}
        onOpenChange={setAlbumOpen}
        maxSelect={9}
        onConfirm={(files) => {
          if (files[0]) onStartNewScan(files[0], 'smart-upload', files)
        }}
      />

      {/* 顶部概要与快捷操作卡片（上下分层，标题完整显示不截断） */}
      <Card className="flex shrink-0 flex-col gap-3 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconTile icon="clock" tone="primary" size="sm" />
            <div className="min-w-0 flex-1">
              <h2 className="text-caption font-bold">识别与打卡历史记录</h2>
              <p className="text-tiny text-muted truncate">
                仅保存图片相对路径 · 点击任意记录进入只读详情
              </p>
            </div>
          </div>
          <Badge tone="neutral" className="shrink-0">
            共 {records.length} 条
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="soft"
            icon="camera"
            className="h-9 w-full"
            onClick={() => void handleCaptureClick()}
          >
            智能拍照
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="sparkles"
            className="h-9 w-full"
            onClick={() => setAlbumOpen(true)}
          >
            智能上传
          </Button>
        </div>
      </Card>

      {/* 下方类表格历史记录容器：直接触底贴合视口最底边（border-b-0 + rounded-t-3xl），内部独立滚动 */}
      <div
        data-testid="smart-history-table-container"
        className="border-border bg-surface shadow-soft flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-x border-t border-b-0 pb-[var(--safe-bottom,0px)]"
      >
        {/* 表头栏 */}
        <div className="bg-surface-sunken/75 border-border text-muted text-tiny flex shrink-0 items-center justify-between border-b px-4 py-2.5 font-semibold">
          <span>识别记录 / 图片相对路径</span>
          <span>状态 · 日期 · 操作</span>
        </div>

        {/* 表格内容行 */}
        <div
          role="list"
          aria-label="历史智能拍摄与上传记录列表"
          className="divide-border flex min-h-0 flex-1 flex-col divide-y overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          {records.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-12">
              <EmptyState
                size="compact"
                title="还没有历史拍摄或上传记录"
                description="点击上方「智能拍照」或「智能上传」，识别出的记录会自动保存在这里"
              />
            </div>
          ) : (
            <>
              {records.map((record) => {
                const mod = record.result.draft.detectedModule
                const isSelected = record.id === activeRecordId
                const paths =
                  record.relativeImagePaths && record.relativeImagePaths.length > 0
                    ? record.relativeImagePaths
                    : [record.relativeImagePath ?? `captures/${record.fileName}`]
                const relPath = paths.join(' · ')
                return (
                  <div
                    key={record.id}
                    role="listitem"
                    className={cn(
                      'group flex w-full min-w-0 items-center gap-1 pr-2 transition-colors',
                      isSelected
                        ? 'bg-primary-soft/65 text-foreground'
                        : 'text-muted hover:bg-surface-sunken/60 hover:text-foreground',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectRecord(record)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3.5 text-left"
                    >
                      <IconTile icon={moduleMeta[mod].icon} tone={mod} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-foreground truncate font-semibold">
                          {record.result.draft.summary}
                        </p>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className="bg-surface-sunken text-subtle text-tiny shrink-0 rounded-md px-1.5 py-0.5 font-medium">
                            {record.mode === 'smart-capture' ? '智能拍照' : '智能上传'}
                          </span>
                          <span className="text-tiny text-muted min-w-0 flex-1 truncate font-mono">
                            {relPath}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 pl-1">
                        <Badge tone={record.confirmed ? 'success' : 'neutral'} className="shrink-0">
                          {record.confirmed ? '已记录' : '只读快照'}
                        </Badge>
                        <span className="text-tiny text-subtle tabular-nums">
                          {formatMonthDay(calendarDateOf(record.createdAt, timeZone))}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除记录 ${record.result.draft.summary}`}
                      onClick={() => onDeleteRecord(record.id)}
                      className="text-subtle hover:text-danger-ink hover:bg-danger-soft/40 flex size-8 shrink-0 items-center justify-center rounded-full opacity-75 transition-colors hover:opacity-100"
                    >
                      <Icon name="trash" size={14} lineOnly />
                    </button>
                  </div>
                )
              })}
              <div className="border-border text-subtle text-tiny border-t px-4 py-3 text-center">
                已展示全部 {records.length} 条识别记录 · 仅保留图片相对路径
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export interface SmartHistoryDetailViewProps {
  record: SmartHistoryRecord
  timeZone: string
  onBackToList: () => void
}

const MEAL_LABELS: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

const INTENSITY_LABELS: Record<'easy' | 'moderate' | 'hard', string> = {
  easy: '轻松',
  moderate: '适中',
  hard: '高强度',
}

/**
 * 历史拍摄 / 上传记录纯只读详情视图：
 * - 展示当时识别的图片相对路径、无原图隐私提示、1/2/3 识别轨迹与结构化识别结果；
 * - 纯只读展示，不挂载可编辑打卡表单；退出时直接回退到历史记录列表，不触发确认弹窗。
 */
export function SmartHistoryDetailView({
  record,
  timeZone,
  onBackToList,
}: SmartHistoryDetailViewProps) {
  const { draft } = record.result
  const mod = draft.detectedModule
  const paths =
    record.relativeImagePaths && record.relativeImagePaths.length > 0
      ? record.relativeImagePaths
      : [record.relativeImagePath ?? `captures/${record.fileName}`]
  const relPath = paths.join(' · ')
  const detailRows = buildReadonlyDetailRows(record)

  return (
    <div
      data-testid="smart-history-detail-view"
      className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 pt-1.5 pb-6"
    >
      {/* 顶部返回历史列表快捷导航条 */}
      <div className="bg-surface-sunken/75 flex min-w-0 items-center justify-between gap-2 rounded-full px-3 py-1.5">
        <button
          type="button"
          onClick={onBackToList}
          className="text-primary-ink text-tiny inline-flex items-center gap-1 font-semibold hover:underline"
        >
          <Icon name="chevron-left" size={14} lineOnly />
          <span>返回历史记录列表</span>
        </button>
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge tone="neutral">只读模式</Badge>
          <span className="text-tiny text-muted truncate">
            {formatMonthDay(calendarDateOf(record.createdAt, timeZone))} ·{' '}
            {record.mode === 'smart-capture' ? '智能拍照' : '智能上传'}
          </span>
        </div>
      </div>

      {/* 1. 只读扫描快照卡片（展示图片相对路径 + 无原图小提示 + 1/2/3 步骤） */}
      <Card className="flex w-full min-w-0 flex-col gap-2.5 overflow-hidden p-3.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="bg-success size-2 shrink-0 rounded-full" />
            <span className="text-caption truncate font-bold">
              {record.mode === 'smart-capture' ? '历史拍摄记录回看' : '历史上传记录回看'}
            </span>
          </div>
          <Badge tone={record.confirmed ? 'success' : 'neutral'} className="shrink-0">
            {record.confirmed
              ? `已记录${record.confirmedGoalTitle ? ` · ${record.confirmedGoalTitle}` : ''}`
              : '历史识别快照'}
          </Badge>
        </div>

        <div className="bg-surface-sunken border-border-strong relative flex min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-4 text-center">
          <IconTile
            icon={record.mode === 'smart-capture' ? 'camera' : moduleMeta[mod].icon}
            tone={mod}
            size="sm"
          />
          <div className="max-w-full min-w-0 space-y-1">
            <div className="bg-surface border-border mx-auto inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1">
              <Icon
                name={record.mode === 'smart-capture' ? 'camera' : 'sparkles'}
                size={12}
                className="text-primary shrink-0"
              />
              <span className="text-tiny text-foreground truncate font-mono">{relPath}</span>
            </div>
            {record.textSnippet ? (
              <p className="text-tiny text-muted line-clamp-3 pt-1 font-mono break-words">
                {record.textSnippet}
              </p>
            ) : (
              <p className="text-tiny text-muted pt-0.5">
                小提示：为保护隐私仅存储图片的相对路径，未真实保存原图文件
              </p>
            )}
          </div>
        </div>

        <ol className="bg-surface-sunken/60 flex min-w-0 flex-col gap-1.5 rounded-xl px-3 py-2">
          {draft.scanSteps.map((step, idx) => (
            <li key={`${idx}-${step}`} className="flex min-w-0 items-center gap-2">
              <Icon name="check" size={14} strokeWidth={2.5} className="text-success shrink-0" />
              <span className="font-display text-tiny bg-success-soft text-success-ink flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                {idx + 1}
              </span>
              <span className="text-tiny text-foreground min-w-0 flex-1 truncate font-semibold">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* 2. AI 识别摘要条 */}
      <SmartMagicTurnBanner tone={mod} summary={draft.summary} streaming={false} magicStage={4} />

      {/* 3. 只读结构化识别明细卡片 */}
      <Card className="flex w-full min-w-0 flex-col gap-3 overflow-hidden p-3.5 md:p-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <IconTile icon={moduleMeta[mod].icon} tone={mod} size="sm" />
            <div className="min-w-0">
              <p className="text-caption font-bold">{moduleMeta[mod].label} · 识别结果明细</p>
              <p className="text-tiny text-muted">只读查看当时识别出的结构化内容</p>
            </div>
          </div>
          <Badge tone={mod}>{moduleMeta[mod].label}</Badge>
        </div>

        <dl className="divide-border bg-surface-sunken/55 divide-y rounded-2xl px-3.5 py-1">
          {detailRows.map((row) => (
            <div
              key={row.label}
              className="flex min-w-0 items-start justify-between gap-3 py-2.5 text-left"
            >
              <dt className="text-tiny text-muted shrink-0 font-medium">{row.label}</dt>
              <dd className="text-caption text-foreground min-w-0 text-right font-semibold break-words">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-tiny text-subtle">只读历史记录 · 退出将直接返回历史列表</span>
          <Button variant="secondary" size="sm" onClick={onBackToList}>
            返回历史列表
          </Button>
        </div>
      </Card>
    </div>
  )
}

function buildReadonlyDetailRows(record: SmartHistoryRecord): { label: string; value: string }[] {
  const { draft } = record.result
  const paths =
    record.relativeImagePaths && record.relativeImagePaths.length > 0
      ? record.relativeImagePaths
      : [record.relativeImagePath ?? `captures/${record.fileName}`]
  const rows: { label: string; value: string }[] = [
    {
      label: '识别方式',
      value: record.mode === 'smart-capture' ? '智能拍照' : '智能上传',
    },
    ...paths.map((p, idx) => ({
      label: paths.length > 1 ? `图片相对路径 (${idx + 1}/${paths.length})` : '图片相对路径',
      value: p,
    })),
  ]

  if (draft.exercise) {
    rows.push(
      { label: '运动项目', value: draft.exercise.category },
      { label: '运动时长', value: `${draft.exercise.durationMinutes} 分钟` },
      { label: '运动强度', value: INTENSITY_LABELS[draft.exercise.intensity] },
    )
    if (draft.exercise.estimatedKcal !== null) {
      rows.push({ label: '估算消耗', value: `${draft.exercise.estimatedKcal} kcal` })
    }
    if (draft.exercise.note) {
      rows.push({ label: '备注', value: draft.exercise.note })
    }
  } else if (draft.diet) {
    rows.push({ label: '餐次', value: MEAL_LABELS[draft.diet.mealType] })
    if (draft.diet.items.length > 0) {
      rows.push({
        label: '识别食物',
        value: draft.diet.items
          .map(
            (it) =>
              `${it.name}${it.portion ? `（${it.portion}）` : ''}${it.kcal ? ` ${it.kcal} kcal` : ''}`,
          )
          .join('、'),
      })
    }
    if (draft.diet.note) {
      rows.push({ label: '备注', value: draft.diet.note })
    }
  } else if (draft.sleep) {
    rows.push(
      { label: '入睡时间', value: draft.sleep.bedTime },
      { label: '起床时间', value: draft.sleep.wakeTime },
      { label: '睡眠质量', value: `${draft.sleep.quality} / 5` },
    )
    if (draft.sleep.note) {
      rows.push({ label: '备注', value: draft.sleep.note })
    }
  } else if (draft.study) {
    rows.push({ label: '学习内容', value: draft.study.what })
    if (draft.study.durationMinutes !== null) {
      rows.push({ label: '专注时长', value: `${draft.study.durationMinutes} 分钟` })
    }
    if (draft.study.note) {
      rows.push({ label: '备注', value: draft.study.note })
    }
  } else if (draft.custom) {
    const entries = Object.entries(draft.custom.values)
    if (entries.length > 0) {
      rows.push({
        label: '识别字段',
        value: entries
          .map(
            ([k, v]) => `${k}: ${typeof v === 'boolean' ? (v ? '已完成' : '未完成') : String(v)}`,
          )
          .join(' · '),
      })
    }
    if (draft.custom.note) {
      rows.push({ label: '识别备注', value: draft.custom.note })
    }
  }

  return rows
}
