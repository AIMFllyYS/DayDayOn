import type { ErrorBody, ErrorCode } from '@/server/api/errors'

/*
 * 错误码 → 中文文案（ADR-0006、ui-design-system.md 第 11 节语气）。用户看到的错误文案只来自这里。
 * F1 维护；新增错误码时 errors.ts 与本文件一起改（Record 会让漏写的码直接类型报错）。
 * 本文件只 `import type` 服务端错误码，不引入任何服务端运行时代码。
 */

export type ApiErrorLike = Pick<ErrorBody, 'code'> & Partial<Omit<ErrorBody, 'code'>>

type Message = string | ((e: ApiErrorLike) => string)

/** 时刻 → "11月2日 08:00"（北京时间）。这里只做展示，避免依赖 src/lib/time/ 的加载顺序 */
function formatUntil(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function minutesText(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) return '一会儿'
  const m = Math.ceil(seconds / 60)
  return m >= 60 ? `${Math.ceil(m / 60)} 小时` : `${m} 分钟`
}

export const FALLBACK_MESSAGE = '出了点小状况，稍后再试试'

export const errorMessages: Record<ErrorCode, Message> = {
  VALIDATION_FAILED: '有几项没填对，看一下标红的地方',
  EMAIL_DOMAIN_NOT_ALLOWED: '暂时只支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱',
  MAKEUP_NOT_ALLOWED: '只能补昨天的卡哦',
  REDEEM_CODE_INVALID: '兑换码好像不对，检查一下再试',

  UNAUTHENTICATED: '登录已过期，重新登录一下吧',
  QUOTA_INSUFFICIENT: '本周的 AI 额度用完了，可以手动记录，或兑换额度',

  FORBIDDEN: '这里暂时进不去',
  ACCOUNT_BANNED: (e) => {
    const reason = e.ban?.reason ? `，原因：${e.ban.reason}` : ''
    const until = e.ban?.expiresAt ? `，${formatUntil(e.ban.expiresAt)} 后恢复` : ''
    return `账号已被停用${reason}${until}`
  },
  TWO_FACTOR_REQUIRED: '先开启两步验证，才能使用后台',
  ONBOARDING_REQUIRED: '先完成新人引导吧',

  NOT_FOUND: '没找到这个页面或内容',
  GOAL_NOT_FOUND: '这个目标不见了，可能已经删除',
  CHECKIN_NOT_FOUND: '这条打卡不见了，可能已经删除',
  TODO_NOT_FOUND: '这条待办不见了，可能已经删除',
  USER_NOT_FOUND: '找不到这个用户',
  REDEEM_CODE_NOT_FOUND: '找不到这个兑换码',

  ALREADY_ONBOARDED: '你已经完成引导啦',
  GOAL_LIMIT_REACHED: '进行中的目标太多了（最多 20 个，睡眠目标只能有 1 个），先归档几个吧',
  TODO_LIMIT_REACHED: '未完成的待办太多了，先清掉一些吧',
  CHECKIN_EXISTS: '今天已经记过这一项了',
  WEIGHT_CHANGE_UNCONFIRMED: (e) => {
    if (e.previousWeightGrams === undefined) return '和上次差得有点多，确认没输错吗？'
    return `上次是 ${(e.previousWeightGrams / 1000).toFixed(1)} kg，差得有点多，确认没输错吗？`
  },
  REDEEM_CODE_USED: '这个兑换码已经用过了',
  IDEMPOTENCY_KEY_REUSED: '这个操作已经提交过了，刷新看看',
  REQUEST_IN_PROGRESS: '正在处理上一次的提交，稍等一下',

  PAYLOAD_TOO_LARGE: '图片太大了，换一张或截个图试试',
  UNSUPPORTED_MEDIA_TYPE: '这张图打不开，换一张或截个图试试',
  AI_RECOGNITION_FAILED: '没看清这张照片，手动填一下吧',

  RATE_LIMITED: (e) => `太频繁了，${minutesText(e.retryAfterSeconds)}后再试试`,
  REDEEM_LOCKED: (e) => `兑换失败次数太多，${minutesText(e.retryAfterSeconds)}后再试`,

  INTERNAL: FALLBACK_MESSAGE,
  NOT_IMPLEMENTED: '这个功能还在做，敬请期待',
  AI_PAUSED: 'AI 识别暂时休息了，先手动记录吧',
}

/** 按错误体取文案；未知 code 返回兜底文案 */
export function errorMessage(error: ApiErrorLike | { code: string }): string {
  const m = (errorMessages as Record<string, Message | undefined>)[error.code]
  if (m === undefined) return FALLBACK_MESSAGE
  return typeof m === 'function' ? m(error as ApiErrorLike) : m
}
