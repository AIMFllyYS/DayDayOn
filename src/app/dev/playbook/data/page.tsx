import type { Metadata } from 'next'
import { LineChart } from '@/components/charts/line-chart'
import { Sparkline } from '@/components/charts/sparkline'
import { WeekHeatmap } from '@/components/charts/week-heatmap'
import { Avatar, AvatarStack } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { PresetAvatar } from '@/components/mascot/preset-avatar'
import { mascotMoods } from '@/components/mascot/mascot-svg'
import { PageHeader, Rules, Section, Specimen } from '../_components/section'
import {
  CalendarDemo,
  DateTimeFieldsDemo,
  DEMO_TODAY,
  ImagePickerDemo,
  RatingFeedbackDemo,
  ReadonlyCalendarDemo,
  StatesDemo,
  TimeRangeDemo,
} from './_demos'

export const metadata: Metadata = { title: '数据与时间' }

// 演示数据：近 14 天体重（kg），中间有两天没记
const weight = [
  53.2,
  53.0,
  null,
  52.9,
  52.8,
  52.9,
  52.6,
  52.7,
  null,
  52.5,
  52.6,
  52.4,
  52.5,
  52.4,
].map((value, i) => ({ label: `10/${20 + i}`, value }))

// 近 30 天 AI 花费（元）
const spend = Array.from({ length: 30 }, (_, i) => ({
  label: i < 12 ? `10/${i + 20}` : `11/${i - 11}`,
  value: Math.round((0.6 + Math.sin(i / 3) * 0.4 + (i % 5) * 0.08) * 100) / 100,
}))

const heatDays = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
]
const heatRows = [
  { module: 'exercise', cells: [1, 0, 0, 0, 0, 0, 0] },
  { module: 'diet', cells: [0.67, 0, 0, 0, 0, 0, 0] },
  { module: 'sleep', cells: [1, 0, 0, 0, 0, 0, 0] },
  { module: 'study', cells: [0.3, 0, 0, 0, 0, 0, 0] },
  { module: 'custom', cells: [0, 0, 0, 0, 0, 0, 0] },
] as const
// 周四的视角：前四天都有数据
const heatRowsMidweek = [
  { module: 'exercise', cells: [1, 1, 0.5, 1, 0, 0, 0] },
  { module: 'diet', cells: [0.67, 1, 1, 0.33, 0, 0, 0] },
  { module: 'sleep', cells: [1, 0, 1, 1, 0, 0, 0] },
  { module: 'study', cells: [0.3, 0.8, 0, 1, 0, 0, 0] },
] as const

const tones = ['primary', 'exercise', 'diet', 'sleep', 'study', 'custom'] as const

