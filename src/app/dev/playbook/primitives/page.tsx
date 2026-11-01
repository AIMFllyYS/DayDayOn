import type { Metadata } from 'next'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import {
  CheckboxDemo,
  ComboboxMultiDemo,
  ComboboxSingleDemo,
  ConfirmDemo,
  FormDemo,
  MenuDemo,
  NumberFieldDemo,
  OTPDemo,
  PopoverDemo,
  SelectDemo,
  SheetDemo,
  SliderDemo,
  ToastDemo,
  TurnstileDemo,
} from './_demos'

export const metadata: Metadata = { title: '交互原语' }

export default function PrimitivesPage() {
  return (
    <>
      <PageHeader
        title="交互原语"
        description="弹层、抽屉、菜单、表单字段、数字输入、验证码、Toast 等可交互部件。全部基于 Base UI 封装，页面只从 src/components/ui/ 引用。"
        docRef="ui-primitives.md 第 1 节"
      />

      <Section
        ann="playbook.primitives.overlay"
        title="弹层"
        description="弹层代码不进首屏：在使用处用 next/dynamic 懒加载，或第一次打开时再加载（ui-primitives.md 第 3 节）。Toast 例外，随根布局常驻。"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.primitives.overlay.sheet"
            label="Sheet 底部弹层"
            note="< 768px 是 Drawer：向下滑动关闭，含软键盘适配；≥ 768px 是 Dialog：浮起的卡片。Esc、点遮罩、关闭按钮都会播退场动画"
          >
            <SheetDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.overlay.confirm"
            label="ConfirmDialog 确认对话框"
            note="只给不可撤销的操作；点遮罩不关闭。确认返回 Promise 时按钮转圈，失败保持打开"
          >
            <ConfirmDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.overlay.menu"
            label="Menu 菜单"
            note="卡片右上角的更多操作；方向键移动、回车选择、Esc 关闭。危险项放最后、单独一组"
          >
            <MenuDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.overlay.popover"
            label="Popover 气泡"
            note="一小段说明或轻量操作；要填表或确认的内容用 Sheet"
          >
            <PopoverDemo />
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.primitives.toast"
        title="Toast 提示消息"
        description="在任何地方调用 toast.success / error / promise / undo，不需要 hook。手机在顶部（不挡底栏），桌面在右下角；向上或向右滑动关闭，F6 跳到提示区域。错误文案只来自 error-messages.ts。"
      >
        <Specimen
          ann="playbook.primitives.toast.kinds"
          label="四种用法"
          note="可撤销的操作（删除待办）用 undo，5 秒内可以撤回，不再弹确认框"
        >
          <ToastDemo />
        </Specimen>
      </Section>

      <Section ann="playbook.primitives.choice" title="选择">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.primitives.choice.select"
            label="Select 下拉选择"
            note="固定几项里选一个；少于 4 项且一眼能看全时用分段控件"
          >
            <SelectDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.choice.combobox-single"
            label="Combobox 单选"
            note="选项多、需要输入过滤时用"
          >
            <ComboboxSingleDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.choice.combobox-multi"
            label="Combobox 多选 + 新建"
            note="选中的显示为标签，退格删除最后一个；没有匹配时出现「新建」"
          >
            <ComboboxMultiDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.choice.checkbox"
            label="Checkbox 复选框"
            note="整行可点、行高 44px；待办勾选后文字划线。立即生效的设置用 Switch"
          >
            <CheckboxDemo />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.primitives.number" title="数值">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.primitives.number.field"
            label="NumberField 数字输入"
            note="精确数值；两侧 44px 加减按钮可长按，方向键微调，手机弹数字键盘"
          >
            <NumberFieldDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.number.slider"
            label="Slider 滑块"
            note="大概值，拖动比输入顺手；板块相关的用板块色。拖动区高 44px"
          >
            <SliderDemo />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.primitives.form" title="表单">
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.primitives.form.otp"
            label="OTPField 验证码"
            note="整段粘贴、邮件验证码自动填充；填满即回调 onComplete"
          >
            <OTPDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.form.form"
            label="Form + Field"
            note="提交前跑原生校验并聚焦第一个错误；服务端 fields 错误传给 errors，改动字段后自动清除"
          >
            <FormDemo />
          </Specimen>
          <Specimen
            ann="playbook.primitives.form.turnstile"
            label="TurnstileField 人机验证"
            note="基于 Cloudflare Turnstile 封装，发验证码前静默校验；token 一次性有效，消费后调用 reset() 刷新"
          >
            <TurnstileDemo />
          </Specimen>
        </div>
        <div className="mt-4">
          <Rules
            dos={[
              'Field 传 name，与 Form errors 的键、接口字段名一致',
              '错误替换提示，不同时显示',
              '输入框字号固定 16px（iOS 聚焦不放大）',
            ]}
            donts={[
              '在业务代码里出现 Select.Root、Drawer.Popup 这类 Base UI 部件名',
              '引入表单库（react-hook-form 等）',
              '写 var(--drawer-keyboard-inset) 不带 0px 默认值',
            ]}
          />
        </div>
      </Section>
    </>
  )
}
