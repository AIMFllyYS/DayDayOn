'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarLegend, type CalendarMark } from '@/components/ui/calendar'
import { DateField } from '@/components/ui/date-field'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ImagePicker } from '@/components/ui/image-picker'
import { PhotoAlbumSheet, type AlbumGridItem } from '@/components/ui/photo-album-sheet'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { TimeField } from '@/components/ui/time-field'
import { TimeRangeField } from '@/components/ui/time-range-field'

/*
 * 「数据与时间」页的交互演示。演示数据固定在 2026-11-02（周一），不读当前时间，
 * 这样 Playbook 预渲染和批注截图每次都一样。
 */
export const DEMO_TODAY = '2026-11-02'

const exerciseMarks: CalendarMark[] = [
  { date: '2026-10-01', tone: 'exercise' },
  { date: '2026-10-02', tone: 'exercise' },
  { date: '2026-10-03', tone: 'exercise', variant: 'partial' },
  { date: '2026-10-05', tone: 'exercise' },
  { date: '2026-10-06', tone: 'exercise', variant: 'makeup' },
  { date: '2026-10-07', tone: 'exercise' },
  { date: '2026-10-08', tone: 'exercise' },
  { date: '2026-10-12', tone: 'exercise', variant: 'partial' },
  { date: '2026-10-13', tone: 'exercise' },
  { date: '2026-10-14', tone: 'exercise' },
  { date: '2026-10-15', tone: 'exercise' },
  { date: '2026-10-19', tone: 'exercise', variant: 'makeup' },
  { date: '2026-10-20', tone: 'exercise' },
  { date: '2026-10-21', tone: 'exercise', variant: 'partial' },
  { date: '2026-10-26', tone: 'exercise' },
  { date: '2026-10-27', tone: 'exercise' },
  { date: '2026-10-28', tone: 'exercise' },
  { date: '2026-10-29', tone: 'exercise' },
  { date: '2026-10-30', tone: 'exercise', variant: 'makeup' },
  { date: '2026-10-31', tone: 'exercise' },
  { date: '2026-11-01', tone: 'exercise' },
  { date: '2026-11-02', tone: 'exercise', variant: 'partial' },
]

export function CalendarDemo() {
  const [month, setMonth] = useState('2026-10')
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Calendar
        label="晨跑打卡日历"
        today={DEMO_TODAY}
        month={month}
        onMonthChange={setMonth}
        minMonth="2026-09"
        marks={exerciseMarks}
        selected={selected}
        onDayClick={setSelected}
        maxDate={DEMO_TODAY}
        footer={<CalendarLegend tone="exercise" />}
      />
      <p className="text-tiny text-muted">
        {selected ? `选中了 ${selected}，下方会列出当天的记录` : '点一天看当天的记录'}
      </p>
    </div>
  )
}

const sleepMarks: CalendarMark[] = [
  { date: '2026-11-01', tone: 'sleep' },
  { date: '2026-10-31', tone: 'sleep', variant: 'makeup' },
  { date: '2026-10-29', tone: 'sleep' },
  { date: '2026-10-28', tone: 'sleep', variant: 'partial' },
]

/** 只读日历：不传 onDayClick，日子不是按钮 */
export function ReadonlyCalendarDemo() {
  return (
    <div className="w-full max-w-sm">
      <Calendar
        label="早睡打卡日历（只读）"
        today={DEMO_TODAY}
        marks={sleepMarks}
        footer={<CalendarLegend tone="sleep" />}
      />
    </div>
  )
}

export function DateTimeFieldsDemo() {
  const [date, setDate] = useState('2026-11-01')
  const [ddl, setDdl] = useState('2026-11-05T18:00')
  const [remind, setRemind] = useState('21:00')
  return (
    <div className="grid w-full gap-4 sm:grid-cols-3">
      <DateField
        id="pb-data-date"
        label="补卡日期"
        value={date}
        onValueChange={setDate}
        min="2026-11-01"
        max="2026-11-01"
        hint="只能补昨天"
      />
      <DateField
        id="pb-data-ddl"
        label="截止时间"
        withTime
        value={ddl}
        onValueChange={setDdl}
        aside="可选"
      />
      <TimeField
        id="pb-data-remind"
        label="打卡提醒"
        value={remind}
        onValueChange={setRemind}
        stepMinutes={5}
        error={remind === '' ? '选一个提醒时间' : undefined}
      />
    </div>
  )
}

export function TimeRangeDemo() {
  const [bed, setBed] = useState('23:30')
  const [wake, setWake] = useState('07:10')
  const [napStart, setNapStart] = useState('13:00')
  const [napEnd, setNapEnd] = useState('13:00')
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      <TimeRangeField
        label="昨晚的睡眠"
        start={bed}
        end={wake}
        onStartChange={setBed}
        onEndChange={setWake}
      />
      <TimeRangeField
        label="入睡等于起床（输入错误）"
        start={napStart}
        end={napEnd}
        onStartChange={setNapStart}
        onEndChange={setNapEnd}
        hint="改一下起床时间试试"
      />
    </div>
  )
}

