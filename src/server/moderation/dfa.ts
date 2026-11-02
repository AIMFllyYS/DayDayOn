/**
 * 本地 DFA 敏感词过滤引擎（Issue #23 & #24 · M5）
 *
 * 特性：
 * 1. 100% 内存 Trie 树实现，无外部网络请求与 AI Token 消耗。
 * 2. 文本规范化：Unicode NFKC 规范化 + 小写折叠。
 * 3. 干扰字符跳跃：在关键词字符之间最多允许跳过 3 个非字母数字的干扰字符（空格、标点符号、特殊符号、Emoji 等）。
 * 4. 分类敏感词库：abuse（辱骂）、politics（涉政）、violence（暴恐违禁）、ad（广告黑产）、custom（自定义）。
 * 5. 纯函数检出 checkText 与过滤掩码替换 filterText。
 */

export interface TrieNode {
  children: Map<string, TrieNode>
  isEnd: boolean
  word?: string
  category?: string
}

export interface ModerationCheckResult {
  flagged: boolean
  category?: string
  word?: string
}

export interface MatchedSpan {
  start: number
  end: number
  word: string
  category: string
}

/** 默认分类词库 */
export const DEFAULT_WORD_BANKS: Record<string, string[]> = {
  abuse: [
    // 中文辱骂与人身攻击
    '傻逼',
    '沙比',
    '煞笔',
    '弱智',
    '脑残',
    '弱障',
    '智障',
    '白痴',
    '蠢猪',
    '操你妈',
    '草泥马',
    '肏你妈',
    '日你妈',
    '干你娘',
    '滚蛋',
    '滚粗',
    '混蛋',
    '王八蛋',
    '贱人',
    '畜生',
    '下贱',
    '婊子',
    '狗崽子',
    '狗娘养',
    '死全家',
    '去死吧',
    '狗东西',
    '废物',
    '没爹妈',
    '孤儿',
    '死爹',
    '死妈',
    '装逼',
    '二逼',
    '逼样',
    '妈的',
    '他妈的',
    '特么的',
    '操蛋',
    // 英文攻击词
    'fuck',
    'fucking',
    'fucker',
    'shit',
    'bitch',
    'asshole',
    'bastard',
    'dick',
    'pussy',
    'cunt',
    'motherfucker',
    'nigger',
    'nigga',
    'retard',
  ],
  politics: [
    '法轮功',
    '大法弟子',
    '李洪志',
    '真善忍',
    '退党',
    '退团',
    '九评',
    '藏独',
    '达赖',
    '疆独',
    '东突',
    '台独',
    '港独',
    '颠覆国家',
    '六四事件',
    '天安门事件',
    '8964',
    '双十暴动',
  ],
  violence: [
    // 枪支与违禁武器
    '枪支',
    '买枪',
    '手枪',
    '步枪',
    '弹药',
    '子弹',
    '黑枪',
    '炸弹',
    '雷管',
    '炸药',
    '自制炸药',
    '制造炸弹',
    '投毒',
    // 毒品与违禁药品
    '冰毒',
    '海洛因',
    '麻古',
    '大麻',
    '摇头丸',
    'k粉',
    '氯胺酮',
    '芬太尼',
    '吸毒',
    '贩毒',
    '走私毒品',
    // 暴恐与买凶
    '恐怖袭击',
    '恐怖分子',
    '圣战',
    '人肉炸弹',
    '砍死',
    '灭门',
    '买凶杀人',
    '雇凶',
    '自杀教程',
    '跳楼教程',
  ],
  ad: [
    // 违规引流与黑灰产
    '加微信',
    '加我微信',
    '加v信',
    '加vx',
    '加qq',
    '加我qq',
    '兼职刷单',
    '刷单兼职',
    '刷信誉',
    '代开发票',
    '办假证',
    '代办证件',
    '假身份证',
    '代考',
    '替考',
    '助考',
    '枪手',
    '作弊器材',
    '微粒贷强开',
    '信用卡套现',
    '花呗套现',
    '黑户贷款',
    '高利贷',
    '裸聊',
    '裸贷',
    '同城约炮',
    '包夜',
    '小姐上门',
    '外围女',
    '买春',
    '赌博',
    '网络赌博',
    '百家乐',
    '六合彩',
    '澳门博彩',
    '菠菜网站',
    '老虎机',
    '彩票稳赚',
    '传销',
    '资金盘',
    '投资返利',
    '稳赚不赔',
  ],
  custom: [],
}

/**
 * 校验字符是否属于非字母数字的干扰字符（空格、标点符号、特殊符号、Emoji 等）
 */
export function isNoiseChar(ch: string): boolean {
  return /^[^\p{L}\p{N}]$/u.test(ch)
}

/**
 * 单字符规范化：Unicode NFKC 规范化并转小写
 */
export function normalizeChar(ch: string): string {
  return ch.normalize('NFKC').toLowerCase()
}

/**
 * DFA 敏感词引擎实现类
 */
