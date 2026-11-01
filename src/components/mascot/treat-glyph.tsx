/*
 * 小零食插画：Playbook 的投喂演示和落地页的"拍一下"演示共用。
 * 能对应 token 的颜色都用 var(--…)；少量描边、海苔色是插画专用色（同 mascot-svg.tsx）。
 */

export const treats = [
  { id: 'onigiri', label: '饭团' },
  { id: 'strawberry', label: '草莓' },
  { id: 'cookie', label: '小饼干' },
] as const

export type TreatId = (typeof treats)[number]['id']

export function TreatGlyph({ id, size = 34 }: { id: TreatId; size?: number }) {
  if (id === 'onigiri') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <path
          d="M20 5c5 0 15 15 15 22 0 5-5 8-15 8S5 32 5 27C5 20 15 5 20 5Z"
          fill="var(--surface)"
          stroke="var(--border-strong)"
          strokeWidth="2"
        />
        <path d="M12 26h16v9H12z" fill="#4a5a52" />
      </svg>
    )
  }
  if (id === 'strawberry') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <path
          d="M20 12c8 0 13 4 13 9 0 8-8 15-13 15S7 29 7 21c0-5 5-9 13-9Z"
          fill="var(--custom)"
          stroke="#d97c97"
          strokeWidth="2"
        />
        <path d="M13 11c2-4 5-5 7-2 2-3 5-2 7 2-3 2-11 2-14 0Z" fill="var(--exercise)" />
        <g fill="var(--surface)">
          <circle cx="15" cy="21" r="1.2" />
          <circle cx="24" cy="19" r="1.2" />
          <circle cx="20" cy="27" r="1.2" />
          <circle cx="27" cy="26" r="1.2" />
        </g>
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="14" fill="var(--diet)" stroke="#d9a93a" strokeWidth="2" />
      <g fill="#8f5b2a">
        <circle cx="14" cy="16" r="2" />
        <circle cx="24" cy="14" r="1.6" />
        <circle cx="22" cy="24" r="2.2" />
        <circle cx="13" cy="25" r="1.4" />
      </g>
    </svg>
  )
}
