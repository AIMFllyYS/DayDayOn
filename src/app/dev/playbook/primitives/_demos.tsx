'use client'

import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { Menu } from '@/components/ui/menu'
import { NumberField } from '@/components/ui/number-field'
import { OTPField } from '@/components/ui/otp-field'
import { Popover } from '@/components/ui/popover'
import { Select, type SelectOption } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/components/ui/toast'

// Playbook 演示：交互原语的真实组件。数据都是演示用的本地状态。

export function SheetDemo() {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        打开底部弹层
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="记一下体重"
        description="手机上向下滑动关闭；桌面上是浮起来的卡片"
        footer={
          <Button className="w-full" onClick={() => setOpen(false)}>
            保存
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="今天的体重" htmlFor="pb-sheet-weight" hint="早上空腹称最准">
            <Input id="pb-sheet-weight" inputMode="decimal" placeholder="kg" />
          </Field>
          <Field label="备注" htmlFor="pb-sheet-note" aside="可选">
            <Textarea
              id="pb-sheet-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="聚焦这里时软键盘不会挡住输入框"
            />
          </Field>
          <div
            data-base-ui-swipe-ignore="x"
            className="bg-surface-sunken text-caption text-muted flex gap-2 overflow-x-auto rounded-2xl p-3"
          >
            {['横向滚动区', '加了 swipe-ignore="x"', '左右滑不会关闭抽屉', '上下滑照常关闭'].map(
              (t) => (
                <span key={t} className="bg-surface shrink-0 rounded-xl px-3 py-2">
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
      </Sheet>
    </>
  )
}

export function ConfirmDemo() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
        删除目标
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="删除「每天跑步」？"
        description="这个目标的打卡记录会一起删掉，删了就找不回来了。"
        tone="danger"
        confirmLabel="删除"
        onConfirm={async () => {
          await new Promise((r) => setTimeout(r, 900))
          toast.success('已删除')
        }}
      />
    </>
  )
}

export function ToastDemo() {
  return (
    <>
      <Button
        variant="soft"
        icon="check"
        onClick={() => toast.success('打卡成功', { description: '连续 5 天啦' })}
      >
        成功
      </Button>
      <Button variant="danger" icon="alert" onClick={() => toast.error('网络不太好，没保存上')}>
        失败
      </Button>
      <Button
        variant="secondary"
        icon="loader"
        onClick={() =>
          toast
            .promise(
              new Promise<number>((resolve, reject) =>
                setTimeout(
                  () => (Math.random() > 0.3 ? resolve(520) : reject(new Error('x'))),
                  1500,
                ),
              ),
              {
                loading: '正在识别这一餐…',
                success: (kcal) => `识别好了，大约 ${kcal} kcal`,
                error: '没认出来，可以手动填一下',
              },
            )
            .catch(() => undefined)
        }
      >
        加载中 → 结果
      </Button>
      <Button
        variant="ghost"
        icon="trash"
        onClick={() =>
          toast.undo('已删除待办「买牛奶」', {
            onUndo: () => toast.info('已恢复'),
          })
        }
      >
        可撤销
      </Button>
    </>
  )
}

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const mealOptions: SelectOption<Meal>[] = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '加餐' },
]

export function SelectDemo() {
  const [meal, setMeal] = useState<Meal | null>(null)
  return (
    <div className="w-full max-w-xs">
      <Field label="餐次" htmlFor="pb-select">
        <Select
          id="pb-select"
          options={mealOptions}
          value={meal}
          onValueChange={setMeal}
          placeholder="选一个"
        />
      </Field>
    </div>
  )
}

const sportOptions: ComboboxOption[] = [
  { value: 'run', label: '跑步' },
  { value: 'walk', label: '快走' },
  { value: 'swim', label: '游泳' },
  { value: 'cycle', label: '骑行' },
  { value: 'yoga', label: '瑜伽' },
  { value: 'gym', label: '力量训练' },
  { value: 'badminton', label: '羽毛球' },
]

export function ComboboxSingleDemo() {
  const [v, setV] = useState<string | null>('run')
  return (
    <div className="w-full max-w-xs">
      <Field label="运动类型" htmlFor="pb-combo-single" hint="输入文字过滤">
        <Combobox
          id="pb-combo-single"
          options={sportOptions}
          value={v}
          onValueChange={setV}
          placeholder="例如：跑步"
        />
      </Field>
    </div>
  )
}

export function ComboboxMultiDemo() {
  const [tags, setTags] = useState<ComboboxOption[]>([
    { value: 'morning', label: '早起' },
    { value: 'outdoor', label: '户外' },
    { value: 'friends', label: '和朋友' },
  ])
  const [v, setV] = useState<string[]>(['morning'])
  return (
    <div className="w-full max-w-sm">
      <Field label="标签" htmlFor="pb-combo-multi" hint="可多选；没有的直接输入后回车新建">
        <Combobox
          id="pb-combo-multi"
          multiple
          creatable
          options={tags}
          value={v}
          onValueChange={setV}
          onCreate={(label) => {
            const value = `tag-${Date.now()}`
            setTags((prev) => [...prev, { value, label }])
            return value
          }}
          placeholder="加个标签"
        />
      </Field>
    </div>
  )
}

