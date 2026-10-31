// 生成组件库对比页（demo-init Phase 3）。
// 用法：node scripts/dev/library-showcase/build.mjs [--adr]
//   默认：读取 docs/designs/library-showcase/data.json 与 concerns-*.mjs，生成 index.html 和每个关注点的对比页
//   --adr：同时为每个关注点生成 ADR 草稿（docs/adr/NNNN-<slug>.md），已存在的 ADR 不覆盖（ADR 只增不改）
// 页面里关于库的每一项数据都来自 data.json（本次调研的 registry / GitHub / 实测记录），不在本脚本里手写数字。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { frontend } from './concerns-frontend.mjs'
import { platform } from './concerns-platform.mjs'

const root = new URL('../../../', import.meta.url)
const outDir = new URL('docs/designs/library-showcase/', root)
const data = JSON.parse(readFileSync(new URL('data.json', outDir), 'utf8'))
const concerns = [...frontend, ...platform]
const writeAdr = process.argv.includes('--adr')
const AS_OF = Date.parse(`${data.collectedAt}T00:00:00Z`)
const YEAR = 365 * 864e5

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
const day = (iso) => (iso ? iso.slice(0, 10) : '未核实')
const measuredCase = (name) => data.measured.find((m) => m.case === name)?.gzipKB ?? null
const side = (c) => (c.no >= 11 ? 'server' : 'client')

function sizeOf(cand) {
  const s = cand.size
  if (!s) return null
  if (s.case) return { kb: measuredCase(s.case), label: '实测' }
  if (s.detail) return { kb: data.measuredDetail[s.detail] ?? null, label: '实测' }
  if (s.bundlephobia)
    return {
      kb: data.packages[cand.pkg]?.bundlephobiaGzipKB ?? null,
      label: '整包（bundlephobia）',
    }
  return null
}

function sizeExtra(cand) {
  const out = []
  for (const [label, key, kind] of cand.size?.also ?? []) {
    const v = kind === 'detail' ? data.measuredDetail[key] : measuredCase(key)
    if (v != null) out.push(`${label} ${v} KB`)
  }
  if (cand.size?.note) out.push(cand.size.note)
  return out
}

function metrics(cand, concern) {
  const p = data.packages[cand.pkg]
  if (!p) return null
  const rows = []
  const pub = p.publishedLatest ? Date.parse(p.publishedLatest) : null
  const stale = pub && AS_OF - pub > YEAR
  rows.push([
    '最近发布',
    `${p.version}（${day(p.publishedLatest)}；12 个月内 ${p.releasesLast12m ?? '?'} 次）`,
    stale ? '超过 12 个月未发布' : null,
  ])
  const gh = p.github
  const ghText = gh
    ? `GitHub ★${gh.stars?.toLocaleString('en-US')}，最近提交 ${day(gh.pushedAt)}${gh.archived ? '，已归档' : ''}`
    : 'GitHub 未核实'
  rows.push([
    '维护',
    `npm 维护者账号 ${p.maintainers ?? '?'} 个；${ghText}`,
    p.maintainers === 1 ? '单个 npm 账号发布（bus factor）' : null,
  ])
  const sz = sizeOf(cand)
  const deps = `直接依赖 ${p.directDeps ?? '?'} 个，传递依赖 ${p.transitiveDeps ?? '未扫描'} 个`
  if (side(concern) === 'server') {
    const mb = p.unpackedSize ? `${(p.unpackedSize / 1048576).toFixed(1)} MB` : '未核实'
    rows.push(['体积', `服务端运行，不进客户端包（npm 解包 ${mb}）；${deps}`, null])
  } else {
    rows.push([
      '体积',
      `${sz?.kb != null ? `${sz.label} ${sz.kb} KB（min+gzip）` : '未实测'}；${deps}`,
      null,
    ])
  }
  const scripts = p.installScripts
  rows.push([
    '安装脚本',
    scripts == null
      ? '未扫描'
      : scripts.length
        ? scripts.join('；')
        : '包本身与传递依赖都没有 preinstall / install / postinstall',
    scripts?.length ? '有安装脚本' : null,
  ])
  const cl = p.copyleft
  rows.push([
    '许可证',
    `${p.license ?? '未核实'}；${cl == null ? '依赖树未扫描' : cl.length ? `依赖树含 copyleft：${cl.join('、')}` : '依赖树无 copyleft'}`,
    cl?.length ? 'copyleft' : null,
  ])
  const peers = Object.entries(p.peerDependencies ?? {}).filter(([k]) =>
    /^(react|react-dom|next|zod|drizzle-orm|pg|vite|hono|typescript)$/.test(k),
  )
  rows.push([
    '兼容性',
    peers.length ? `peer：${peers.map(([k, v]) => `${k} ${v}`).join('；')}` : '无相关 peer 依赖',
    null,
  ])
  rows.push([
    '类型',
    p.shipsTypes ? '包内自带类型声明' : '未发现类型声明',
    p.shipsTypes ? null : '无类型',
  ])
  return rows
}

