import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AiDraftCard } from './ai-draft-card'
import { ChangeDraftCard } from './change-draft-card'
import { TodoChangeDraftCard, TodoDraftCard, TodoGroupDraftCard } from './todo-draft-card'

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

  it('AiDraftCard 展示昨日补卡徽章与覆盖已有记录提醒', () => {
    const html = renderToStaticMarkup(
      <AiDraftCard
        module="sleep"
        title="早点睡"
        confidence={0.9}
        makeupLabel="昨日补卡 · 11月4日"
        overwriteWarning="昨天已记过记录（睡了 6小时30分），确认后将覆盖原记录"
        verdict={verdict}
      />,
    )
    expect(html).toContain('昨日补卡 · 11月4日')
    expect(html).toContain('确认后将覆盖原记录')
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

describe('待办草稿卡（服务端渲染）', () => {
  const snap = {
    title: '交高数作业',
    note: null,
    dueAt: '2026-11-24T14:00:00.000Z',
    priority: 'urgent-important' as const,
    groupName: '学习',
    tags: ['高数'],
    status: 'open' as const,
    abandonReason: null,
    isArchived: false,
  }

  it('TodoDraftCard 兼容旧优先级枚举、折叠长备注且不使用 font-display 撑爆窄屏', () => {
    const longNote =
      '第一行需要核对实验数据与误差分析，第二行补充附录表格并导出 PDF 提交教务系统，同时确认抓包截图分辨率清晰。'
    const html = renderToStaticMarkup(
      <TodoDraftCard
        title="提交超长标题实验报告与抓包分析文档"
        dueAt="2026-11-24T15:59:00.000Z"
        priority="important"
        groupName="课程作业"
        isNewGroup
        tags={['计网']}
        note={longNote}
      />,
    )
    expect(html).toContain('重要且紧急')
    expect(html).toContain('课程作业（将新建）')
    expect(html).toContain(`展开全文（${longNote.length} 字）`)
    expect(html).not.toContain('font-display')
  })

  it('TodoChangeDraftCard 区分恢复已归档与删除待办提示', () => {
    const reopenHtml = renderToStaticMarkup(
      <TodoChangeDraftCard
        mode="update"
        action="reopen"
        reason="重新开始推进"
        before={{ ...snap, status: 'done', isArchived: true }}
        after={{ ...snap, status: 'open', isArchived: false }}
        changes={[{ label: '状态', value: '已归档 → 进行中' }]}
      />,
    )
    expect(reopenHtml).toContain('确认恢复')
    expect(reopenHtml).toContain('已归档')
    expect(reopenHtml).toContain('从已归档恢复回进行中清单')

    const deleteHtml = renderToStaticMarkup(
      <TodoChangeDraftCard mode="delete" reason="重复创建" before={snap} />,
    )
    expect(deleteHtml).toContain('确认删除')
    expect(deleteHtml).toContain('过程时间轴会保留本次删除快照')
  })

  it('TodoGroupDraftCard 删除分组时展示迁回默认待办提示', () => {
    const html = renderToStaticMarkup(
      <TodoGroupDraftCard action="delete" name="旧项目" affectedTodoCount={4} reason="清理分组" />,
    )
    expect(html).toContain('确认删除分组')
    expect(html).toContain('4 条将自动迁回「默认待办」')
  })
})
