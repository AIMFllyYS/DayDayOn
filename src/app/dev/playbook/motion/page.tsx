import type { Metadata } from 'next'
import { EasingDemo, FeedbackDemo, PresetGallery, SplashDemo } from '../_components/motion-demos'
import { PageHeader, Rules, Section } from '../_components/section'
import { TokenValue } from '../_components/token-value'

export const metadata: Metadata = { title: '动效' }

const durations = [
  { name: '--dur-instant', use: '悬停变色、焦点环' },
  { name: '--dur-fast', use: '按压、颜色切换' },
  { name: '--dur-base', use: '开关、分段切换、展开' },
  { name: '--dur-slow', use: '进场、弹层、进度变化' },
  { name: '--dur-celebrate', use: '盖章等庆祝动画' },
] as const

export default function MotionPage() {
  return (
    <>
      <PageHeader
        title="动效"
        description="动效用来表达「发生了什么」：按下、出现、完成。所有动画都从这里的预设里选，不在组件里临时写 keyframes。"
        docRef="ui-design-system.md 第 5 节"
      />

      <Section ann="playbook.motion.durations" title="时长">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {durations.map((d) => (
            <li key={d.name} className="border-border bg-surface rounded-2xl border p-3">
              <p className="text-tiny font-mono font-semibold">{d.name}</p>
              <TokenValue name={d.name} />
              <p className="text-tiny text-muted">{d.use}</p>
            </li>
          ))}
        </ul>
        <p className="text-tiny text-muted mt-2">
          用法：<code className="font-mono">duration-(--dur-base)</code>
          。Tailwind 4 没有 duration 命名空间，所以时长放在 :root。
        </p>
      </Section>

      <Section ann="playbook.motion.easing" title="缓动曲线">
        <EasingDemo />
      </Section>

      <Section ann="playbook.motion.presets" title="动画预设">
        <PresetGallery />
      </Section>

      <Section ann="playbook.motion.feedback" title="交互反馈">
        <FeedbackDemo />
      </Section>

      <Section
        ann="playbook.motion.splash"
        title="开屏"
        description="只在手机上以 App 形式冷启动时播放一次（APK 壳、已安装的 PWA），浏览器里打开网址和桌面不播。团团眨眼 → 蓄力起跳 → 盖章 → 以团团为圆心挖开露出页面；点一下可以跳过。第一帧与系统开屏同色同位，衔接成一段。"
      >
        <SplashDemo />
      </Section>

      <Section ann="playbook.motion.rules" title="规则">
        <Rules
          dos={[
            '只动 transform 和 opacity（进度条宽度、圆环描边除外）',
            '进场用 out-soft，退场用 in-soft，可交互元素用 spring',
            '列表进场错开 60ms，最多错开 6 个',
            '系统开启「减少动态效果」时，动画自动缩短到 1ms，只保留最终状态',
          ]}
          donts={[
            '不要让动画阻塞操作（动画期间按钮必须可点）',
            '不要循环播放装饰动画，循环只用于「正在进行」的状态',
            '不要在一屏里同时播放两个庆祝动画',
          ]}
        />
      </Section>
    </>
  )
}
