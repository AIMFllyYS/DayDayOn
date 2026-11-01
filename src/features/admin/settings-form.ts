import type { AppSettingKey, AppSettings, AppSettingsPatch } from '@/server/settings-schema'
import { microsToYuan, yuanToMicros } from './money'

/*
 * 全站设置表单的字段定义与换算（PRD 7.3）。金额项在界面上用元，提交前换回微元；其余是整数次数。
 * aiPaused 不在表单里：由首页的暂停 / 恢复按钮负责。纯函数，有单测。
 */

export type EditableKey = Exclude<AppSettingKey, 'aiPaused'>

export interface SettingField {
  key: EditableKey
  label: string
  hint: string
  unit: string
  money: boolean
}

export const SETTING_GROUPS: { title: string; fields: SettingField[] }[] = [
  {
    title: 'AI 花费与额度',
    fields: [
      {
        key: 'dailySpendCapMicros',
        label: '全站每日花费上限',
        hint: '北京时间每天 00:00 清零；调高后当天立即生效',
        unit: '元',
        money: true,
      },
      {
        key: 'weeklyQuotaMicros',
        label: '每周额度',
        hint: '每周一 00:00 重置，不累积',
        unit: '元',
        money: true,
      },
      {
        key: 'newUserQuotaMicros',
        label: '新账号首周额度',
        hint: '完成引导后补到每周额度',
        unit: '元',
        money: true,
      },
    ],
  },
  {
    title: 'AI 调用限流',
    fields: [
      {
        key: 'aiHourlyLimit',
        label: '每人每小时调用次数',
        hint: '超过返回"太频繁了"',
        unit: '次',
        money: false,
      },
      {
        key: 'aiConcurrency',
        label: '每人同时进行中的调用',
        hint: '一般 1–2 个就够',
        unit: '个',
        money: false,
      },
    ],
  },
  {
    title: '注册、登录与兑换',
    fields: [
      {
        key: 'signupPerIpDaily',
        label: '同一 IP 每天新注册',
        hint: '超过后当天不能再注册',
        unit: '个',
        money: false,
      },
      {
        key: 'otpPerEmailDaily',
        label: '同一邮箱每天验证码',
        hint: '同 IP 每小时 5 次是固定的，不在这里',
        unit: '次',
        money: false,
      },
      {
        key: 'otpPerIpDaily',
        label: '同一 IP 每天验证码',
        hint: '',
        unit: '次',
        money: false,
      },
      {
        key: 'redeemFailLockThreshold',
        label: '兑换失败锁定次数',
        hint: '失败这么多次后锁 1 小时，后台同时标为异常',
        unit: '次',
        money: false,
      },
    ],
  },
]

export const SETTING_FIELDS: SettingField[] = SETTING_GROUPS.flatMap((g) => g.fields)

/** 表单里的值：金额项是元，其余原样；清空时为 null */
export type SettingsDraft = Record<EditableKey, number | null>

export function toDraft(settings: AppSettings): SettingsDraft {
  const draft = {} as SettingsDraft
  for (const f of SETTING_FIELDS) {
    draft[f.key] = f.money ? microsToYuan(settings[f.key]) : settings[f.key]
  }
  return draft
}

/**
 * 表单值 → 只含改动项的补丁（金额换成微元）。清空的项保留 NaN，交给 zod 报"必填"类错误。
 * 没有改动返回空对象。
 */
export function diffPatch(settings: AppSettings, draft: SettingsDraft): AppSettingsPatch {
  const patch: Record<string, number> = {}
  for (const f of SETTING_FIELDS) {
    const raw = draft[f.key]
    const value = raw === null ? Number.NaN : f.money ? (yuanToMicros(raw) ?? Number.NaN) : raw
    if (!Object.is(value, settings[f.key])) patch[f.key] = value
  }
  return patch as AppSettingsPatch
}
