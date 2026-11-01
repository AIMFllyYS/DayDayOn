import type { AiPurpose, AiRunStatus } from './schemas'

/*
 * 额度展示文案（纯函数，带单测）。金额计算一律用整数微元，这里只做展示换算。
 */

export const PURPOSE_LABEL: Record<AiPurpose, string> = {
  'diet-recognition': '拍照识别饮食',
}

export const RUN_STATUS_LABEL: Record<AiRunStatus, string> = {
  running: '进行中',
  succeeded: '成功',
  failed: '失败',
  'invalid-output': '没看清',
  timeout: '超时',
}

/** 单次花费：不足 1 分时显示到 4 位小数（识别一次约 0.007 元） */
export function formatRunCost(micros: number): string {
  const yuan = micros / 1_000_000
  if (micros === 0) return '¥0'
  if (micros < 10_000) return `¥${yuan.toFixed(4)}`
  return `¥${yuan.toFixed(2)}`
}