const VERDICT = { pick: '推荐', alt: '备选', no: '不采用' }

const css = `
:root{--paper:#f5f1ea;--card:#fbf9f5;--ink:#2b2925;--muted:#6f685e;--rule:#e2dacd;--accent:#d97757}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.75 -apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",system-ui,sans-serif}
main{max-width:880px;margin:0 auto;padding:56px 24px 96px}
h1,h2,h3{font-family:"Iowan Old Style","Source Han Serif SC","Noto Serif SC","Songti SC",Georgia,serif;font-weight:600;line-height:1.3;letter-spacing:.01em}
h1{font-size:34px;margin:0 0 8px}h2{font-size:22px;margin:56px 0 12px}h3{font-size:19px;margin:0}
p{margin:8px 0}a{color:inherit;text-decoration-color:var(--rule);text-underline-offset:3px}a:hover{text-decoration-color:var(--ink)}
.eyebrow{color:var(--muted);font-size:13px;letter-spacing:.08em}
.lede{color:var(--muted);font-size:17px}
ul{padding-left:1.2em;margin:8px 0}li{margin:2px 0}
.card{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:24px;margin:16px 0}
.card header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.tag{font-size:12px;border:1px solid var(--rule);border-radius:4px;padding:1px 8px;color:var(--muted)}
.tag.pick{border-color:var(--accent);color:var(--accent)}
.pkg{font:13px ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:7px 10px 7px 0;border-top:1px solid var(--rule)}
th{width:84px;color:var(--muted);font-weight:500;white-space:nowrap}
.flag{color:var(--muted);font-size:12px;margin-left:6px;border-bottom:1px dotted var(--muted)}
pre{background:#f0ebe2;border-radius:6px;padding:14px 16px;overflow:auto;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}
code{font:0.9em ui-monospace,SFMono-Regular,Consolas,monospace;background:#efe9df;border-radius:3px;padding:0 4px}
.fit{border-left:2px solid var(--rule);padding-left:12px;margin-top:12px}
.warn li{color:var(--muted)}
.bars{margin:16px 0 8px}
.bar{display:grid;grid-template-columns:220px 1fr 72px;gap:12px;align-items:center;font-size:14px;margin:6px 0}
.bar .track{display:block;height:8px;background:#ebe4d8;border-radius:4px;overflow:hidden}
.bar .fill{display:block;height:100%;background:#b9ad9c}
.bar.pick .fill{background:var(--accent)}
.bar .v{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.decision{border-top:1px solid var(--ink);padding-top:8px}
.history li{list-style:none;margin-left:-1.2em;padding:4px 0;border-top:1px solid var(--rule)}
.history time{color:var(--muted);font-size:13px;margin-right:10px}
.src{font-size:13px;color:var(--muted)}
.overview td:first-child{white-space:nowrap;color:var(--muted)}
@media (max-width:640px){main{padding:32px 16px 72px}h1{font-size:28px}.bar{grid-template-columns:1fr 64px}.bar .track{grid-column:1/-1;order:3}}
`

const page = (title, body) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} · DayDayOn 组件库对齐</title><style>${css}</style></head>
<body><main>${body}</main></body></html>
`

function bars(c) {
  const items = c.candidates
    .map((x) => {
      if (x.sizeNote && /^0 /.test(x.sizeNote))
        return { name: x.name, kb: 0, pick: x.verdict === 'pick' }
      const s = sizeOf(x)
      return s?.kb != null ? { name: x.name, kb: s.kb, pick: x.verdict === 'pick' } : null
    })
    .filter(Boolean)
  if (items.length < 2) return ''
  const max = Math.max(...items.map((i) => i.kb), 1)
  return `<div class="bars" aria-label="客户端体积对比（min+gzip）">${items
    .map(
      (i) =>
        `<div class="bar${i.pick ? ' pick' : ''}"><span>${esc(i.name)}</span><span class="track"><span class="fill" style="width:${Math.max(1, (i.kb / max) * 100).toFixed(1)}%"></span></span><span class="v">${i.kb} KB</span></div>`,
    )
    .join(
      '',
    )}</div>${c.barsNote ? `<p class="src">${inline(c.barsNote)}</p>` : ''}<p class="src">体积按本项目会用到的导出组合实测（esbuild minify，react 外置，gzip -9）；用例之间共享代码，相加会高估。方法见 data.json 的 method 字段。</p>`
}

function candidateCard(x, c) {
  const p = x.pkg ? data.packages[x.pkg] : null
  const rows = x.pkg && x.kind !== 'variant' ? metrics(x, c) : null
  const extra = sizeExtra(x)
  return `<section class="card"><header><h3>${esc(x.name)}</h3><span class="tag ${x.verdict}">${VERDICT[x.verdict]}</span>${x.pkg ? `<span class="pkg">${esc(x.pkg)}</span>` : ''}</header>
