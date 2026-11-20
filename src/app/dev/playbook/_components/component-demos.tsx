'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { ReportShareSheet } from '@/components/ui/report-share-sheet'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { renderReportPosterPng } from '@/features/checkin/share/report-poster'
import { CheckinSheet } from './checkin-sheet'

const rangeOptions = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
] as const

const todoOptions = [
  { value: 'list', label: '清单' },
  { value: 'log', label: '时间日志' },
] as const

export function SegmentedDemo() {
  const [range, setRange] = useState<(typeof rangeOptions)[number]['value']>('week')
  const [mode, setMode] = useState<(typeof todoOptions)[number]['value']>('list')
  return (
    <div className="flex w-full flex-col gap-3 sm:max-w-sm">
      <SegmentedControl
        options={rangeOptions}
        value={range}
        onValueChange={setRange}
        label="统计范围"
      />
      <SegmentedControl
        options={todoOptions}
        value={mode}
        onValueChange={setMode}
        label="待办视图"
        size="sm"
      />
    </div>
  )
}

export function SwitchDemo() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <Switch checked={a} onCheckedChange={setA} label="打卡提醒" />
      <Switch checked={b} onCheckedChange={setB} label="公开到排行榜" />
      <Switch checked={false} onCheckedChange={() => {}} label="禁用" disabled />
    </div>
  )
}

export function RatingDemo() {
  const [value, setValue] = useState<RatingValue | null>(null)
  const [diet, setDiet] = useState<RatingValue | null>(4)
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <div>
        <p className="text-caption mb-2 font-semibold">今天的睡眠感觉怎么样？</p>
        <Rating value={value} onValueChange={setValue} tone="sleep" label="睡眠满意度" />
      </div>
      <div>
        <p className="text-caption mb-2 font-semibold">今天吃得开心吗？</p>
        <Rating value={diet} onValueChange={setDiet} tone="diet" label="饮食满意度" />
      </div>
    </div>
  )
}

export function FieldDemo() {
  const [weight, setWeight] = useState('52.4')
  const invalid = weight !== '' && !/^\d{2,3}(\.\d{1,2})?$/.test(weight)
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <Field
        label="今日体重"
        htmlFor="pb-weight"
        hint="单位 kg，默认不公开"
        error={invalid ? '请输入 20–300 之间的数字，最多两位小数' : undefined}
        aside="可选"
      >
        <Input
          id="pb-weight"
          inputMode="decimal"
          value={weight}
          aria-invalid={invalid || undefined}
          onChange={(e) => setWeight(e.target.value)}
        />
      </Field>
      <Field label="备注" htmlFor="pb-note" hint="AI 不会读取备注">
        <Textarea id="pb-note" placeholder="今天吃得有点多，但很开心" />
      </Field>
    </div>
  )
}

export function MenuDemo() {
  const [remind, setRemind] = useState(true)
  return (
    <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MenuList title="外观">
        <MenuItem
          leading={
            <span
              data-theme="caramel"
              className="bg-primary ring-border flex size-8 shrink-0 items-center justify-center rounded-full shadow-xs ring-2"
            >
              <span className="size-2.5 rounded-full bg-white/60" />
            </span>
          }
          label="主题色"
          description="默认：暖、稳，像一杯热奶茶"
          value="奶茶焦糖"
          onClick={() => {}}
        />
        <MenuItem
          leading={
            <span className="bg-surface-sunken ring-border flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1">
              <Mascot size={32} character="tuan" />
            </span>
          }
          label="陪伴宠物"
          description="樱花蝴蝶结，软软糯糯"
          value="团团"
          onClick={() => {}}
        />
      </MenuList>
      <MenuList title="偏好设置">
        <MenuItem
          icon="bell"
          tone="primary"
          label="打卡提醒"
          description="每天 21:00"
          control={<Switch checked={remind} onCheckedChange={setRemind} label="打卡提醒" />}
        />
        <MenuItem icon="clock" tone="sleep" label="日切换时间" value="04:00" onClick={() => {}} />
        <MenuItem icon="trophy" tone="diet" label="排行榜公开" onClick={() => {}} />
      </MenuList>
      <MenuList title="账号">
        <MenuItem icon="download" label="导出我的数据" onClick={() => {}} />
        <MenuItem icon="x" label="退出登录" danger onClick={() => {}} />
      </MenuList>
    </div>
  )
}