export class DfaEngine {
  private readonly root: TrieNode = { children: new Map(), isEnd: false }

  constructor(initialBanks?: Record<string, string[]>) {
    const banks = initialBanks ?? DEFAULT_WORD_BANKS
    for (const [category, words] of Object.entries(banks)) {
      this.addWords(words, category)
    }
  }

  /**
   * 动态添加单条敏感词
   */
  addWord(rawWord: string, category = 'custom'): void {
    const trimmed = rawWord.trim()
    if (!trimmed) return

    const normalized = trimmed.normalize('NFKC').toLowerCase()
    let curr = this.root
    for (const ch of Array.from(normalized)) {
      let next = curr.children.get(ch)
      if (!next) {
        next = { children: new Map(), isEnd: false }
        curr.children.set(ch, next)
      }
      curr = next
    }
    curr.isEnd = true
    curr.word = rawWord
    curr.category = category
  }

  /**
   * 批量添加敏感词
   */
  addWords(words: string[], category = 'custom'): void {
    for (const w of words) {
      this.addWord(w, category)
    }
  }

  /**
   * 检查文本是否命中敏感词
   */
  checkText(text: string): ModerationCheckResult {
    if (!text) return { flagged: false }

    const chars = Array.from(text)
    for (let i = 0; i < chars.length; i++) {
      const match = this.matchAt(chars, i)
      if (match) {
        return {
          flagged: true,
          category: match.category,
          word: match.word,
        }
      }
    }

    return { flagged: false }
  }

  /**
   * 过滤文本并替换敏感词为掩码
   * @param text 待过滤原始文本
   * @param mask 掩码符号（单字符如 '*' 时等长替换，多字符如 '[已过滤]' 时整体替换）
   */
  filterText(text: string, mask = '*'): string {
    if (!text) return ''

    const chars = Array.from(text)
    const matches = this.findAllMatches(text)
    if (matches.length === 0) return text

    for (const m of matches) {
      if (mask.length === 1) {
        for (let k = m.start; k < m.end; k++) {
          chars[k] = mask
        }
      } else {
        chars[m.start] = mask
        for (let k = m.start + 1; k < m.end; k++) {
          chars[k] = ''
        }
      }
    }

    return chars.join('')
  }

  /**
   * 契约方法兼容：返回 clean 与 matchedCategory
   */
  checkContent(text: string): { clean: boolean; matchedCategory?: string } {
    const res = this.checkText(text)
    return {
      clean: !res.flagged,
      matchedCategory: res.category,
    }
  }

  /**
   * 查找文本中全部非重叠匹配区间
   */
  findAllMatches(text: string): MatchedSpan[] {
    if (!text) return []

    const chars = Array.from(text)
    const matches: MatchedSpan[] = []
    let i = 0

    while (i < chars.length) {
      const match = this.matchAt(chars, i)
      if (match) {
        matches.push({
          start: i,
          end: match.end,
          word: match.word,
          category: match.category,
        })
        i = match.end
      } else {
        i++
      }
    }

    return matches
  }

  /**
   * 从指定下标开始在 Trie 树中尝试最大前缀匹配（支持跳过最多 3 个干扰符号）
   */
  private matchAt(
    chars: string[],
    startIndex: number,
  ): { end: number; word: string; category: string } | null {
    let node = this.root
    let lastMatch: { end: number; word: string; category: string } | null = null
    let j = startIndex
    let noiseCount = 0

    while (j < chars.length) {
      const char = chars[j]
      const norm = normalizeChar(char)

      let currSubNode: TrieNode | undefined = node
      let subMatched = true

      for (const subCh of Array.from(norm)) {
        if (currSubNode && currSubNode.children.has(subCh)) {
          currSubNode = currSubNode.children.get(subCh)
        } else {
          subMatched = false
          break
        }
      }

      if (subMatched && currSubNode) {
        node = currSubNode
        noiseCount = 0
        if (node.isEnd && node.word && node.category) {
          lastMatch = {
            end: j + 1,
            word: node.word,
            category: node.category,
          }
        }
        j++
      } else {
        // 如果已经命中关键词的前置字符，允许在字符间跳过最多 3 个干扰字符
        if (node !== this.root && isNoiseChar(char)) {
          if (noiseCount < 3) {
            noiseCount++
            j++
          } else {
            // 干扰字符超过 3 个，中止本次匹配
            break
          }
        } else {
          // 非干扰字符失配，或首字符未匹配即为干扰字符
          break
        }
      }
    }

    return lastMatch
  }
}

/** 默认全局单例 */
export const defaultDfa = new DfaEngine()

export function checkText(text: string): ModerationCheckResult {
  return defaultDfa.checkText(text)
}

export function filterText(text: string, mask?: string): string {
  return defaultDfa.filterText(text, mask)
}

export function checkContent(text: string): { clean: boolean; matchedCategory?: string } {
  return defaultDfa.checkContent(text)
}
