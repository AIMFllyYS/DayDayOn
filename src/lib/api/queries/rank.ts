import { queryOptions } from '@tanstack/react-query'
import type { Feed, RankBoard, RankRange } from '@/features/rank/schemas'
import { apiFetch } from '../fetcher'
import { keys } from '../keys'

/*
 * 排行榜与榜单动态的查询（client-data-and-forms.md 第 2、3 节）。只读。
 * 主页的动态已经包含在 /dashboard/today 里；rankFeedQuery 给单独展示动态的地方用。
 */

export function rankBoardQuery(range: RankRange) {
  return queryOptions({
    queryKey: keys.rank.board(range),
    queryFn: () => apiFetch<RankBoard>(`/rank?range=${range}`),
  })
}

export function rankFeedQuery() {
  return queryOptions({
    queryKey: keys.rank.feed(),
    queryFn: () => apiFetch<Feed>('/rank/feed'),
  })
}