/** 打卡入口弹层：从底部拉出的菜单列表，手机和桌面一致；第二个按钮演示一个目标都没有时的虚线卡 */
export function SheetDemo() {
  const [open, setOpen] = useState(false)
  const [empty, setEmpty] = useState(false)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          icon="plus"
          onClick={() => {
            setEmpty(false)
            setOpen(true)
          }}
        >
          打开打卡弹层
        </Button>
        <Button
          variant="soft"
          icon="plus"
          onClick={() => {
            setEmpty(true)
            setOpen(true)
          }}
        >
          空状态（还没有目标）
        </Button>
      </div>
      <CheckinSheet open={open} onOpenChange={setOpen} empty={empty} />
    </>
  )
}

/** 原生报告图片分享弹层（带底部小 Dock 栏 + 16:9 横版 / 9:16 竖版海报与二维码） */
export function ReportShareDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon="share" variant="soft" onClick={() => setOpen(true)}>
        预览原生报告分享弹层
      </Button>
      <ReportShareSheet
        open={open}
        onOpenChange={setOpen}
        title="今日三餐总评 · 4.5 分"
        fileBaseName="DayDayOn-饮食总评-2026-11-19"
        offscreenSvg={<MascotSvg character="tuan" mood="cheer" size={160} />}
        renderPoster={({ orientation, svgDataUrl }) =>
          renderReportPosterPng({
            module: 'diet',
            orientation,
            mascotDataUrl: svgDataUrl,
            today: '2026-11-19',
            period: { done: 12, total: 21 },
            pet: { character: 'tuan', name: '团团' },
            goal: {
              id: 'demo-diet',
              module: 'diet',
              title: '好好吃饭',
              target: { kind: 'count', value: 3 },
              fields: null,
              fieldVersion: null,
            },
            subject: {
              module: 'diet',
              method: 'photo',
              mealType: 'dinner',
              items: [
                { name: '玉米杂粮饭', portion: '1 碗', kcal: 240 },
                { name: '清蒸鲈鱼', portion: '150g', kcal: 210 },
              ],
            },
            todayCheckins: [
              {
                id: 'demo-b',
                goalId: 'demo-diet',
                module: 'diet',
                localDate: '2026-11-19',
                occurredAt: '2026-11-19T00:00:00.000Z',
                source: 'manual',
                isMakeup: false,
                durationSeconds: null,
                count: 1,
                intakeKcal: 360,
                burnKcal: null,
                note: null,
                parsedText: null,
                aiRunId: null,
                fieldVersion: null,
                score: 4.5,
                isValid: true,
                payload: {
                  module: 'diet',
                  method: 'manual',
                  mealType: 'breakfast',
                  items: [
                    { name: '燕麦牛奶粥', portion: '1 碗', kcal: 220 },
                    { name: '水煮蛋', portion: '2 个', kcal: 140 },
                  ],
                },
                verdict: {
                  version: 1,
                  isValid: true,
                  settlement: 'settled',
                  score: 4.5,
                  scoreMax: 5,
                  detail: '',
                  checks: [],
                  metrics: {},
                  facts: {
                    module: 'diet',
                    dishes: [
                      {
                        name: '燕麦牛奶粥',
                        portion: '1 碗',
                        kcal: 220,
                        proteinG: 9,
                        carbG: 34,
                        fatG: 5,
                        fiberG: 5,
                        sodiumMg: 140,
                        gi: 48,
                        junk: false,
                        sweet: false,
                        cooking: 'boiled',
                        source: 'table',
                      },
                      {
                        name: '水煮蛋',
                        portion: '2 个',
                        kcal: 140,
                        proteinG: 13,
                        carbG: 1,
                        fatG: 9,
                        fiberG: 0,
                        sodiumMg: 120,
                        gi: 0,
                        junk: false,
                        sweet: false,
                        cooking: 'boiled',
                        source: 'table',
                      },
                    ],
                  },
                  citations: [],
                  advice: [],
                  refereeRunId: null,
                  offline: false,
                },
                createdAt: '2026-11-19T00:00:00.000Z',
              },
              {
                id: 'demo-l',
                goalId: 'demo-diet',
                module: 'diet',
                localDate: '2026-11-19',
                occurredAt: '2026-11-19T04:00:00.000Z',
                source: 'ai',
                isMakeup: false,
                durationSeconds: null,
                count: 1,
                intakeKcal: 610,
                burnKcal: null,
                note: null,
                parsedText: null,
                aiRunId: null,
                fieldVersion: null,
                score: 4.5,
                isValid: true,
                payload: {
                  module: 'diet',
                  method: 'photo',
                  mealType: 'lunch',
                  items: [
                    { name: '杂粮米饭', portion: '1 碗', kcal: 230 },
                    { name: '番茄炒蛋', portion: '1 份', kcal: 260 },
                    { name: '蒜蓉西兰花', portion: '1 份', kcal: 120 },
                  ],
                },
                verdict: {
                  version: 1,
                  isValid: true,
                  settlement: 'settled',
                  score: 4.5,
                  scoreMax: 5,
                  detail: '',
                  checks: [],
                  metrics: {},
                  facts: {
                    module: 'diet',
                    dishes: [
                      {
                        name: '杂粮米饭',
                        portion: '1 碗',
                        kcal: 230,
                        proteinG: 5,
                        carbG: 48,
                        fatG: 1,
                        fiberG: 4,
                        sodiumMg: 20,
                        gi: 55,
                        junk: false,
                        sweet: false,
                        cooking: 'steamed',
                        source: 'table',
                      },
                      {
                        name: '番茄炒蛋',
                        portion: '1 份',
                        kcal: 260,
                        proteinG: 14,
                        carbG: 12,
                        fatG: 16,
                        fiberG: 2,
                        sodiumMg: 720,
                        gi: 35,
                        junk: false,
                        sweet: false,
                        cooking: 'stir-fried',
                        source: 'table',
                      },
                      {
                        name: '蒜蓉西兰花',
                        portion: '1 份',
                        kcal: 120,
                        proteinG: 5,
                        carbG: 10,
                        fatG: 6,
                        fiberG: 5,
                        sodiumMg: 480,
                        gi: 15,
                        junk: false,
                        sweet: false,
                        cooking: 'stir-fried',
                        source: 'table',
                      },
                    ],
                  },
                  citations: [],
                  advice: [],
                  refereeRunId: null,
                  offline: false,
                },
                createdAt: '2026-11-19T04:00:00.000Z',
              },
            ],
            verdict: {
              version: 1,
              isValid: true,
              settlement: 'settled',
              score: 4.5,
              scoreMax: 5,
              detail: '今日三餐打卡完成！全天总分 4.5 分（超过 3.0 分有效线）',
              checks: [
                { id: 'no-junk', text: '全天无一票否决超加工食物', ok: true },
                { id: 'kcal', text: '全天热量未超标（1420 kcal，上限 2100 kcal）', ok: true },
                { id: 'protein', text: '全天优质蛋白充沛（72g）', ok: true },
                { id: 'fiber', text: '全天膳食纤维充足奖励（19g，+0.4 分）', ok: true },
                { id: 'gi', text: '全天升糖节律与晚间碳水控制良好', ok: true },
              ],
              metrics: {
                dailyKcal: 1420,
                dailyProtein: 72,
                dailyCarb: 158,
                dailyFat: 42,
                dailyFiber: 19,
                dailySodium: 2350,
                dailyGi: 49,
                breakfastKcal: 360,
                lunchKcal: 610,
                dinnerKcal: 450,
                tier: 'balanced-glycemic',
              },
              facts: {
                module: 'diet',
                dishes: [
                  {
                    name: '玉米杂粮饭',
                    portion: '1 碗',
                    kcal: 240,
                    proteinG: 6,
                    carbG: 48,
                    fatG: 2,
                    fiberG: 6,
                    sodiumMg: 120,
                    gi: 52,
                    junk: false,
                    sweet: false,
                    cooking: 'steamed',
                    source: 'table',
                  },
                  {
                    name: '清蒸鲈鱼',
                    portion: '150g',
                    kcal: 210,
                    proteinG: 29,
                    carbG: 1,
                    fatG: 9,
                    fiberG: 0,
                    sodiumMg: 460,
                    gi: 0,
                    junk: false,
                    sweet: false,
                    cooking: 'steamed',
                    source: 'table',
                  },
                ],
              },
              citations: [],
              advice: ['三餐营养均衡、高蛋白低 GI，明天继续保持这个节奏！'],
              refereeRunId: null,
              offline: false,
            },
          })
        }
      />
    </>
  )
}
