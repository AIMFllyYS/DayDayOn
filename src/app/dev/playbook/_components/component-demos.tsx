'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
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
    <div className="grid w-full gap-4 sm:grid-cols-2">
      <MenuList title="偏好设置">
        <MenuItem
          icon="bell"
          tone="primary"
          label="打卡提醒"
          description="每天 21:00"
          trailing={<Switch checked={remind} onCheckedChange={setRemind} label="打卡提醒" />}
        />
        <MenuItem
          icon="clock"
          tone="sleep"
          label="日切换时间"
          trailing={<span className="text-caption text-muted">04:00</span>}
        />
        <MenuItem icon="trophy" tone="diet" label="排行榜公开" onClick={() => {}} />
      </MenuList>
      <MenuList title="账号">
        <MenuItem icon="download" label="导出我的数据" onClick={() => {}} />
        <MenuItem icon="x" label="退出登录" danger onClick={() => {}} />
      </MenuList>
    </div>
  )
}

/** 打卡入口弹层：从底部拉出的菜单列表，手机和桌面一致 */
export function SheetDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        打开打卡弹层
      </Button>
      <CheckinSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
