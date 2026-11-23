import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { announcements } from './schema'

/*
 * 官方与系统公告清单（单一数据源）：
 * - 同时供生产启动钩子（src/server/db/startup-migrate.ts）与本地种子脚本（scripts/dev/seed.ts）幂等同步；
 * - 通过 slug 唯一键执行 ON CONFLICT DO UPDATE，不改动既有行的 UUID 主键，
 *   因此用户对历史公告的已读状态（announcement_reads）完整保留，新发布公告会自动作为未读推送给全体用户。
 */

export interface OfficialAnnouncementSeed {
  readonly slug: string
  readonly tag: string
  readonly version: string
  readonly pinned: boolean
  readonly publishedAt: Date
  readonly title: string
  readonly content: string
}

export const OFFICIAL_ANNOUNCEMENTS: readonly OfficialAnnouncementSeed[] = [
  {
    slug: 'release-v0.1.14',
    tag: '版本更新',
    version: '0.1.14',
    pinned: true,
    publishedAt: new Date('2026-11-23T06:00:00.000Z'),
    title:
      'DayDayOn 近期更新公告（v0.1.12 – v0.1.14）：待办清单全面重构、打卡海报分享与团团 AI 升级',
    content: [
      '伙伴们好！最近几天 DayDayOn 连续完成多轮核心升级与热更新打磨，带来更顺手的待办管理、更好看的数据分享以及更稳的团团陪伴体验：',
      '1. 待办—清单全面升级（自定义分组、可折叠面板与 30 天自动归档）：支持自定义待办分组（原有待办自动归入「默认待办」），每个分组均为紧凑型可折叠面板；超 DDL 自动归入「已过期」，完成或放弃自动移入对应分组并默认折叠，满 30 天自动归档且可在右上角菜单随时查阅；支持长按待办与长按分组拖拽排序，删除操作统一接入二次确认防误删。',
      '2. 四象限固定 2×2 双视图、备注标签与「过程」时间轴：优先级升级为四象限（重要且紧急 / 重要不紧急 / 紧急不重要 / 不重要不紧急），右上角菜单一键切换列表与固定尺寸 2×2 内部独立滚动四象限视图；单条待办支持最多 2000 字备注与 5 个自定义标签；右下角新增常驻悬浮加号球随时新建，右上角「过程」独立页按时间轴完整回溯待办流转。',
      '3. 打卡分析页原生 PNG 手账海报分享：五大打卡板块分析页顶栏右上角新增「分享」按钮，一键生成 16:9 横版 / 9:16 竖版手账跨页报告海报并附带专属二维码，安卓端支持一键保存相册、复制图片或调起系统分享。',
      '4. 饮食三餐全天汇总与早睡规则优化：修复「好好吃饭」三餐集齐后仅展示单餐的问题，全天总评现已完整汇总早、午、晚及加餐全部菜品与营养素；「早点睡」取消睡眠时长上限门槛，按时入睡并睡满最短时长即记为有效达标。',
      '5. 团团 AI 稳定性加固与待办上下文复盘：修复对话工具调用截断与裁判偶发异常，大幅提升对话步数与输出上限，并新增待办渐进式披露工具链——现在可以直接让团团帮你梳理分组、四象限、过期与归档复盘啦～',
      '（提示：网页与热更新内容已自动生效至 v0.1.14；如需体验最新原生分享与安卓壳特性，可在「我的 → 数据与关于 → 检查更新」升级至 v0.1.13 安装包。）',
    ].join('\n'),
  },
  {
    slug: 'release-v0.1.11',
    tag: '版本更新',
    version: '0.1.11',
    pinned: false,
    publishedAt: new Date('2026-11-16T04:00:00.000Z'),
    title: 'DayDayOn v0.1.11 更新公告：总打卡周期与进度环、目标设置重构及首屏提速',
    content: [
      '伙伴们好！DayDayOn v0.1.11 已经上线，本次版本从「立目标 → 坚持 → 看进度」完整打通核心体验：',
      '1. 全局打卡周期与主页总进度环：在新人引导与「我的 → 目标设置」中统一支持设定总打卡周期 / 坚持天数（7 / 14 / 21 / 30 / 60 / 100 天或自定义截止日期）及每日总提醒时间；主页首卡新增「总打卡进度」环形图，直观掌握「已打卡天数 / 目标坚持天数」。',
      '2. 「目标设置」三页签清晰重构：告别原先单页长表单，整理为「板块与周期」「目标与计划」「达标规则」三个专注页签，支持在页内直接调整每日目标量、每周几天与计划时段。',
      '3. 首页首屏加速与全站细节打磨：消除进入首页时的二次骨架屏加载闪烁；全面支持团团 / 墩墩 / 绵绵 / 柚柚四种陪伴形象与开屏动画，同步修复多处时区展示、弹窗退场动画与移动端输入字号细节（配套安卓端已同步更新至 v0.1.11，可在「我的 → 数据与关于 → 检查更新」升级）。',
    ].join('\n'),
  },
  {
    slug: 'release-v0.1.9',
    tag: '版本更新',
    version: '0.1.9',
    pinned: false,
    publishedAt: new Date('2026-11-11T12:00:00.000Z'),
    title: 'DayDayOn v0.1.9 更新公告：全屏消息体验、「我的」多级菜单与计步提醒升级',
    content: [
      '伙伴们好！DayDayOn v0.1.9 已经上线，本次更新带来更清爽顺手的日常打卡与陪伴体验：',
      '1. 智能上传直连团团：在任意智能上传入口点击左下角「+ 系统文件 / 附件」选中照片或文档后，立即直传团团开始识别分析，告别空状态等待。',
      '2. 「我的」多级设置重构：按照原生移动端设计规范拆分为清晰的多级分组页面，精简冗余工程术语；开启「手机提醒」自动检测通知授权，并支持系统级准点推送提醒。',
      '3. 今日步数与卡片升级：优化跨日与重启后的硬件计步同步稳定性，支持手动录入与一键同步双模式；主页「今日步数」卡片等高横跨双列，版面更饱满。',
      '4. 全屏消息与通知中心：一级与二级页面全面升级为无外框全屏社交布局，顶部独立呈现「打卡房间与动态」与「官方与系统通知」，下方排布好友私聊会话。',
      '5. 官方公告实时播报：全新数据库公告模块正式启用，重要版本更新与活动通知都会第一时间在这里与大家见面～',
    ].join('\n'),
  },
] as const

export async function syncOfficialAnnouncements<TSchema extends Record<string, unknown>>(
  db: NodePgDatabase<TSchema>,
): Promise<number> {
  let synced = 0
  const now = new Date()
  for (const item of OFFICIAL_ANNOUNCEMENTS) {
    const res = await db
      .insert(announcements)
      .values({
        slug: item.slug,
        tag: item.tag,
        version: item.version,
        pinned: item.pinned,
        publishedAt: item.publishedAt,
        title: item.title,
        content: item.content,
      })
      .onConflictDoUpdate({
        target: announcements.slug,
        set: {
          tag: item.tag,
          version: item.version,
          pinned: item.pinned,
          publishedAt: item.publishedAt,
          title: item.title,
          content: item.content,
          updatedAt: now,
        },
      })
      .returning({ id: announcements.id })
    synced += res.length
  }
  return synced
}
