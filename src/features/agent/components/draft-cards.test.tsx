import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AiDraftCard } from './ai-draft-card'
import { ChangeDraftCard } from './change-draft-card'

const verdict = {
  isValid: false,
  score: 2.6,
  scoreMax: 5,
  detail: '本餐 2.6 分，未达 3.0 分有效线',
  offline: false,
  checks: [{ text: '优质蛋白 ≥ 15g', ok: false }],
  advice: [],
}

describe('草稿卡上的裁判结论（服务端渲染）', () => {
  it('AiDraftCard 带 verdict 时渲染结论条', () => {
    const html = renderToStaticMarkup(
      <AiDraftCard module="diet" title="好好吃饭" confidence={0.8} verdict={verdict} />,
    )
    expect(html).toContain('未达标 · 只存档')
    expect(html).toContain('2.6 / 5')
    expect(html).toContain('优质蛋白 ≥ 15g')
  })

  it('改过条目后结论条换成提示', () => {
    const html = renderToStaticMarkup(
      <AiDraftCard
        module="diet"
        title="好好吃饭"
        confidence={0.8}
        verdict={verdict}
        verdictStale
      />,
    )
    expect(html).not.toContain('只存档')
    expect(html).toContain('确认后按新内容重新判定是否达标')
  })

  it('删除草稿用危险色按钮，写明留痕会保留', () => {
    const html = renderToStaticMarkup(
      <ChangeDraftCard
        mode="delete"
        module="exercise"
        title="动一动"
        dateLabel="昨天 11月4日"
        reason="重复记了"
        before={{ summary: '慢跑 30 分钟', note: null, isValid: true, score: null }}
      />,
    )
    expect(html).toContain('确认删除')
    expect(html).toContain('留痕会保留')
    expect(html).toContain('原因：重复记了')
  })
})
