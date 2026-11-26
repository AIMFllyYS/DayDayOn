/*
 * 主页顶部治愈系鼓励语库与无重复洗牌器（Issue #102）。
 * - 文案语气遵循 ui-design-system.md 第 11 节：像陪伴你的老朋友，温柔具体、不说教，不用感叹号堆叠和 emoji；
 * - 含 90 条日常治愈语录 + 12 条今日达标庆祝语录，长短兼顾（短句静止呈现，长句在等高横条内平滑横滚）；
 * - 使用 Fisher-Yates 洗牌队列持久化到 localStorage，一轮内绝不重复，新轮首句也不与上轮末句撞车；
 * - 后台切回前台带 30 秒冷却，避免短切其他应用立刻打断阅读。
 */

export const QUOTE_STORAGE_KEY = 'daydayon:daily-quote:v1'
export const RETURN_COOLDOWN_MS = 30_000

export const DAILY_QUOTES: readonly string[] = [
  // 短句：打开就能一眼读完，轻盈不压迫
  '新的一天，从一小步开始',
  '慢慢来，你已经走在路上了',
  '今天也记得好好照顾自己',
  '能坚持做一件小事，本身就很了不起',
  '不必等完美状态，先开始就好',
  '今天的风很轻，按自己的节奏走吧',
  '照顾好作息和胃口，心情也会跟着稳下来',
  '你不需要一口气跑完，走稳今天这一程就够了',
  '哪怕只推进一点点，也比停在原地更靠近目标',
  '把注意力收回当下，做好眼前这件小事',
  '休息也是坚持的一部分，累了就先缓一口气',
  '每一个普通的日子，都值得被认真记下来',
  '今天的你，不需要和昨天的遗憾较劲',
  '保持微小的秩序，生活就会慢慢亮起来',
  '认真吃一顿饭，也是在好好爱自己',
  '早点关掉喧闹，把温柔留给今晚的睡眠',
  '花一点时间流汗，烦恼也会跟着变轻',
  '学进去的一页笔记，都会在以后悄悄帮到你',
  '不用催自己快一点，种子发芽也需要安静的时间',
  '允许自己偶尔慢半拍，只要明天还愿意继续',
  '今天想先从哪件容易的小事开始呢',
  '做完一件事就给自己点个头，你做得很好',
  '把大目标拆成今天能完成的几分钟，心里就踏实了',
  '喝一杯温水，伸个懒腰，再接着往前走',
  '那些看似不起眼的日复一日，正在悄悄改变你',
  '今天不追求满分，做到舒服且诚实就好',
  '生活不必时刻紧绷，松弛着也能走得很远',
  '你认真对待日常的样子，其实特别有力量',
  '窗外天气不管怎样，先把自己的小节奏稳住',
  '一次微小的完成，就能点亮一整天的底气',

  // 中长句：温柔具体，手机窄屏会自然缓缓滚动
  '不必把今天过成一场考试，哪怕只是按时吃饭、出门走走，也已经是很棒的一天了',
  '真正厉害的坚持不是咬牙硬撑，而是在疲惫的时候依然愿意轻轻迈出那一步',
  '别小看今天记下的每一笔微小记录，过一个月回头翻看时，你会很感谢现在的自己',
  '如果今天状态只有六十分，那就先安心把六十分做好，剩下的留给明天慢慢补齐',
  '很多让人安心的改变，都是从早睡半小时、多喝一杯温水、认真吃顿晚饭开始的',
  '生活有时候像拼图，今天只找到一小块也没关系，它依然稳稳地拼在属于你的画面里',
  '当你觉得节奏乱掉时，不用急着一口气追回来，挑一件最轻松的事重新接上就好',
  '运动不需要多么壮烈，出门吹吹风、散散步，让身体舒展开来就已经很治愈了',
  '认真学习的那二十几分钟，不只是为了某个结果，更是在给自己积攒沉静的力量',
  '晚上放下手机的那一刻，把白天的思绪轻轻合上，告诉自己明天再接着处理',
  '不用和别人的进度条比较，每个人的季节不同，你只需要照料好自己的那片小花园',
  '好习惯就像存钱罐，今天投进去的一枚小硬币，迟早会变成你手里的底气',
  '偶尔漏掉一天并不会抹去之前的所有努力，重新开始永远比懊恼更有用',
  '记得留一点空白给自己发呆、听歌或晒太阳，心有余地，坚持才不会变成负担',
  '今天也请多给自己一点耐心，像鼓励一位并肩前行的好朋友那样鼓励自己',
  '把注意力从「还有多少没做」换成「今天已经完成了什么」，你会发现自己其实很棒',
  '一顿干净热乎的饭菜，往往比任何大道理都更能让人迅速恢复元气',
  '哪怕今天风很大、事情很多，只要守住一两件日常小事，内心就不会轻易晃动',
  '坚持从来不是为了证明给谁看，而是为了让自己每天醒来时多一点踏实感',
  '睡前别把明天的烦恼提前搬上床，今夜的任务只有安心闭上眼睛好好休息',
  '每一次把拖延已久的小事划掉，都是在替未来的自己轻轻卸下一块小石头',
  '不用等心情变好才去行动，有时候先动起来十分钟，心情就会悄悄跟着好起来',
  '日复一日的规律看似平淡，却能在你迷茫的时候稳稳托住整个生活',
  '把目标调到踮踮脚就能碰到的高度，每天都带着一点轻松和成就感继续前进',
  '今天哪怕只专注了十五分钟，也比刷完两个小时手机后留下的空虚更让人安心',
  '身体比你想象中更诚实，给它干净的食物、适度的活动和充足的睡眠，它会好好回报你',
  '不要因为昨天晚睡了一点就彻底摆烂，今晚早睡半小时，节律立刻就能往回拉',
  '写下待办不是为了给自己施压，而是把脑子里的杂念清空，腾出地方好好生活',
  '朋友在远处也在各自努力打卡，想到有人和自己一起认真生活，步子就会轻快许多',
  '你走过的每一步都算数，哪怕那一步看起来只是很小的一点点',

  // 更多日常暖心句：覆盖清晨、午后、傍晚与低谷时刻
  '清晨的一口深呼吸，是今天送给自己的第一份礼物',
  '午后有点犯困时，起来活动五分钟再回来，效率会高很多',
  '傍晚收尾的时候，别忘了夸夸那个坚持到现在的自己',
  '天气转凉或转暖，都记得顺手照顾好自己的胃和睡眠',
  '心情一般也没关系，允许情绪像云一样飘过，不用急着赶走它',
  '把手机放远一点，专心做完手头这一小段，会收获久违的清爽感',
  '不需要每天都充满干劲，平平静静地把日常过好，本身就是高分',
  '今天吃得清爽一点，身体会用整个下午的轻盈来谢谢你',
  '慢跑也好、拉伸也好，只要动起来，僵硬的肩膀就会慢慢松开',
  '如果一件事看起来太难，就先只做它的前五分钟，很多阻力会在开始后消失',
  '那些你以为微不足道的微小自律，合起来就是别人眼里闪闪发光的状态',
  '今天不用讨好所有人，先把自己这一天的节奏照顾舒服',
  '给自己倒一杯热水，慢慢看一眼今天想完成的小清单吧',
  '时间不会辜负认真生活的人，你每天留下的小印章都在替你作证',
  '即使今天只完成了最容易的那一项，也值得给自己盖一个鼓励的章',
  '当思绪太乱时，动笔写下来或者出门走二十分钟，答案常常会自己浮出来',
  '别害怕慢，最怕的是因为追求一步到位而迟迟不敢迈出第一步',
  '每一顿细嚼慢咽的饭，都是在告诉忙碌的世界：我现在要好好照顾自己',
  '把夜晚还给安静和好梦，白天的事就放心交给明早清醒的自己',
  '今天也试着少责备自己一句，多看见自己做得不错的小细节',
  '坚持的意义不在于从不中断，而在于每次停下后依然记得温柔地回到轨道',
  '阳光照进窗台的时候，不妨起身站一会儿，给眼睛和肩膀放个小假',
  '一点点变好就够了，不必急着脱胎换骨，舒适的成长才最长久',
  '你已经走过很多个以为过不去的日子了，今天这一关也一样没问题',
  '把想做的事放进今天的节奏里，做完就坦坦荡荡地享受属于自己的空闲',
  '认真记录体重和心情不是为了焦虑，而是为了更懂自己身体的规律',
  '读完两页书、背完十个词，这些安静的小收获会悄悄把你变得更丰盈',
  '哪怕今天下着小雨，也可以在室内拉伸十分钟，把元气留给自己',
  '温柔地对待自己的节奏，好习惯会在不知不觉间生根发芽',
  '愿今天也有一个小瞬间，让你由衷地觉得「好好生活真不错」',
]