export default function DataPage() {
  return (
    <>
      <PageHeader
        title="数据与时间"
        description="日历、日期与时间输入、睡眠区间、图表、空状态、错误态、图片选择与预设头像。日期一律用 YYYY-MM-DD 字符串传入，组件不读系统时区。"
        docRef="ui-primitives.md 第 6–8 节"
      />

      <Section
        ann="playbook.data.calendar"
        title="日历 Calendar"
        description="react-day-picker 10 的唯一入口：周一起、中文。已打卡的日子按板块色标记：实底 = 达成、浅底 = 打了但没达成、虚线描边 = 补卡。今天下方有一个小点。"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.data.calendar.interactive"
            label="可点击（目标详情页）"
            note="传 onDayClick 后日子变成按钮，方向键可移动；maxDate 之后禁用；默认不能翻到未来月份"
          >
            <CalendarDemo />
          </Specimen>
          <Specimen
            ann="playbook.data.calendar.readonly"
            label="只读"
            note="不传 onDayClick 就只展示，读屏按格子读出日期和打卡状态"
          >
            <ReadonlyCalendarDemo />
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.data.inputs"
        title="日期与时间输入"
        description="原生 date / datetime-local / time 外套 Field，手机上弹系统选择器（ADR-0007）。值是本地字符串，提交前用 src/lib/time 转成时刻。"
      >
        <div className="grid gap-3">
          <Specimen
            ann="playbook.data.inputs.fields"
            label="DateField / TimeField"
            note="withTime 用于待办 DDL；min / max 限制可选范围；error 替换 hint"
          >
            <DateTimeFieldsDemo />
          </Specimen>
          <Specimen
            ann="playbook.data.inputs.range"
            label="TimeRangeField 睡眠区间"
            note="起床早于入睡时显示「次日」并实时算时长；默认合法范围 30 分钟 – 20 小时"
          >
            <TimeRangeDemo />
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.data.charts"
        title="图表"
        description="自研 SVG + d3-shape（只用 line、area、curveMonotoneX），比例尺自己写。每张图都有 aria-label 和可见的数值摘要。"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.data.charts.line"
            label="LineChart · 体重"
            note="宽度跟随容器；没记的日子断开不连线；点少于 15 个时画圆点"
          >
            <LineChart
              data={weight}
              label="近 14 天体重"
              unit="kg"
              tone="exercise"
              className="w-full"
            />
          </Specimen>
          <Specimen
            ann="playbook.data.charts.line-dense"
            label="LineChart · AI 花费（后台）"
            note="点多时只标最后一个；横轴最多标 5 个日期"
          >
            <LineChart
              data={spend}
              label="近 30 天 AI 花费"
              unit="元"
              tone="primary"
              decimals={2}
              className="w-full"
            />
          </Specimen>
          <Specimen
            ann="playbook.data.charts.sparkline"
            label="Sparkline"
            note="卡片里看走势，不带刻度；label 里写清楚从多少到多少"
          >
            <Card className="flex w-full max-w-xs items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-tiny text-muted font-semibold">今日体重</span>
                <span className="font-display text-title font-semibold tabular-nums">
                  52.4<span className="text-caption text-muted ml-0.5">kg</span>
                </span>
                <span className="text-tiny text-success-ink">比上周 −0.6</span>
              </div>
              <Sparkline
                values={weight.slice(-7).map((w) => w.value)}
                label="近 7 天体重，从 52.6 降到 52.4"
                tone="exercise"
              />
            </Card>
            <Sparkline
              values={[3, 5, 4, 6, 8, 7, 9]}
              label="近 7 天学习时长，持续上升"
              tone="study"
            />
            <Sparkline values={[7.5]} label="只有一天的数据" tone="sleep" />
          </Specimen>
          <Specimen
            ann="playbook.data.charts.heatmap"
            label="WeekHeatmap · 本周热力图"
            note="周一到周日 × 板块；四档深浅 + 完成格打勾，不只靠颜色；今天之后的格子是虚线"
          >
            <div className="grid w-full gap-6">
              <WeekHeatmap days={heatDays} rows={heatRows} today={DEMO_TODAY} />
              <WeekHeatmap
                days={heatDays}
                rows={heatRowsMidweek}
                today="2026-11-05"
                label="周四的本周热力图"
              />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.data.states"
        title="空状态与错误态"
        description="每个页面都要有：空状态 = 团团 + 一句话 + 下一步；错误态 = 失落的团团 + 原因 + 重试。错误详情写在文字里，不让团团表达。"
      >
        <Specimen
          ann="playbook.data.states.demo"
          label="EmptyState / ErrorState"
          note="compact 用于卡片内部；message 一般来自 errorMessage(err)"
        >
          <StatesDemo />
        </Specimen>
      </Section>

      <Section
        ann="playbook.data.image"
        title="图片选择 ImagePicker"
        description="拍照（后置摄像头）或从相册选 → 压缩 → 交给调用方识别。预览只用内存里的 object URL，换图和卸载时释放；识别后不保存原图。"
      >
        <Specimen
          ann="playbook.data.image.picker"
          label="ImagePicker"
          note="compress 由调用方传入（src/lib/image）；状态 idle / compressing / recognizing / error"
        >
          <ImagePickerDemo />
        </Specimen>
      </Section>

      <Section
        ann="playbook.data.avatar"
        title="预设头像"
        description="只用预设头像（ADR-0021）：存为 mascot:<character>:<mood>:<tone>，没选或解析不了时显示昵称首字。"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Specimen
            ann="playbook.data.avatar.sizes"
            label="Avatar avatar=…"
            note="sm 32 / md 40 / lg 56；ring 表示连续打卡中"
          >
            <Avatar name="小满" avatar="mascot:tuan:cheer:exercise" size="lg" ring />
            <Avatar name="阿柚" avatar="mascot:dun:happy:study" />
            <Avatar name="豆豆" avatar="mascot:tuan:love:custom" size="sm" />
            <Avatar name="七七" avatar={null} tone="sleep" />
            <Avatar name="南风" avatar="mascot:unknown:happy:diet" tone="diet" />
            <AvatarStack
              names={['小满', '阿柚', '豆豆', '七七', '南风']}
              avatars={[
                'mascot:tuan:happy:primary',
                'mascot:dun:cheer:exercise',
                null,
                'mascot:tuan:sleepy:sleep',
              ]}
            />
          </Specimen>
          <Specimen
            ann="playbook.data.avatar.palette"
            label="可选组合"
            note="团团 / 墩墩 × 9 种表情 × 6 种底色；引导页按这个网格让用户挑"
          >
            <div className="grid gap-2">
              {(['tuan', 'dun'] as const).map((c) => (
                <div key={c} className="flex flex-wrap gap-1.5">
                  {mascotMoods.map((m, i) => (
                    <PresetAvatar
                      key={m.mood}
                      preset={{
                        character: c,
                        mood: m.mood,
                        tone: tones[i % tones.length] ?? 'primary',
                      }}
                      size={40}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Specimen>
        </div>
      </Section>

      <Section
        ann="playbook.data.rating"
        title="评分反馈"
        description="Rating 选中后的情绪反馈（2026-11-01 批注），只在用户点击时播放。"
      >
        <Specimen ann="playbook.data.rating.feedback" label="Rating feedback" bg="paper">
          <RatingFeedbackDemo />
        </Specimen>
      </Section>

      <Section ann="playbook.data.rules" title="规则">
        <Rules
          dos={[
            '日期、月份用 YYYY-MM-DD / YYYY-MM 字符串传入，"今天"由调用方按用户时区算好',
            '图表必须有 label，并在可见处写出关键数值',
            '空状态给出下一步操作；错误态写清原因并提供重试',
            '图片预览只在识别前出现，识别结果和历史里不展示原图',
          ]}
          donts={[
            '在业务代码里 import react-day-picker 或 d3-shape',
            '用 new Date(y, m, d) 构造日历日期',
            '只用颜色区分打卡状态（日历有图例、热力图有勾和文字）',
            '把用户照片放进 localStorage、缓存或日志',
          ]}
        />
      </Section>
    </>
  )
}
