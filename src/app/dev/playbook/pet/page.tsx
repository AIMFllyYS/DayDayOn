import type { Metadata } from 'next'
import { Mascot } from '@/components/mascot/mascot'
import {
  mascotMoods,
  MascotSvg,
  type MascotArm,
  type MascotMood,
} from '@/components/mascot/mascot-svg'
import { Button } from '@/components/ui/button'
import { Stamp } from '@/components/ui/stamp'
import { PetStage } from '../_components/pet-demos'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'

export const metadata: Metadata = { title: '小宠物' }

const armPoses: { arm: MascotArm; mood: MascotMood; label: string }[] = [
  { arm: 'rest', mood: 'happy', label: '自然下垂' },
  { arm: 'wave', mood: 'happy', label: '挥手' },
  { arm: 'up', mood: 'cheer', label: '举高' },
  { arm: 'hug', mood: 'love', label: '抱胸比心' },
  { arm: 'cover', mood: 'shy', label: '捂脸' },
  { arm: 'think', mood: 'thinking', label: '托下巴' },
  { arm: 'hold', mood: 'eating', label: '捧着吃' },
  { arm: 'startle', mood: 'surprised', label: '张开' },
  { arm: 'droop', mood: 'sad', label: '耷拉' },
]

export default function PetPage() {
  return (
    <>
      <PageHeader
        title="团团"
        description="头顶小芽、系着珊瑚色蝴蝶结的糯米团子。它陪用户打卡：会看你、会害羞、会吃零食，打卡成功时会跳起来庆祝。"
        docRef="ui-design-system.md 第 9 节"
      />

      <Section
        ann="playbook.pet.playground"
        title="互动"
        description="试试悬停、点击、双击、长按、来回抚摸，或者把零食拖给它。右侧按钮演示外部调用的动作。"
      >
        <PetStage />
      </Section>

      <Section
        ann="playbook.pet.moods"
        title="表情"
        description="MascotSvg 的 mood。每种表情配好眼睛、嘴巴、腮红和小特效。"
      >
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {mascotMoods.map((m) => (
            <li
              key={m.mood}
              data-ann={`playbook.pet.mood.${m.mood}`}
              className="bg-surface shadow-soft flex flex-col items-center gap-1 rounded-2xl py-3"
            >
              <MascotSvg mood={m.mood} size={72} />
              <span className="text-tiny font-semibold">{m.label}</span>
              <span className="text-tiny text-subtle font-mono">{m.mood}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        ann="playbook.pet.details"
        title="细节"
        description="视线、眨眼、腮红、手臂都是参数，互动组件只是在不同时机改这些参数。"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Specimen
            ann="playbook.pet.details.look"
            label="视线 look"
            note="x / y 取 -1 到 1"
            bg="paper"
          >
            <MascotSvg size={64} look={{ x: -1, y: 0 }} />
            <MascotSvg size={64} look={{ x: 0, y: -1 }} />
            <MascotSvg size={64} look={{ x: 1, y: 0.6 }} />
          </Specimen>
          <Specimen ann="playbook.pet.details.blink" label="眨眼 blink" bg="paper">
            <MascotSvg size={64} />
            <MascotSvg size={64} blink />
          </Specimen>
          <Specimen
            ann="playbook.pet.details.blush"
            label="腮红 blush"
            note="被抚摸时变红"
            bg="paper"
          >
            <MascotSvg size={64} blush={0} />
            <MascotSvg size={64} blush={1} />
          </Specimen>
        </div>
        <div
          data-ann="playbook.pet.details.arm"
          className="border-border bg-surface mt-3 rounded-2xl border p-4"
        >
          <p className="text-caption mb-3 font-semibold">
            手臂姿势 arm
            <span className="text-muted ml-2 font-normal">
              不传时按表情自动选；手臂画在身体前面、绕肩膀转动，任何姿势都不会被挡住
            </span>
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
            {armPoses.map((a) => (
              <li key={a.arm} className="bg-paper flex flex-col items-center gap-1 rounded-xl py-2">
                <MascotSvg size={72} arm={a.arm} mood={a.mood} />
                <span className="text-tiny font-semibold">{a.label}</span>
                <span className="text-tiny text-subtle font-mono">{a.arm}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section ann="playbook.pet.in-product" title="在产品里出场">
        <div className="grid gap-3 md:grid-cols-3">
          <Specimen
            ann="playbook.pet.in-product.empty"
            label="空状态"
            note="犯困 + 浮动"
            bg="paper"
          >
            <div className="flex w-full flex-col items-center gap-1.5 py-2 text-center">
              <Mascot mood="sleepy" size={84} floating />
              <p className="font-semibold">今天还没有待办</p>
              <Button size="sm" icon="plus">
                新建待办
              </Button>
            </div>
          </Specimen>
          <Specimen
            ann="playbook.pet.in-product.checkin"
            label="打卡成功"
            note="欢呼 + 盖章，只在完成那一刻"
            bg="paper"
          >
            <div className="relative mx-auto">
              <Mascot mood="cheer" size={96} />
              <Stamp caption="10.31" size={60} className="absolute -top-1 -right-10" />
            </div>
          </Specimen>
          <Specimen
            ann="playbook.pet.in-product.agent"
            label="AI 回复头像"
            note="思考中 / 完成 / 出错"
            bg="paper"
          >
            <MascotSvg mood="thinking" size={48} />
            <MascotSvg mood="happy" size={48} />
            <MascotSvg mood="sad" size={48} />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.pet.rules" title="规则">
        <Rules
          dos={[
            '只对用户的操作做出反应；眨眼和呼吸是唯一的自发动作',
            '说话气泡不超过 8 个字，1.8 秒后消失',
            '互动版只出现在「我的」页和打卡成功时；列表、头像用静态版',
            '减少动态效果开启时动作只保留最终表情',
          ]}
          donts={[
            '不要遮挡内容或按钮',
            '不要用团团传达错误详情，错误说明写在文字里',
            '不要一屏放两只互动团团',
          ]}
        />
      </Section>
    </>
  )
}