export const DONE_QUOTES: readonly string[] = [
  '今天的目标都完成啦，记得好好夸夸自己',
  '今日份任务全部点亮，剩下的时间安心放松吧',
  '又把今天稳稳拿下了，这一枚印章属于认真的你',
  '今天的计划全部达标，洗个热水澡早点休息吧',
  '所有小目标都打完勾啦，此刻的踏实感真好',
  '今天的努力已经全部存进账本里，晚安前别忘了奖励自己一段轻松时光',
  '一步一步把今天走完了，你的坚持比想象中更有力量',
  '今日清单清零成功，把剩下的温柔留给喜欢的音乐和好梦吧',
  '今天也照顾好了自己的节奏，明天继续这样舒舒服服地前行',
  '全部打卡完成，你正在一点点成为让自己安心的那个人',
  '今日份元气满分收官，剩下的时间只管自在享受生活',
  '今天画上了一个漂亮的句号，好好歇一歇，明天见',
]

export type QuoteBucket = 'daily' | 'done'

export interface QuoteDeckState {
  deck: number[]
  cursor: number
  lastIdx: number | null
}

type StoredQuoteState = Partial<Record<QuoteBucket, QuoteDeckState>>

function shuffleIndices(length: number, avoidFirst: number | null, rand: () => number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  if (avoidFirst !== null && arr.length > 1 && arr[0] === avoidFirst) {
    const swapIdx = 1 + Math.floor(rand() * (arr.length - 1))
    const tmp = arr[0]!
    arr[0] = arr[swapIdx]!
    arr[swapIdx] = tmp
  }
  return arr
}

