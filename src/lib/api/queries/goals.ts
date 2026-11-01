import type {
  CreateGoalInput,
  Goal,
  GoalDetail,
  GoalList,
  GoalStatus,
  UpdateGoal,
} from '@/features/goal/schemas'
import { apiFetch } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'
import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

/*
 * 目标领域的查询与写操作（client-data-and-forms.md 第 2、3、5 节）。
 * 组件只从这里拿 queryOptions 和 mutation hook，不直接请求 /api/v1。
 */

export function goalListQuery(status: GoalStatus) {
  return queryOptions({
    queryKey: keys.goals.list(status),
    queryFn: () => apiFetch<GoalList>(`/goals?status=${status}`),
  })
}

export function goalDetailQuery(goalId: string) {
  return queryOptions({
    queryKey: keys.goals.detail(goalId),
    queryFn: () => apiFetch<GoalDetail>(`/goals/${encodeURIComponent(goalId)}`),
  })
}

/** 目标变了：目标列表 / 详情，以及依赖目标的打卡弹层、主页、排行都要刷新 */
function invalidateAfterGoalChange(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: keys.goals.all })
  for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
}

export interface CreateGoalVars {
  input: CreateGoalInput
  /** 每次用户点击生成一个，重试时复用（api-conventions.md 第 9 节） */
  idempotencyKey: string
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: CreateGoalVars) =>
      apiFetch<Goal>('/goals', { method: 'POST', json: input, idempotencyKey }),
    onSuccess: () => invalidateAfterGoalChange(qc),
  })
}

export function useUpdateGoal(goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateGoal) =>
      apiFetch<Goal>(`/goals/${encodeURIComponent(goalId)}`, { method: 'PATCH', json: patch }),
    onSuccess: () => invalidateAfterGoalChange(qc),
  })
}

export function useDeleteGoal(goalId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>(`/goals/${encodeURIComponent(goalId)}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 详情已经不存在了：先移除，避免返回列表前又去请求一次 404
      qc.removeQueries({ queryKey: keys.goals.detail(goalId) })
      invalidateAfterGoalChange(qc)
    },
  })
}