export function MenuDemo() {
  return (
    <Menu
      trigger={<IconButton icon="menu" label="更多操作" variant="secondary" />}
      items={[
        { label: '编辑', icon: 'edit', onSelect: () => toast.info('点了编辑') },
        { label: '复制一份', icon: 'copy', onSelect: () => toast.info('点了复制') },
        null,
        { label: '删除', icon: 'trash', danger: true, onSelect: () => toast.info('点了删除') },
      ]}
    />
  )
}

export function PopoverDemo() {
  return (
    <Popover
      trigger={
        <Button variant="ghost" size="sm" icon="bulb">
          连续天数怎么算？
        </Button>
      }
      title="连续天数"
    >
      每天至少完成一个计划内的目标就算一天。补卡能补上记录，但不计入连续天数。
    </Popover>
  )
}

const fullness = ['很饿', '有点饿', '刚好', '饱了', '撑了']

export function SliderDemo() {
  const [v, setV] = useState(3)
  const [effort, setEffort] = useState(60)
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Slider
        label="饱腹感"
        min={1}
        max={5}
        value={v}
        onValueChange={setV}
        tone="diet"
        formatValue={(n) => fullness[n - 1] ?? ''}
      />
      <Slider
        label="运动强度"
        value={effort}
        onValueChange={setEffort}
        tone="exercise"
        formatValue={(n) => `${n}%`}
      />
    </div>
  )
}

export function NumberFieldDemo() {
  const [kg, setKg] = useState<number | null>(52.4)
  const [min, setMin] = useState<number | null>(null)
  return (
    <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
      <Field label="体重" htmlFor="pb-num-kg">
        <NumberField
          id="pb-num-kg"
          value={kg}
          onValueChange={setKg}
          min={20}
          max={300}
          step={0.1}
          unit="kg"
          format={{ maximumFractionDigits: 1 }}
        />
      </Field>
      <Field label="时长" htmlFor="pb-num-min" hint="空着表示没填，不是 0">
        <NumberField
          id="pb-num-min"
          value={min}
          onValueChange={setMin}
          min={0}
          max={600}
          step={5}
          unit="分钟"
          placeholder="—"
        />
      </Field>
    </div>
  )
}

export function OTPDemo() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  return (
    <div className="w-full max-w-xs">
      <Field
        label="6 位验证码"
        htmlFor="pb-otp"
        hint="试试粘贴 123456；输入 000000 看错误态"
        error={error}
      >
        <OTPField
          id="pb-otp"
          value={code}
          onValueChange={(v) => {
            setCode(v)
            setError(undefined)
          }}
          onComplete={(v) =>
            v === '000000' ? setError('验证码不对，再看看邮件？') : toast.success('验证通过')
          }
        />
      </Field>
    </div>
  )
}

export function CheckboxDemo() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)
  const [c, setC] = useState(false)
  return (
    <div className="flex flex-col">
      <Checkbox checked={a} onCheckedChange={setA} strike>
        背 20 个单词
      </Checkbox>
      <Checkbox checked={b} onCheckedChange={setB} strike>
        晚上 11 点前睡觉
      </Checkbox>
      <Checkbox checked={c} onCheckedChange={setC} disabled>
        禁用状态
      </Checkbox>
    </div>
  )
}

export function FormDemo() {
  const [errors, setErrors] = useState<FormErrors>()
  const [submitting, setSubmitting] = useState(false)
  return (
    <Form
      className="w-full max-w-sm"
      aria-label="修改资料"
      errors={errors}
      onFormSubmit={async (values) => {
        setSubmitting(true)
        await new Promise((r) => setTimeout(r, 700))
        setSubmitting(false)
        // 模拟服务端 400 VALIDATION_FAILED 返回的 fields
        if (values.nickname === '团团') {
          setErrors({ nickname: ['这个昵称已经有人用了'] })
          return
        }
        setErrors(undefined)
        toast.success('保存好了')
      }}
    >
      <Field label="昵称" htmlFor="pb-form-nick" name="nickname" hint="填「团团」看服务端错误">
        <Input id="pb-form-nick" required maxLength={12} placeholder="朋友看到的名字" />
      </Field>
      <Field label="邮箱" htmlFor="pb-form-email" name="email" hint="提交时走浏览器原生校验">
        <Input id="pb-form-email" type="email" required placeholder="name@example.com" />
      </Field>
      <Button type="submit" loading={submitting}>
        保存
      </Button>
    </Form>
  )
}
