import type { Metadata } from 'next'
import Link from 'next/link'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { Stamp } from '@/components/ui/stamp'
import { moduleMeta, softToneClass, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'

export const metadata: Metadata = { title: '打卡板块总览' }

interface ModuleArchitectureCard {
  tone: ModuleTone
  slug: string
  title: string
  subtitle: string
  href: string
  inputs: { mode: string; icon: IconName; detail: string }[]
  refereeTitle: string
  refereeThreshold: string
  refereePassExample: string
  refereeInterceptExample: string
  highlights: string[]
}

const MODULE_CARDS: ModuleArchitectureCard[] = [
  {
    tone: 'diet',
    slug: 'diet',
    title: '好好吃饭 · 饮食板块',
    subtitle: '身高体重动态 BMR 代谢基线 + 三餐营养均衡科学裁判',
    href: '/dev/playbook/modules/diet',
    inputs: [
      { mode: '手动填写', icon: 'edit', detail: '餐次选择 + 食物清单与份量热量录入' },
      { mode: '智能拍照', icon: 'camera', detail: '餐盘实拍 / 外卖标签识别，自动拆解食材热量' },
      { mode: '智能上传', icon: 'sparkles', detail: '相册餐食图或饮食记录 TXT / HTML 解析' },
    ],
    refereeTitle: '动态 BMR 热量走廊 + 反极端节食 / 反暴食护栏',
    refereeThreshold: '按身高、体重、目标动态计算每日推荐摄入区间，单餐结构需含优质蛋白/膳食纤维',
    refereePassExample: '午餐番茄炒蛋+杂粮饭+西蓝花（490 kcal，营养均衡）→ 有效打卡盖章',
    refereeInterceptExample:
      '全天仅吃 1 个苹果（< 800 kcal 极端节食）或炸鸡夜宵暴食 → 仅记录热量，不计有效打卡',
    highlights: ['身高体重 BMR 实时重算', '餐盘多食材拆解', '防极端节食科学保护'],
  },
  {
    tone: 'exercise',
    slug: 'exercise',
    title: '动一动 · 运动板块',
    subtitle: '最低有效运动时长 + 强度心率综合核验裁判',
    href: '/dev/playbook/modules/exercise',
    inputs: [
      { mode: '手动填写', icon: 'edit', detail: '运动品类 + 时长步进 + 强度分级 + 备注' },
      { mode: '智能拍照', icon: 'camera', detail: '跑步机表盘 / 运动手表实拍提取配速与千卡' },
      { mode: '智能上传', icon: 'sparkles', detail: 'Keep / 华为运动健康长截图或训练日志解析' },
    ],
    refereeTitle: '有效时长门槛 + 强度与消耗交叉校验',
    refereeThreshold: '单次运动时长 ≥ 设定门槛（默认 20 分钟）且强度/配速符合有氧或力量激活区间',
    refereePassExample: '户外慢跑 32 分钟 · 配速 6\'17" · 消耗 196 kcal → 有效打卡盖章',
    refereeInterceptExample:
      '散步买奶茶 5 分钟（未达 20 分钟有效运动门槛）→ 仅归档日常活动，不盖有效章',
    highlights: ['运动截图表盘解析', 'METs 代谢当量估算', '低时长日常走动温柔拦截'],
  },
  {
    tone: 'sleep',
    slug: 'sleep',
    title: '早点睡 · 睡眠板块',
    subtitle: '昼夜节律入睡红线 + 有效睡眠时长双门槛裁判',
    href: '/dev/playbook/modules/sleep',
    inputs: [
      { mode: '手动填写', icon: 'edit', detail: '跨午夜起止时间（自动标次日）+ 5 档表情评分' },
      { mode: '智能拍照', icon: 'camera', detail: '手环睡眠表盘 / 闹钟截图识别起止时刻与深睡' },
      { mode: '智能上传', icon: 'sparkles', detail: '睡眠监测 App 长图或睡眠日记文本提纯' },
    ],
    refereeTitle: '入睡时刻红线（如 ≤ 23:30）+ 有效时长（6.5h–9.5h）双门槛',
    refereeThreshold:
      '不仅要睡够时长，更必须在褪黑素分泌窗口（设定红线前）入睡，拒绝熬夜补觉混充早睡',
    refereePassExample: '23:15 入睡 → 07:10 起床（7h55m，早于 23:30 红线）→ 有效打卡盖章',
    refereeInterceptExample:
      '凌晨 02:15 睡 → 10:30 起（虽睡满 8h15m，但属熬夜补觉）→ 仅记录睡眠，不计早睡打卡',
    highlights: ['防“凌晨睡中午起”假早睡', '跨午夜时长实时算', '手环深睡波形图识别'],
  },
  {
    tone: 'study',
    slug: 'study',
    title: '学一点 · 学习板块',
    subtitle: '最低专注时长（番茄钟门槛）+ 笔记/题库实质内容双核验',
    href: '/dev/playbook/modules/study',
    inputs: [
      { mode: '手动填写', icon: 'edit', detail: '学习主题 + 专注时长步进 + 核心收获摘录' },
      { mode: '智能拍照', icon: 'camera', detail: '纸质手写笔记 / 刷题正确率页面实拍提炼知识点' },
      { mode: '智能上传', icon: 'sparkles', detail: '导出 HTML / Markdown / TXT 笔记自动去噪提纯' },
    ],
    refereeTitle: '专注时长门槛（≥ 25 分钟）+ 实质内容语义对齐核验',
    refereeThreshold: '拒绝“翻书 3 分钟糊弄打卡”；核验专注时长达标且笔记/题目摘要与学习目标一致',
    refereePassExample: '上传二叉树 HTML 笔记 + 专注 45 分钟 + 提炼 BFS 核心复杂度 → 有效打卡盖章',
    refereeInterceptExample:
      '仅填“背单词”且专注 5 分钟（未满 25 分钟番茄钟门槛）→ 提示继续专注后再盖章',
    highlights: ['HTML/TXT 笔记正文提纯', '25 分钟番茄钟底线', '知识点摘要自动结构化'],
  },
  {
    tone: 'custom',
    slug: 'custom',
    title: '我的小目标 · 自定义板块',
    subtitle: '多目标独立期限 + 动态字段组装 + 个性化 AI 裁判规则器',
    href: '/dev/playbook/modules/custom',
    inputs: [
      {
        mode: '手动填写',
        icon: 'edit',
        detail: '按用户自定义字段（数字/单选/布尔/时长/评分）动态渲染',
      },
      {
        mode: '智能拍照',
        icon: 'camera',
        detail: '水杯刻度 / 练字纸张 / 打卡佐证照自动映射动态字段',
      },
      { mode: '智能上传', icon: 'sparkles', detail: '习惯流水账 TXT / 导出的表格记录一键解析填入' },
    ],
    refereeTitle: '用户自定义周期期限 + 个性化多条件 AI 裁判规则',
    refereeThreshold:
      '每个自定义目标可独立设定起止期限与达标表达式（如：饮水 ≥ 6 杯 且 含糖饮料 = 0 杯）',
    refereePassExample: '戒糖饮水挑战：今日温水 7 杯 + 含糖饮料 0 杯（满足双条件）→ 有效打卡盖章',
    refereeInterceptExample:
      '今日喝水 7 杯但下午喝了 1 杯全糖奶茶（违反“含糖=0”红线）→ 诚实存档，今日不盖章',
    highlights: ['多目标独立起止期限', '7 种动态字段自由拼装', '自定义 AI 裁判检验公式'],
  },
]

export default function ModulesOverviewPlaybookPage() {
  return (
    <>
      <PageHeader
        title="五大打卡板块 · 深度架构总览"
        description="将「好好吃饭、动一动、早点睡、学一点、我的小目标」五大板块统一升级为「三态输入 Tab（手动填写 | 智能拍照 | 智能上传）+ AI 科学裁判机制 + 诚实存档/达标盖章分离」的模块化架构。点击任意板块卡片可进入对应深度设计专页。"
        docRef="ui-design-system.md · ADR-0002 · ADR-0003"
      />

      <Section
        ann="playbook.modules.overview.architecture-banner"
        title="01 · 全板块统一三段式架构（输入三态 + AI 科学裁判 + 诚实存档机制）"
        description="所有打卡板块共享同一套手账底座，区别仅在于各板块专属的填充子组件与科学裁判阈值。既防止“凌晨两点睡十点起算早睡”“看书三分钟糊弄连击”，又鼓励用户诚实记录每一天的数据。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Specimen
            ann="playbook.modules.overview.valid-stamp"
            label="双轨制 A · 满足科学裁判门槛 → 有效打卡盖章（计入连击）"
            note="当各项指标通过板块专属 AI 裁判（如 23:15 早睡且睡满 7h55m），团团欢呼并盖下板块印章，连击 +1"
            bg="paper"
          >
            <div className="border-success/30 bg-surface shadow-soft flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Mascot mood="cheer" size={56} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="success" dot>
                      有效打卡 · 连击 +1
                    </Badge>
                    <Badge tone="sleep" icon="sleep">
                      早点睡
                    </Badge>
                  </div>
                  <p className="text-caption mt-1 font-bold">23:15 入睡 · 7小时55分</p>
                  <p className="text-tiny text-muted">
                    早于 23:30 红线且深睡达标，已盖下今日早睡章～
                  </p>
                </div>
              </div>
              <Stamp text="已达标" caption="有效卡" tone="sleep" size={62} />
            </div>
          </Specimen>

          <Specimen
            ann="playbook.modules.overview.archive-only"
            label="双轨制 B · 未达门槛但诚实记录 → 仅存档数据（不盖有效章）"
            note="如凌晨 02:15 才睡（熬夜补觉 8 小时），团团温柔提醒原因，数据照常记入睡眠趋势图，但不算早睡有效打卡"
            bg="paper"
          >
            <div className="border-warning/35 bg-surface shadow-soft flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Mascot mood="sleepy" size={56} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="warning" icon="alert">
                      仅记录数据 · 未达早睡红线
                    </Badge>
                  </div>
                  <p className="text-caption mt-1 font-bold">02:15 入睡 · 8小时15分</p>
                  <p className="text-tiny text-muted">
                    虽睡够时长但属熬夜补觉，已存入睡眠曲线，今晚早点睡哦
                  </p>
                </div>
              </div>
              <span className="bg-warning-soft text-warning-ink font-display text-tiny shrink-0 rounded-xl border border-dashed border-current px-2.5 py-2 text-center font-bold">
                已存档
                <br />
                未盖章
              </span>
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.modules.overview.cards"
        title="02 · 五大打卡板块入口矩阵（每行 2 卡 · 点击进入深度专页）"
        description="每张卡片汇总该板块的「三态输入能力」「AI 科学裁判规则与有效打卡门槛」及正反判例对比。点击卡片底部按钮直达对应板块的 Playbook 深度设计专页。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {MODULE_CARDS.map((mod) => (
            <Card
              key={mod.slug}
              data-ann={`playbook.modules.overview.card.${mod.slug}`}
              className="flex min-w-0 flex-col justify-between gap-4"
            >
              <div className="flex min-w-0 flex-col gap-3">
                {/* 头部：板块图标 + 标题 + 徽章 */}
                <div className="border-border flex items-start justify-between gap-3 border-b pb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <IconTile icon={moduleMeta[mod.tone].icon} tone={mod.tone} size="lg" />
                    <div className="min-w-0">
                      <h3 className="text-subhead truncate font-bold">{mod.title}</h3>
                      <p className="text-tiny text-muted truncate">{mod.subtitle}</p>
                    </div>
                  </div>
                  <Badge tone={mod.tone} icon={moduleMeta[mod.tone].icon}>
                    {moduleMeta[mod.tone].label}板块
                  </Badge>
                </div>

                {/* 核心输入方式（三态） */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-tiny text-muted font-semibold">
                      1. 统一三态输入（CheckinModeTabs）
                    </span>
                    <span className="text-tiny text-subtle font-mono">
                      manual | capture | upload
                    </span>
                  </div>
                  <div className="bg-surface-sunken grid gap-1.5 rounded-xl p-2.5">
                    {mod.inputs.map((inp) => (
                      <div key={inp.mode} className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'text-tiny inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold',
                            softToneClass[mod.tone],
                          )}
                        >
                          <Icon name={inp.icon} size={12} />
                          <span>{inp.mode}</span>
                        </span>
                        <span className="text-tiny text-muted min-w-0 flex-1 truncate">
                          {inp.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 科学裁判机制与门槛 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-tiny text-muted font-semibold">
                    2. AI 科学裁判机制与有效打卡门槛
                  </span>
                  <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-3">
                    <div className="flex items-center gap-1.5">
                      <Icon name="shield" size={15} className="text-primary-ink shrink-0" />
                      <span className="text-caption font-bold">{mod.refereeTitle}</span>
                    </div>
                    <p className="text-tiny text-muted leading-relaxed">{mod.refereeThreshold}</p>

                    <div className="border-border flex flex-col gap-1.5 border-t border-dashed pt-2">
                      <div className="flex items-start gap-1.5">
                        <span className="bg-success-soft text-success-ink text-tiny shrink-0 rounded-md px-1.5 py-0.5 font-bold">
                          达标盖章
                        </span>
                        <span className="text-tiny text-foreground leading-snug">
                          {mod.refereePassExample}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="bg-warning-soft text-warning-ink text-tiny shrink-0 rounded-md px-1.5 py-0.5 font-bold">
                          拦截存档
                        </span>
                        <span className="text-tiny text-muted leading-snug">
                          {mod.refereeInterceptExample}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 底部亮点标签 + 直达专页按钮 */}
              <div className="border-border flex flex-col gap-3 border-t pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {mod.highlights.map((h) => (
                    <Badge key={h} tone="neutral">
                      {h}
                    </Badge>
                  ))}
                </div>
                <Link
                  href={mod.href}
                  className={cn(
                    'text-caption flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold transition-all duration-(--dur-fast) active:scale-[0.98]',
                    softToneClass[mod.tone],
                    'hover:brightness-[0.97]',
                  )}
                >
                  <span>进入「{moduleMeta[mod.tone].label}」深度设计专页</span>
                  <Icon name="chevron-right" size={16} />
                </Link>
              </div>
            </Card>
          ))}

          {/* 第 6 张卡片：全局智能识别与跨板块复用说明（保持 2 列网格对称） */}
          <Card
            variant="sunken"
            data-ann="playbook.modules.overview.card.smart-hub"
            className="flex min-w-0 flex-col justify-between gap-4"
          >
            <div className="flex flex-col gap-3">
              <div className="border-border flex items-start justify-between gap-3 border-b pb-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <IconTile icon="sparkles" tone="primary" size="lg" />
                  <div className="min-w-0">
                    <h3 className="text-subhead truncate font-bold">全局智能识别与组件复用底座</h3>
                    <p className="text-tiny text-muted truncate">
                      未知板块先过判别器 · 已知板块直连专属填充子组件
                    </p>
                  </div>
                </div>
                <Badge tone="primary" icon="puzzle">
                  架构底座
                </Badge>
              </div>

              <p className="text-caption text-muted leading-relaxed">
                五大板块并不是五套孤立的页面，而是共享同一套手账扫描镜（
                <code className="font-mono">SmartScannerLens</code>）、三态模式切换栏（
                <code className="font-mono">CheckinModeTabs</code>）与科学裁判反馈卡（
                <code className="font-mono">RefereeVerdictCard</code>）：
              </p>

              <ul className="text-tiny text-muted space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">从底部「＋」弹层点智能拍照/上传</strong>
                    ：进入全局 <code className="font-mono">/checkin/smart</code>
                    ，由一行识别方向条自动高亮所属板块。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">从单个目标点进板块专属页</strong>
                    ：顶部自带「手动填写 | 智能拍照 | 智能上传」三态
                    Tab，切到智能模式时直接跳过板块判别器。
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon name="check" size={15} className="text-success mt-0.5 shrink-0" />
                  <span>
                    <strong className="text-foreground">AI 科学裁判把关连击含金量</strong>
                    ：和朋友一起打卡时，每一枚印章都代表真正达到了健康/专注门槛，而未达标记录也会被温柔存档。
                  </span>
                </li>
              </ul>
            </div>

            <div className="border-border flex flex-col gap-3 border-t pt-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="primary" icon="camera">
                  图片内存压缩不落盘
                </Badge>
                <Badge tone="neutral">deepseek-flash 驱动</Badge>
              </div>
              <Link
                href="/dev/playbook/smart-checkin"
                className="bg-primary-soft text-primary-ink text-caption flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold transition-all duration-(--dur-fast) hover:brightness-[0.97] active:scale-[0.98]"
              >
                <span>查看「智能打卡」通用原子组件规范</span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </div>
          </Card>
        </div>
      </Section>

      <Section ann="playbook.modules.overview.rules" title="03 · 五大打卡板块通用设计守则">
        <Rules
          dos={[
            '所有打卡板块顶部统一使用三态 <CheckinModeTabs />（手动填写 | 智能拍照 | 智能上传），保持全站交互心智一致',
            '坚持「诚实存档 vs 达标盖章」双轨制：未达到科学门槛（如凌晨 2 点睡、专注仅 5 分钟）时照常保存健康/学习记录，但不盖有效打卡章，保护好友连击公平性',
            '所有板块表单内部控件一律单列垂直排布（NumberField、TimeRangeField 独占一行），在 Playbook 中以每行最多 2 卡（md:grid-cols-2）展示，杜绝横向挤压溢出',
            'AI 裁判反馈卡语气保持团团的温柔手账朋友口吻，解释清楚科学原因（如昼夜节律褪黑素窗口、BMR 基础代谢保护），绝不居高临下说教',
          ]}
          donts={[
            '不要用“只要填了数据就算打卡成功”的无脑逻辑——凌晨 2 点睡满 8 小时不能算「早点睡」，吃 1 个苹果饿肚子不能算「好好吃饭」',
            '不要在用户未达标时直接报错拒绝保存数据——用户诚实记录了熬夜或加餐，应当温柔归档到趋势图并提供改善建议',
            '不要在卡片里使用深色高饱和实底块或写死 hex 颜色，一律使用各板块的 soft / ink 语义 token',
          ]}
        />
      </Section>
    </>
  )
}
