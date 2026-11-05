import type { RulesOf } from '@/features/referee/schemas'
import type { ModuleDocs } from '../types'

/** 饮食二级页：达标规则 / 评判依据（阈值随用户设置变化） */
export function dietDocs(rules: RulesOf<'diet'>): ModuleDocs {
  const pass = rules.passScore.toFixed(1)
  return {
    glance: {
      threshold: `Agent 评分 > ${pass} 分才盖章；炸鸡、含糖饮料等一票否决`,
      tagline: '5 分制营养裁判 · 按体质分档执裁',
      pass: '午餐清蒸鱼 + 杂粮饭 + 西兰花 · 4.8 分',
      block: '晚餐炸鸡配可乐 · 0.0 分，仅记录热量',
    },
    rulesDoc: {
      title: '达标规则',
      sections: [
        {
          heading: '有效打卡线',
          items: [
            `Agent 评分 > ${pass} 分才盖有效章`,
            '5 分制，综合热量、蛋白质、膳食纤维、升糖指数、钠和烹饪方式',
            '未达标照常保存，只是不计入连击和排行',
          ],
        },
        {
          heading: '一票否决',
          items: ['炸鸡、汉堡、薯条、含糖碳酸饮料、奶茶：本餐直接 0 分', '热量仍会记入饮食账本'],
        },
        {
          heading: '按体质分档',
          items: [
            '减脂严管：晚间碳水、油脂与甜点扣分更重，热量走廊 300–700 kcal',
            '控糖均衡：对标膳食指南，热量走廊 350–800 kcal',
            '增肌温和：放宽干净复合碳水，蛋白不足会扣分，热量走廊 450–1000 kcal',
            '体质档位在「我的 → 目标设置」里改',
          ],
        },
      ],
    },
    basisDoc: {
      title: '评判依据',
      sections: [
        {
          heading: '营养标准',
          items: [
            '《中国居民膳食指南（2022）》、中国食物成分表',
            '每餐蛋白质 ≥ 15g 加分，≥ 25g 再加分',
            '膳食纤维 ≥ 5g 加分；钠 > 1500mg 扣分',
          ],
        },
        {
          heading: '升糖节律',
          items: [
            '按碳水加权计算综合 GI：≤ 55 低，56–69 中，≥ 70 高',
            '晚餐高 GI 额外扣分；甜点在晚餐和加餐扣得更重',
          ],
        },
        {
          heading: 'Agent 怎么算',
          items: [
            '先查内置营养表，查不到的菜才联网检索（最多 3 次）',
            '分数由达标规则计算，Agent 只负责估算每道菜的营养',
            '你的照片只用于识别，不会被保存',
          ],
        },
      ],
    },
  }
}
