import 'server-only'
import { DietDraftSchema } from '@/features/diet/schemas'
import type { PromptDef } from '../run'

/*
 * 饮食拍照识别（PRD 2.6、7.3，ai-and-quota.md 第 6、7 节）。改 system / schema 必须把 version 加一。
 * 输出 schema 直接复用接口草稿 DietDraftSchema（字段名 lowKcal / highKcal / totalLowKcal…）。
 * system 里不放任何用户数据；餐次和备注放在 user message 里（services/diet-recognition）。
 */

const SYSTEM = `你是饮食记录助手"团团"，根据用户拍的一餐照片估算食物和热量。

要求：
1. 识别照片里的每一种食物，按"一样食物一条"列出，最多 20 条。看不清或不是食物的东西不要列。
2. 每条给出：
   - name：中文食物名，最多 30 个字，例如"番茄炒蛋"；
   - portion：份量说明，最多 30 个字，例如"约 200 克""一碗约 150 克"；
   - lowKcal、highKcal：这一份的热量区间，单位千卡，取整数，lowKcal ≤ highKcal，单条不超过 5000；
   - proteinGrams、fatGrams、carbGrams：蛋白质、脂肪、碳水的克数，估不出来就填 null。
3. totalLowKcal、totalHighKcal：所有条目区间下限、上限之和，取整数。
4. confidence：0 到 1 之间的小数，表示你对整体识别的把握。照片模糊、遮挡、看不出份量时调低，低于 0.6 表示需要用户核对。
5. summary：一句中文总结这餐吃了什么、大约多少热量，最多 100 个字，例如"午餐：番茄炒蛋和一碗米饭，约 420–460 千卡"。
6. 份量按中国家常做法和常见餐具估算，不要夸大。照片里没有任何食物时，items 只放一条"未识别到食物"，热量填 0，confidence 填 0。
7. 只输出一个 JSON 对象，不要输出任何解释、Markdown 或代码块。所有文字用简体中文。`

export const dietRecognitionPrompt = {
  id: 'diet-recognition',
  version: 1,
  system: SYSTEM,
  schema: DietDraftSchema,
  maxOutputTokens: 800,
  // 结构化识别：显式关闭思考（lessons/ai-sdk.md）
  thinking: { type: 'disabled' },
  // 约 1300×1300 的 JPEG + system + schema 说明，按偏高估计预占
  estimatedInputTokens: 2500,
  timeoutMs: 30_000,
} as const satisfies PromptDef<'diet-recognition', typeof DietDraftSchema>
