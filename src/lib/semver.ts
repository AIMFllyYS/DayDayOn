/*
 * 版本号比较（SemVer 2.0.0 的主版本.次版本.修订号三段；预发布 / 构建元数据部分忽略）。
 * 前后端通用的纯函数，检查更新用（download/README.md）。
 */

export type Version = readonly [major: number, minor: number, patch: number]

/** 'v0.1.2' / '0.1.2' / '0.1.2-beta+3' → [0, 1, 2]；不是合法版本号返回 null */
export function parseVersion(text: string | null | undefined): Version | null {
  if (!text) return null
  const m = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:[-+].*)?$/.exec(text.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** a < b 返回负数，相等 0，a > b 正数；无法解析的版本当作最低 */
export function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const va = parseVersion(a) ?? [-1, -1, -1]
  const vb = parseVersion(b) ?? [-1, -1, -1]
  for (let i = 0; i < 3; i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function isNewer(candidate: string, current: string | null | undefined): boolean {
  return parseVersion(candidate) !== null && compareVersions(candidate, current) > 0
}
