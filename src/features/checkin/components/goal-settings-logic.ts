import type { Goal } from '@/features/goal/schemas'
import type { RemindMode } from '@/features/me/schemas'
import { MODULES, type Module } from '@/features/shared/schemas'

/*
 * 目标设置页与统一设置 Dock 的纯逻辑辅助函数（带单测）。
 */

export interface ModuleSelectionDiff {
  /** 需要归档的进行中目标 */
  toArchive: Goal[]
  /** 需要从归档恢复的旧目标（每个新勾选的板块最多恢复最新一条） */
  toRestore: Goal[]
  /** 既不在进行中、也没有归档旧记录，需要新建默认目标的板块 */
  toCreate: Module[]
  /** 当前进行中目标共享的截止日期（新建板块时自动对齐总周期） */
  sharedDeadline: string | null
  hasChanges: boolean
}

/**
 * 计算「打卡设置」勾选变更差异：
 * - 取消勾选某板块 → 归档该板块全部进行中目标；
 * - 新增勾选某板块 → 若有归档旧目标则恢复最近更新的一条，否则新建默认目标并沿用共享截止日期。
 */
export function computeModuleSelectionDiff(
  active: readonly Goal[],
  archived: readonly Goal[],
  selectedModules: readonly Module[],
): ModuleSelectionDiff {
  const activeModuleSet = new Set(active.map((g) => g.module))
  const wantSet = new Set(selectedModules)
  const sharedDeadline = active.find((g) => g.deadlineDate)?.deadlineDate ?? null

  const toArchive = active.filter((g) => !wantSet.has(g.module))
  const toRestore: Goal[] = []
  const toCreate: Module[] = []

  for (const mod of MODULES) {
    if (!wantSet.has(mod) || activeModuleSet.has(mod)) continue
    const candidates = archived
      .filter((g) => g.module === mod)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    if (candidates[0]) {
      toRestore.push(candidates[0])
    } else {
      toCreate.push(mod)
    }
  }

  return {
    toArchive,
    toRestore,
    toCreate,
    sharedDeadline,
    hasChanges: toArchive.length > 0 || toRestore.length > 0 || toCreate.length > 0,
  }
}

export function periodDockSummary(params: {
  hasDeadline: boolean
  targetDays: number
  remindMode: RemindMode
  remindAt: string | null
}): string {
  const periodPart = params.hasDeadline
    ? `共 ${params.targetDays} 天`
    : `里程碑 ${params.targetDays} 天`
  const remindPart = params.remindMode !== 'off' && params.remindAt ? params.remindAt : '未开提醒'
  return `${periodPart} · ${remindPart}`
}

export function modulesDockSummary(active: readonly Goal[]): string {
  const activeCount = new Set(active.map((g) => g.module)).size
  return `已选 ${activeCount} / ${MODULES.length} 项`
}
