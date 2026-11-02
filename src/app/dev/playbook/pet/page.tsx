import type { Metadata } from 'next'
import { Mascot } from '@/components/mascot/mascot'
import {
  mascotMoods,
  mascotRegistryCharacters,
  MascotSvg,
  type MascotArm,
  type MascotMood,
  type MascotRegistryCharacter,
} from '@/components/mascot/mascot-svg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Stamp } from '@/components/ui/stamp'
import { FriendRoomStageDemo } from '../_components/friend-room-demos'
import { PetStage } from '../_components/pet-demos'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'

export const metadata: Metadata = { title: '小宠物' }

const characterDetails: Record<
  MascotRegistryCharacter,
  { badge: string; tone: 'primary' | 'study' | 'sleep' | 'diet'; points: string[] }
> = {
  tuan: {
    badge: '默认首发',
    tone: 'primary',
    points: ['樱花蝴蝶结别在头顶右上，更显眼', '小芽换成两片圆叶，更软糯', '腮红正常浓度（100%）'],
  },
  dun: {
    badge: '默认首发',
    tone: 'study',
    points: ['雾蓝棒球帽 + 黄色小星星徽章', '帽顶一片小叶子，和团团呼应', '短粗眉毛，腮红淡 40%'],
  },
  mian: {
    badge: 'M0 注册表新角色',
    tone: 'sleep',
    points: [
      '蓬松紫雾云朵睡帽 + 奶油毛球 + 月牙徽章',
      '眼角带温婉下垂长睫毛',
      '腮红柔和（85%），安神治愈',
    ],
  },
  you: {
    badge: 'M0 注册表新角色',
    tone: 'diet',
    points: [
      '暖黄油画家贝雷帽 + 四叶草贴布',
      '脸颊两侧各三颗元气暖橘小雀斑',
      '腮红暖润（95%），活力满满',
    ],
  },
}

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
        title="团团 · 墩墩 · 绵绵 · 柚柚"
        description="四只糯米团子，由数据驱动的宠物 IP 注册表（Mascot Registry）统一驱动：身体、9 种表情、9 种手势、13 种动作完全共用，只换头饰与五官细节。用户选一只陪自己打卡，拜访好友房间时也能与好友的伙伴互动。"
        docRef="ui-design-system.md 第 9 节 · Issue #27 / #21 / #22"
      />

      <Section
        ann="playbook.pet.characters"
        title="四个形象（M0 注册表驱动）"
        description="新增 IP 只需在注册表里登记 id、名称、头饰图层与特征，新人引导、「我的」设置、预设头像、好友小窝与通知文案自动挂载。注意：切换陪伴宠物不会覆盖用户已选的预设头像（Decision #3）。"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {mascotRegistryCharacters.map((c) => {
            const detail = characterDetails[c.id]
            return (
              <figure
                key={c.id}
                data-ann={`playbook.pet.character.${c.id}`}
                className="border-border bg-paper flex items-center gap-4 rounded-2xl border p-4"
              >
                <MascotSvg character={c.id} size={112} />
                <figcaption className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-heading font-bold">{c.name}</p>
                    <Badge tone={detail.tone}>{detail.badge}</Badge>
                  </div>
                  <p className="text-caption text-muted">{c.note}</p>
                  <ul className="text-tiny text-muted mt-2 grid gap-0.5">
                    {detail.points.map((d) => (
                      <li key={d}>· {d}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-1">
                    {(['cheer', 'shy', 'sleepy'] as const).map((m) => (
                      <MascotSvg key={m} character={c.id} mood={m} size={40} />
                    ))}
                  </div>
                </figcaption>
              </figure>
            )
          })}
        </div>
      </Section>

      <Section
        ann="playbook.pet.friend-room"
        title="好友小窝与宠物轻互动舞台（Issue #21 · #22）"
        description="点击顶栏好友头像进入好友房间后，上方展示好友的陪伴宠物舞台。宠物姿态与好友今日打卡完成度实时联动；底部提供「戳戳 / 投喂零食 / 提醒打卡」三项治愈轻互动（30 分钟冷却 + 按好友时区与 dayStartHour 重置每日次数）。"
      >
        <FriendRoomStageDemo />
      </Section>

      <Section
        ann="playbook.pet.playground"
        title="单宠互动试验场"
        description="试试悬停、点击、双击、长按、来回抚摸，或者把零食拖给它。右侧可切换全部 4 个注册表角色并触发 13 种动作。"
      >
        <PetStage />
      </Section>

      <Section
        ann="playbook.pet.moods"
        title="9 种表情 × 4 个角色矩阵"
        description="MascotSvg 的 mood。每种表情配好眼睛、嘴巴、腮红和小特效，4 个角色共享同一套表情状态机。"
      >
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {mascotMoods.map((m) => (
            <li
              key={m.mood}
              data-ann={`playbook.pet.mood.${m.mood}`}
              className="bg-surface shadow-soft flex flex-col items-center gap-1 rounded-2xl py-3"
            >
              <div className="grid grid-cols-2 gap-0.5">
                {mascotRegistryCharacters.map((c) => (
                  <MascotSvg key={c.id} mood={m.mood} size={48} character={c.id} />
                ))}
              </div>
              <span className="text-tiny mt-1 font-semibold">{m.label}</span>
              <span className="text-tiny text-subtle font-mono">{m.mood}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        ann="playbook.pet.details"
        title="细节参数"
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
            <MascotSvg size={64} character="mian" look={{ x: 0, y: -1 }} />
            <MascotSvg size={64} character="you" look={{ x: 1, y: 0.6 }} />
          </Specimen>
          <Specimen ann="playbook.pet.details.blink" label="眨眼 blink" bg="paper">
            <MascotSvg size={64} character="mian" />
            <MascotSvg size={64} character="mian" blink />
          </Specimen>
          <Specimen
            ann="playbook.pet.details.blush"
            label="腮红 blush"
            note="被抚摸时变红"
            bg="paper"
          >
            <MascotSvg size={64} character="you" blush={0} />
            <MascotSvg size={64} character="you" blush={1} />
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
            {armPoses.map((a, idx) => {
              const char = mascotRegistryCharacters[idx % mascotRegistryCharacters.length].id
              return (
                <li
                  key={a.arm}
                  className="bg-paper flex flex-col items-center gap-1 rounded-xl py-2"
                >
                  <MascotSvg size={72} arm={a.arm} mood={a.mood} character={char} />
                  <span className="text-tiny font-semibold">{a.label}</span>
                  <span className="text-tiny text-subtle font-mono">{a.arm}</span>
                </li>
              )
            })}
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
              <Mascot mood="sleepy" character="mian" size={84} floating />
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
              <Mascot mood="cheer" character="you" size={96} />
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
            <MascotSvg mood="happy" character="mian" size={48} />
            <MascotSvg mood="sad" character="you" size={48} />
          </Specimen>
        </div>
      </Section>

      <Section ann="playbook.pet.rules" title="规则">
        <Rules
          dos={[
            '只对用户的操作做出反应；眨眼和呼吸是唯一的自发动作',
            '说话气泡不超过 8 个字（好友房间状态气泡不超过 22 字），瞬时气泡 1.8 秒后消失',
            '互动版只出现在「我的」页、好友小窝顶部舞台和打卡成功时；列表、头像用静态版',
            '进入好友房间（viewingFriendId !== null）时自动隐藏右下角个人 AI 悬浮团团，严格遵守一屏不放两只互动宠物',
            '用户切换陪伴宠物时只更新 mascot 字段，不覆盖已设置的预设头像 avatar',
            '减少动态效果开启时动作只保留最终表情',
          ]}
          donts={[
            '不要在业务代码里写死 character === "tuan" ? ... : ... 分支，一律走 Mascot Registry 查表',
            '不要遮挡内容或按钮',
            '不要用宠物传达错误详情，错误说明写在文字里',
            '不要一屏放两只互动宠物',
          ]}
        />
      </Section>
    </>
  )
}