export function StatesDemo() {
  const [retrying, setRetrying] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )
  function retry() {
    setRetrying(true)
    timer.current = window.setTimeout(() => setRetrying(false), 1200)
  }
  return (
    <div className="grid w-full gap-4 md:grid-cols-3">
      <div className="bg-surface rounded-2xl">
        <EmptyState
          title="还没有目标"
          description="选一个想坚持的小事，团团陪你一起打卡"
          action={<Button icon="plus">去设定目标</Button>}
        />
      </div>
      <div className="bg-surface rounded-2xl">
        <EmptyState
          size="compact"
          mood="sleepy"
          title="今天还没有待办"
          description="想到什么就记一笔"
        />
      </div>
      <div className="bg-surface rounded-2xl">
        <ErrorState
          title="加载失败了"
          message="网络好像断了一下（超时 10 秒），检查网络后重试"
          onRetry={retry}
          retrying={retrying}
        />
      </div>
    </div>
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 演示用的"压缩"：只等一会儿就原样返回；正式代码传 src/lib/image 的 compress */
async function fakeCompress(file: File): Promise<Blob> {
  await sleep(500)
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  return file
}

export function ImagePickerDemo() {
  const [recognizing, setRecognizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [failNext, setFailNext] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  function onImage(blob: Blob, blob2?: Blob) {
    setError(null)
    setResult(null)
    setRecognizing(true)
    timer.current = window.setTimeout(() => {
      setRecognizing(false)
      if (failNext) setError('这次没认出来，可以重拍，或者手动填写')
      else {
        const totalKb = Math.round((blob.size + (blob2?.size ?? 0)) / 1024)
        const countLabel = blob2 ? '共 2 张' : '1 张'
        setResult(`识别好了（${countLabel}，压缩后共 ${totalKb} KB），草稿卡会出现在这里`)
      }
    }, 1500)
  }

  function onClear() {
    if (timer.current) window.clearTimeout(timer.current)
    setRecognizing(false)
    setError(null)
    setResult(null)
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <ImagePicker
        compress={fakeCompress}
        onImage={onImage}
        recognizing={recognizing}
        error={error}
        onClear={onClear}
      />
      <label className="text-caption text-muted flex items-center gap-2">
        <input
          type="checkbox"
          checked={failNext}
          onChange={(e) => setFailNext(e.target.checked)}
          className="accent-primary size-4"
        />
        下一次识别模拟失败
      </label>
      {result && <p className="text-caption text-success-ink">{result}</p>}
    </div>
  )
}

function makePlaybookAlbumItems(): AlbumGridItem[] {
  const presets = [
    { id: 'pb-1', title: '减脂午餐便当', bg: '#FFF4EC', accent: '#F28B50', name: 'lunch_01.jpg' },
    { id: 'pb-2', title: '傍晚慢跑 5km', bg: '#EEF8F3', accent: '#3FA67A', name: 'run_02.jpg' },
    { id: 'pb-3', title: '全麦三明治', bg: '#FFF9EB', accent: '#E5A93C', name: 'toast_03.jpg' },
    { id: 'pb-4', title: '睡眠监测报告', bg: '#F2F0FC', accent: '#7A6AD8', name: 'sleep_04.jpg' },
    { id: 'pb-5', title: '复习笔记打卡', bg: '#E7F5FF', accent: '#339AF0', name: 'study_05.jpg' },
    { id: 'pb-6', title: '无糖酸奶水果碗', bg: '#FFF0F6', accent: '#F06595', name: 'berry_06.jpg' },
  ]
  return presets.map((p, idx) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" rx="28" fill="${p.bg}"/><circle cx="250" cy="76" r="40" fill="${p.accent}" opacity="0.28"/><text x="28" y="176" font-family="sans-serif" font-size="24" font-weight="bold" fill="#2c2623">${p.title}</text></svg>`
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    return {
      id: p.id,
      fileName: p.name,
      previewUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      createdAt: `2026-11-02T0${idx}:00:00.000Z`,
      file: new File([blob], p.name, { type: 'image/svg+xml' }),
    }
  })
}

const PLAYBOOK_ALBUM_ITEMS = makePlaybookAlbumItems()

export function PhotoAlbumSheetDemo() {
  const [open, setOpen] = useState(false)
  const [pickedSummary, setPickedSummary] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-start gap-2.5">
      <Button variant="soft" icon="sparkles" onClick={() => setOpen(true)}>
        预览安卓流式多选相册（仅壳内生效）
      </Button>
      <p className="text-tiny text-muted">
        网页端严禁弹出此抽屉（直接调系统多选文件管理器）；此演示通过 Playbook 专属 demoItems
        注入，正式生产代码零假图。
      </p>
      {pickedSummary && <p className="text-caption text-success-ink">{pickedSummary}</p>}
      <PhotoAlbumSheet
        open={open}
        onOpenChange={setOpen}
        demoItems={PLAYBOOK_ALBUM_ITEMS}
        onConfirm={(files) => {
          setPickedSummary(
            `已按顺序选定 ${files.length} 张：${files.map((f) => f.name).join(' → ')}`,
          )
        }}
      />
    </div>
  )
}

export function RatingFeedbackDemo() {
  const [value, setValue] = useState<RatingValue | null>(null)
  return (
    <div className="w-full max-w-md">
      <p className="text-caption mb-2 font-semibold">今日心情</p>
      <Rating value={value} onValueChange={setValue} tone="primary" label="今日心情" />
      <p className="text-tiny text-muted mt-2">
        1 很糟：整组抖一下并轻震 · 2 不太好：表情摇一摇 · 3 一般：波浪起伏 · 4 / 5：撒彩纸。
        开启系统「减少动态效果」时只保留选中状态。
      </p>
    </div>
  )
}
