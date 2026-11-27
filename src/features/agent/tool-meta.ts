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
  getTodoOverview: { label: '读取待办概览', verb: '正在看待办结构', icon: 'todo', tone: 'neutral' },
  listTodos: { label: '筛选待办', verb: '正在翻待办列表', icon: 'todo', tone: 'neutral' },
  getTodoDetail: { label: '读取待办详情', verb: '正在看待办备注', icon: 'todo', tone: 'neutral' },
  getTodoTimeline: {
    label: '查看待办过程',
    verb: '正在翻待办历程',
    icon: 'clock',
    tone: 'neutral',
  },
  listCheckins: { label: '读取打卡', verb: '正在看打卡', icon: 'calendar', tone: 'study' },
  getWeight: { label: '读取体重', verb: '正在看体重', icon: 'chart', tone: 'primary' },
  showStats: { label: '整理近况图表', verb: '正在算各板块近况', icon: 'chart', tone: 'primary' },
  listFriends: { label: '读取好友列表', verb: '正在看好友列表', icon: 'user', tone: 'primary' },
  getFriendStatus: {
    label: '查看好友打卡',
    verb: '正在看好友打卡情况',
    icon: 'trophy',
    tone: 'primary',
  },
  getFriendMetrics: {
    label: '查看好友指标',
    verb: '正在看好友体重/心情/步数',
    icon: 'chart',
    tone: 'primary',
  },
  draftCheckin: { label: '整理打卡草稿', verb: '正在整理打卡', icon: 'check', tone: 'primary' },
  draftUpdateCheckin: {
    label: '整理改打卡草稿',
    verb: '正在整理要改的打卡',
    icon: 'edit',
    tone: 'primary',
  },
  draftDeleteCheckin: {
    label: '整理删打卡草稿',
    verb: '正在整理要删的打卡',
    icon: 'trash',
    tone: 'danger',
  },
  getCheckin: { label: '读取一条打卡', verb: '正在看这条打卡', icon: 'calendar', tone: 'study' },
  getCheckinHistory: {
    label: '查看打卡留痕',
    verb: '正在翻改动记录',
    icon: 'clock',
    tone: 'neutral',
  },
  draftTodo: { label: '整理待办草稿', verb: '正在整理待办', icon: 'todo', tone: 'neutral' },
  draftUpdateTodo: {
    label: '整理改待办草稿',
    verb: '正在整理待办变更',
    icon: 'edit',
    tone: 'primary',
  },
  draftDeleteTodo: {
    label: '整理删待办草稿',
    verb: '正在整理要删的待办',
    icon: 'trash',
    tone: 'danger',
  },
  draftTodoGroup: {
    label: '整理待办分组草稿',
    verb: '正在整理待办分组',
    icon: 'folder',
    tone: 'study',
  },
  getMetrics: {
    label: '读取每日指标',
    verb: '正在看体重/心情/步数',
    icon: 'chart',
    tone: 'primary',
  },
  draftMetric: { label: '整理指标草稿', verb: '正在整理每日指标', icon: 'edit', tone: 'primary' },
  draftDeleteMetric: {
    label: '整理删指标草稿',
    verb: '正在整理要删的指标',
    icon: 'trash',
    tone: 'danger',
  },
  draftWeight: { label: '整理体重草稿', verb: '正在整理体重', icon: 'chart', tone: 'primary' },
  // 打卡裁判（server/ai/referee/tools.ts）
  lookupFoodNutrition: {
    label: '查食物营养表',
    verb: '正在查每道菜的营养',
    icon: 'diet',
    tone: 'diet',
  },
  getRecentSleep: { label: '读近期睡眠', verb: '正在看最近几晚', icon: 'sleep', tone: 'sleep' },
  getTodayStudy: { label: '读今日学习', verb: '正在累加今天的学习', icon: 'study', tone: 'study' },
  submitVerdict: {
    label: '提交裁判事实',
    verb: '正在按规则出结论',
    icon: 'shield',
    tone: 'success',
  },
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
