import 'server-only'
import { env } from '@/server/env'

/*
 * DeepSeek 官方联网搜索 / 读网页（ai-and-quota.md 第 9 节，2026-11-02 由 ADR-0024 从"暂不做"改为启用）。
 * 端点与字段以 api-docs.deepseek.com 为准：
 *   POST /v1/tools/search  { query, count?, need_content? } → { results: [{ title, url, snippet, summary, site_name, date, authority }] }
 *   POST /v1/tools/fetch   { url } → { title, content(markdown) }
 * 按成功请求计费（约 5000 微元/次），计入额度账本（由调用方 run-agent 结算）。
 * 只在这里读 env.DEEPSEEK_API_KEY 并直接 fetch DeepSeek；不经过 Vercel AI Gateway。
 */

const BASE_URL = 'https://api.deepseek.com'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  summary: string
  siteName: string | null
  date: string | null
  authority: number
}

export interface FetchedPage {
  title: string
  content: string
}

function apiKey(): string {
  if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY 未配置')
  return env.DEEPSEEK_API_KEY
}

interface ApiErrorBody {
  error?: { message?: string; code?: string }
}

async function post(path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // 空响应体：保持 null
  }
  return { status: res.status, json }
}

function detail(json: unknown): string {
  const e = (json as ApiErrorBody | null)?.error
  return e?.message ?? e?.code ?? `HTTP ${'unknown'}`
}

/** 搜索：返回精简结果（summary 是给模型看的字段）。失败返回空数组并带原因 */
export async function searchWeb(
  query: string,
  count = 5,
): Promise<{ ok: true; results: SearchResult[] } | { ok: false; reason: string }> {
  const { status, json } = await post('/v1/tools/search', {
    query: query.slice(0, 128),
    count: Math.min(Math.max(count, 1), 10),
    need_content: false,
  })
  if (status !== 200) return { ok: false, reason: detail(json) }
  const results = ((json as { results?: unknown[] }).results ?? []).map((r) => {
    const o = r as Record<string, unknown>
    return {
      title: String(o.title ?? ''),
      url: String(o.url ?? ''),
      snippet: String(o.snippet ?? ''),
      summary: String(o.summary ?? ''),
      siteName: typeof o.site_name === 'string' ? o.site_name : null,
      date: typeof o.date === 'string' ? o.date : null,
      authority: typeof o.authority === 'number' ? o.authority : -1,
    }
  })
  return { ok: true, results }
}

/** 读网页：返回 Markdown，限制长度避免撑爆上下文。失败返回原因 */
export async function fetchWeb(
  url: string,
): Promise<{ ok: true; page: FetchedPage } | { ok: false; reason: string }> {
  const { status, json } = await post('/v1/tools/fetch', { url: url.slice(0, 8192) })
  if (status !== 200) return { ok: false, reason: detail(json) }
  const o = json as { title?: unknown; content?: unknown }
  const content = String(o.content ?? '')
  return {
    ok: true,
    page: {
      title: String(o.title ?? ''),
      // 每页最多 8000 字，超出截断（模型不需要整页）
      content: content.length > 8000 ? `${content.slice(0, 8000)}\n…（内容过长已截断）` : content,
    },
  }
}