function isValidDeck(
  state: QuoteDeckState | undefined,
  poolLength: number,
): state is QuoteDeckState {
  if (!state || !Array.isArray(state.deck) || state.deck.length !== poolLength) return false
  if (typeof state.cursor !== 'number' || !Number.isInteger(state.cursor) || state.cursor < 0)
    return false
  return state.deck.every((n) => Number.isInteger(n) && n >= 0 && n < poolLength)
}

/**
 * 纯函数：从无重复洗牌队列中抽取下一条语录并返回更新后的队列状态。
 * - 一轮抽完自动重新洗牌，且保证新轮首句不与上一句重复。
 */
export function drawNextQuote(
  pool: readonly string[],
  prev: QuoteDeckState | undefined,
  rand: () => number = Math.random,
): { quote: string; nextState: QuoteDeckState } {
  if (pool.length === 0) {
    return { quote: '新的一天，从一小步开始', nextState: { deck: [], cursor: 0, lastIdx: null } }
  }
  let deck: number[]
  let cursor: number
  if (isValidDeck(prev, pool.length) && prev.cursor < prev.deck.length) {
    deck = prev.deck
    cursor = prev.cursor
  } else {
    const avoid =
      prev && typeof prev.lastIdx === 'number' && prev.lastIdx >= 0 && prev.lastIdx < pool.length
        ? prev.lastIdx
        : null
    deck = shuffleIndices(pool.length, avoid, rand)
    cursor = 0
  }
  const pickedIdx = deck[cursor]!
  return {
    quote: pool[pickedIdx]!,
    nextState: {
      deck,
      cursor: cursor + 1,
      lastIdx: pickedIdx,
    },
  }
}

/** 判断后台切回前台是否已超过冷却时间，避免短切应用频繁打断当前阅读 */
export function shouldRefreshOnReturn(
  hiddenAtMs: number | null,
  nowMs: number,
  cooldownMs = RETURN_COOLDOWN_MS,
): boolean {
  if (hiddenAtMs === null) return false
  return nowMs - hiddenAtMs >= cooldownMs
}

export function quoteBucketFor(completion: { done: number; planned: number }): QuoteBucket {
  return completion.planned > 0 && completion.done >= completion.planned ? 'done' : 'daily'
}

function readStoredState(): StoredQuoteState {
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as StoredQuoteState
  } catch {
    return {}
  }
}

function writeStoredState(next: StoredQuoteState) {
  try {
    window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式或配额满时静默降级为内存抽句
  }
}

/** 客户端抽取下一条治愈语录并写回洗牌进度（仅在客户端 effect / 事件回调中调用） */
export function nextQuoteFromStorage(bucket: QuoteBucket): string {
  const pool = bucket === 'done' ? DONE_QUOTES : DAILY_QUOTES
  const all = readStoredState()
  const { quote, nextState } = drawNextQuote(pool, all[bucket])
  writeStoredState({ ...all, [bucket]: nextState })
  return quote
}