${p?.description && !/\]\(|<|!\[/.test(p.description) ? `<p class="src">npm 描述："${esc(p.description)}"</p>` : ''}
${x.sizeNote ? `<p class="src">${esc(x.sizeNote)}</p>` : ''}
${x.caps?.length ? `<ul>${x.caps.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : ''}
${rows ? `<table>${rows.map(([k, v, f]) => `<tr><th>${k}</th><td>${inline(v)}${f ? `<span class="flag">${esc(f)}</span>` : ''}</td></tr>`).join('')}${extra.length ? `<tr><th>补充</th><td>${esc(extra.join('；'))}</td></tr>` : ''}</table>` : ''}
${x.warn?.length ? `<ul class="warn">${x.warn.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : ''}
${x.code ? `<pre><code>${esc(x.code.text)}</code></pre><p class="src">示例来源：<a href="${esc(x.code.src)}">${esc(x.code.src)}</a>（为节省篇幅有删减）</p>` : ''}
<p class="fit"><strong>适合我们吗：</strong>${inline(x.fit)}</p></section>`
}

function concernPage(c) {
  const d = c.decision
  const body = `<p class="eyebrow">关注点 ${c.no} · ${esc(c.group)} · ADR-${c.adr}</p>
<h1>${esc(c.title)}</h1>
<p class="lede">${inline(c.layer)}</p>
<h2>我们需要什么</h2><ul>${c.needs.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>
${c.facts ? `<h2>本次核实的关键事实</h2><ul>${c.facts.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : ''}
<h2>候选</h2>${bars(c)}
${c.candidates.map((x) => candidateCard(x, c)).join('\n')}
${c.driver ? `<h2>数据库驱动</h2><ul>${c.driver.map(([a, b]) => `<li><strong>${esc(a)}</strong>：${inline(b)}</li>`).join('')}</ul>` : ''}
<h2>决定</h2><div class="decision">
<p><strong>所有者：</strong>${inline(d.owner)}${d.version && d.version !== '—' ? `，版本 ${esc(d.version)}` : ''}</p>
<p><strong>封装层入口：</strong>${inline(d.wrapper)}</p>
<ul>${d.rules.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>
<p><strong>放弃了什么：</strong></p><ul>${d.rejected.map(([a, b]) => `<li>${esc(a)}：${inline(b)}</li>`).join('')}</ul>
<p><strong>已知代价：</strong>${inline(d.cost)}</p>
<p><strong>何时重审：</strong></p><ul>${d.review.map((t) => `<li>${inline(t)}</li>`).join('')}</ul></div>
<h2>决策历史</h2><ul class="history">
<li><time>2026-10-31</time>负责人确认功能盘点（头像用预设方案），委托 AI 系统性分析各关注点的选型。</li>
<li><time>2026-10-31</time>AI 完成联网调研与本地实测，给出建议（ADR-${c.adr} 为 Proposed）。</li>
<li><time>2026-10-31</time>负责人拍板：17 项建议全部采纳，按 AI 的最终分析执行。<strong>状态：已定</strong>（ADR-${c.adr} 为 Accepted）。落地规则见 <a href="../../conventions/README.md">docs/conventions/</a>。</li>
</ul>
<h2>来源</h2><ul class="src">${c.sources.map(([l, u]) => `<li><a href="${esc(u)}">${esc(l)}</a>（抓取于 ${data.collectedAt}）</li>`).join('')}
<li>npm registry、GitHub、体积与依赖树扫描：<a href="./data.json">data.json</a>（采集于 ${data.collectedAt}）</li></ul>
<p class="src"><a href="./index.html">← 返回总览</a></p>`
  return page(c.title, body)
}

function indexPage() {
  const rows = concerns
    .map(
      (c) =>
        `<tr><td>${c.no}</td><td><a href="./${String(c.no).padStart(2, '0')}-${c.slug}.html">${esc(c.title)}</a></td><td>${inline(c.decision.owner)}</td><td>ADR-${c.adr}</td></tr>`,
    )
    .join('')
  const body = `<p class="eyebrow">demo-init Phase 3 · 组件库对齐 · ${data.collectedAt}</p>
<h1>DayDayOn 组件库选型总览</h1>
<p class="lede">17 个关注点，每个只有一个所有者。原则：能用浏览器和已有依赖解决的不加库；要加库就只加一个、并经封装层使用。2026-10-31 负责人全部采纳，下表即最终结论。</p>
<h2>决定一览</h2>
<table class="overview"><tr><th>#</th><th>关注点</th><th>所有者</th><th>决策记录</th></tr>${rows}</table>
<h2>需要新增的依赖</h2>
<p>前端（进客户端包）：<code>@base-ui/react</code>、<code>react-day-picker</code>、<code>date-fns</code>、<code>@date-fns/tz</code>、<code>d3-shape</code>、<code>@tanstack/react-query</code>、<code>zod</code>。</p>
<p>服务端：<code>better-auth</code>、<code>drizzle-orm</code>、<code>pg</code>、<code>hono</code>、<code>@hono/zod-openapi</code>、<code>nodemailer</code>，以及已由负责人指定的 <code>ai</code>、<code>@ai-sdk/deepseek</code>、<code>@ai-sdk/react</code>。</p>
<p>开发：<code>drizzle-kit</code>、<code>vitest</code>、<code>vite</code>、<code>@types/pg</code>（Nodemailer 10 自带类型，不装 <code>@types/nodemailer</code>）。</p>
<p>明确不引入：动效库、表单库、图表库、图片压缩库、Service Worker 工具库、任务队列、tailwind-merge。</p>
<h2>已由负责人指定的所有者</h2>
<ul><li>AI：Vercel AI SDK（<code>ai</code> ${esc(data.packages.ai?.version)}、<code>@ai-sdk/deepseek</code> ${esc(data.packages['@ai-sdk/deepseek']?.version)}、<code>@ai-sdk/react</code> ${esc(data.packages['@ai-sdk/react']?.version)}），模型只用 <code>deepseek-flash</code>。AI SDK 文档说明：直接写字符串模型 id 时默认走 Vercel AI Gateway，所以必须用 <code>deepSeek('deepseek-flash')</code> 这种 provider 实例，不能写字符串。</li>
<li>图标、吉祥物：自研（ui-design-system.md 第 6、9 节）。</li></ul>
<h2>方法</h2><ul class="src">${Object.entries(data.method)
    .map(([k, v]) => `<li><strong>${esc(k)}</strong>：${esc(v)}</li>`)
    .join('')}</ul>`
  return page('总览', body)
}

function adrDraft(c) {
  const d = c.decision
  const pick = c.candidates.find((x) => x.verdict === 'pick')
  const opts = c.candidates
    .map(
      (x) => `- **${x.name}**${x.pkg ? `（\`${x.pkg}\`）` : ''}：${VERDICT[x.verdict]}。${x.fit}`,
    )
    .join('\n')
  return `# ADR-${c.adr}：${c.title}——${d.owner}

- 状态：Proposed <!-- 负责人拍板后改为 Accepted；被推翻时改为 Superseded by ADR-XXXX，正文不改 -->
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/${String(c.no).padStart(2, '0')}-${c.slug}.html](../designs/library-showcase/${String(c.no).padStart(2, '0')}-${c.slug}.html)

## 背景

${c.needs.map((t) => `- ${t}`).join('\n')}

先定的层：${c.layer}
${c.facts ? `\n本次核实的关键事实：\n\n${c.facts.map((t) => `- ${t}`).join('\n')}\n` : ''}
## 面临的选项

${opts}

## 决定

${d.owner}${d.version && d.version !== '—' ? `，版本 ${d.version}` : ''}。

- 封装层入口：${d.wrapper}
${d.rules.map((t) => `- ${t}`).join('\n')}

## 理由

${pick ? `${pick.fit}\n\n${(pick.caps ?? []).map((t) => `- ${t}`).join('\n')}` : ''}

## 放弃了什么

${d.rejected.map(([a, b]) => `- ${a}：${b}`).join('\n')}

已知代价：${d.cost}

## 何时重审

${d.review.map((t) => `- ${t}`).join('\n')}
`
}

mkdirSync(outDir, { recursive: true })
writeFileSync(new URL('index.html', outDir), indexPage())
for (const c of concerns)
  writeFileSync(new URL(`${String(c.no).padStart(2, '0')}-${c.slug}.html`, outDir), concernPage(c))
let adrs = 0
if (writeAdr) {
  for (const c of concerns) {
    const f = new URL(`docs/adr/${c.adr}-${c.slug}.md`, root)
    if (existsSync(f)) continue
    writeFileSync(f, adrDraft(c))
    adrs++
  }
}
console.log(`pages: ${concerns.length + 1}${writeAdr ? `, new ADR drafts: ${adrs}` : ''}`)
