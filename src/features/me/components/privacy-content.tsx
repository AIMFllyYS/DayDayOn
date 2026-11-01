import Link from 'next/link'
import { Card } from '@/components/ui/card'

/*
 * 隐私说明（PRD 2.11、3「隐私」、ADR-0002 第 4 节）。静态内容，不要求登录。
 */

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: '我们收集什么',
    items: [
      '登录邮箱，用来发验证码和找回账号',
      '你填的昵称、预设头像，以及可选的性别、出生年份、身高、时区',
      '你的目标、打卡记录、体重、每天的心情评分和待办',
      '注册和最近一次登录的 IP，只用来防止批量注册和盗刷额度',
      'AI 识别的调用记录（时间、用途、花费），不含图片',
    ],
  },
  {
    title: '健康数据怎么用',
    items: [
      '体重、饮食、睡眠属于健康相关的个人信息，新人引导里会单独征求你的同意',
      '只用来给你算进度、画走势、估算运动消耗（估算结果，非医疗建议）',
      '永远不公开，不参与排行；排行榜只显示昵称、头像、打卡天数和连续天数',
      '默认不加入排行榜，在「我的」里随时可以改',
    ],
  },
  {
    title: '照片从不保存',
    items: [
      '拍照记一餐时，照片只在浏览器里压缩，再直接发给识别模型',
      '服务器不把照片写入磁盘、数据库或日志，识别完立刻丢弃，只保存识别出的文字',
      '界面上也不会再显示原图',
    ],
  },
  {
    title: '导出与注销',
    items: [
      '「我的 → 导出我的数据」可以随时下载一份 JSON，包含你的资料、目标、打卡、体重、心情和待办',
      '「我的 → 注销账号」输入"注销"确认后，你的资料和全部打卡数据会立即删除，排行榜和动态里也随之消失',
      'AI 调用和额度流水是账本，只保留金额与时间，注销后不再和你的账号关联',
    ],
  },
]

export function PrivacyContent() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-bold">隐私说明</h1>
        <p className="text-caption text-muted">
          DayDayOn 是朋友之间互相督促的小工具，我们只收集用得到的数据。
        </p>
      </div>
      {SECTIONS.map((s) => (
        <Card key={s.title} className="flex flex-col gap-2">
          <h2 className="text-subhead font-bold">{s.title}</h2>
          <ul className="text-body list-disc space-y-1.5 pl-5">
            {s.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </Card>
      ))}
      <p className="text-caption text-muted text-center">
        <Link
          href="/"
          className="text-primary-ink inline-flex min-h-11 items-center font-semibold underline"
        >
          回到 DayDayOn
        </Link>
      </p>
    </div>
  )
}
