import type { IconName } from '@/components/ui/icon'
import type { Tone } from '@/components/ui/tone'

interface ToolMeta {
  /** 完成后的名称，例如"联网搜索" */
  label: string
  /** 进行中的说法，例如"正在搜索"，用在活动条上 */
  verb: string
  icon: IconName
  tone: Tone
}

/** 首批工具（架构基线 5.3）的中文名和图标。新增工具时在这里登记，否则显示为"工具调用" */
const toolMeta: Record<string, ToolMeta> = {
  getUserProfile: {
    label: '读取个人资料',
    verb: '正在读取你的资料',
    icon: 'user',
    tone: 'neutral',
  },
  lookupMet: { label: '查询运动强度', verb: '正在查运动强度', icon: 'exercise', tone: 'exercise' },
  calcExerciseKcal: {
    label: '计算运动消耗',
    verb: '正在算运动消耗',
    icon: 'flame',
    tone: 'exercise',
  },
  estimateFoodNutrition: {
    label: '估算食物营养',
    verb: '正在估算营养',
    icon: 'diet',
    tone: 'diet',
  },
  getDaySummary: {
    label: '汇总今日记录',
    verb: '正在看今天的记录',
    icon: 'calendar',
    tone: 'study',
  },
  // 饮食拍照识别（features/diet/components/diet-recognizer.tsx 在前端拼的本地 tool part）
  recognizeMeal: { label: '看照片认食物', verb: '正在看照片', icon: 'camera', tone: 'diet' },
  webSearch: { label: '联网搜索', verb: '正在搜索', icon: 'globe', tone: 'study' },
  webFetch: { label: '读取网页', verb: '正在读网页', icon: 'link', tone: 'study' },
  // Agent 对话（features/agent + server/ai/agent-tools.ts）
  listGoals: { label: '读取目标', verb: '正在看目标', icon: 'trophy', tone: 'primary' },
  listTodos: { label: '读取待办', verb: '正在看待办', icon: 'todo', tone: 'neutral' },
  listCheckins: { label: '读取打卡', verb: '正在看打卡', icon: 'calendar', tone: 'study' },
  getWeight: { label: '读取体重', verb: '正在看体重', icon: 'chart', tone: 'primary' },
  draftCheckin: { label: '整理打卡草稿', verb: '正在整理打卡', icon: 'check', tone: 'primary' },
  draftTodo: { label: '整理待办草稿', verb: '正在整理待办', icon: 'todo', tone: 'neutral' },
  draftWeight: { label: '整理体重草稿', verb: '正在整理体重', icon: 'chart', tone: 'primary' },
}

const fallback: ToolMeta = {
  label: '工具调用',
  verb: '正在调用工具',
  icon: 'bolt',
  tone: 'neutral',
}

export function getToolMeta(toolName: string): ToolMeta {
  return toolMeta[toolName] ?? fallback
}
