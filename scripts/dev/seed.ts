// 本地种子数据：pnpm db:seed（database.md 第 9 节）。幂等：补齐缺失配置，并把低于新基线的频控阈值提升到默认值、清理本地限流计数。
// 用户由 Better Auth 在登录时创建，这里不造用户。
import { existsSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  announcements,
  appSettings,
  rateLimit,
  rateLimitCounters,
} from '../../src/server/db/schema'
import { DEFAULT_SETTINGS, type AppSettingKey } from '../../src/server/settings-schema'

const INITIAL_ANNOUNCEMENTS = [
  {
    slug: 'release-v0.1.9',
    tag: '版本更新',
    version: '0.1.9',
    pinned: true,
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

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

const url = process.env.DATABASE_URL
if (!url) throw new Error('缺少 DATABASE_URL：复制 .env.example 为 .env.local 后填写')

const RATE_LIMIT_BASELINE_KEYS: AppSettingKey[] = [
  'signupPerIpDaily',
  'otpPerEmailDaily',
  'otpPerIpDaily',
]

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    const db = drizzle({ client: pool, casing: 'snake_case' })
    const rows = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))
    const inserted = await db
      .insert(appSettings)
      .values(rows)
      .onConflictDoNothing({ target: appSettings.key })
      .returning({ key: appSettings.key })

    // 若库里已存在的频控阈值低于代码新基线，自动提升到新基线，避免旧种子值锁死本地登录
    let upgraded = 0
    for (const key of RATE_LIMIT_BASELINE_KEYS) {
      const target = DEFAULT_SETTINGS[key]
      const res = await db
        .update(appSettings)
        .set({ value: target, updatedAt: new Date() })
        .where(sql`${appSettings.key} = ${key} AND (${appSettings.value})::text::int < ${target}`)
        .returning({ key: appSettings.key })
      upgraded += res.length
    }

    await db.delete(rateLimitCounters)
    await db.delete(rateLimit)

    let seededAnnouncements = 0
    for (const item of INITIAL_ANNOUNCEMENTS) {
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
            updatedAt: new Date(),
          },
        })
        .returning({ id: announcements.id })
      seededAnnouncements += res.length
    }

    console.log(
      `[db:seed] app_settings 新增 ${inserted.length} 项、提升旧频控阈值 ${upgraded} 项（共 ${rows.length} 项），同步官方公告 ${seededAnnouncements} 条，并已清空本地限流计数`,
    )
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('[db:seed] 失败', error)
  process.exitCode = 1
})
