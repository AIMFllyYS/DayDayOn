import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../../_components/section'
import {
  DietConstitutionAndRuleSection,
  DietFullPageSandbox,
  DietRefereeScenariosMatrix,
} from './_components/diet-demos'

export const metadata: Metadata = { title: '饮食板块 · 好好吃饭' }

export default function DietModulePlaybookPage() {
  return (
    <>
      <PageHeader
        title="好好吃饭 · 饮食板块深度设计"
        description="基于《中国居民膳食指南 2022》与早中晚 GI 升糖节律构建的 5 分制 AI 饮食裁判体系：支持按个人体质分档执裁（减脂严管 / 控糖均衡 / 增肌温和），超过 3.0 分方能盖章计入有效打卡，吃炸鸡汉堡与含糖可乐直接触发 -5.0 分熔断并降级为「仅保存饮食记录」。"
        docRef="ui-design-system.md · ai-and-quota.md · ADR-0002"
      />

      <Section
        ann="playbook.modules.diet.constitution-and-rules"
        title="01 · 个人体质档位与饮食目标检验规则（PersonalConstitutionTierPicker & GoalVerificationRuleCard）"
        description="不同体质的饮食判罚标准截然不同：偏胖减脂期严控油脂、精制糖与晚间碳水，垃圾食品一票否决；标准体型对标膳食指南均衡控糖；偏瘦增肌期放宽干净复合碳水，重点考核优质蛋白质达标率。"
      >
        <DietConstitutionAndRuleSection />
      </Section>

      <Section
        ann="playbook.modules.diet.referee-matrix"
        title="02 · 6 维科学营养与升糖裁判体系（5 分制评分原子组件 DietRefereeScoreCard）"
        description="每行 2 张卡片（md:grid-cols-2）对比展示四大经典场景：A 清洁午餐 4.4 分通过、B 晚餐炸鸡可乐 0.0 分熔断拦截、C 午饭后小冰淇淋 3.3 分擦线及格、D 晚餐红油牛肉面 2.4 分隐形高钠高碳水不及格。内置 5.0 分仪表环、3.0 分有效打卡门槛标尺、四大餐盘均衡条、早中晚 GI 节律指示器与 DeepSeek 联网权威核验条。"
      >
        <DietRefereeScenariosMatrix />
      </Section>

      <Section
        ann="playbook.modules.diet.full-page-sandbox"
        title="03 · 饮食板块完整页面沙盒（PhoneFrame 手机端完整页 + 右侧场景切换器）"
        description="在左侧 360px 手机外框内完整呈现「好好吃饭」打卡页：顶部统一三态 Tab（手动填写 | 智能拍照 | 智能上传）+ 餐次选择 + 极简扫描镜 + 食物清单编辑 + 5 分制 AI 裁判成绩单 + 底部动态主按钮（> 3.0 分时确认有效打卡，≤ 3.0 分时降级为仅保存记录）。"
      >
        <DietFullPageSandbox />
      </Section>

      <Section ann="playbook.modules.diet.guidelines" title="饮食板块设计守则">
        <Rules
          dos={[
            '实行 5.0 分制科学饮食裁判，明确标出「3.0 分有效打卡门槛线」，高于 3.0 分才允许盖有效打卡章',
            '炸鸡、汉堡、薯条、含糖碳酸饮料等一级垃圾食品触发 -5.0 分一票否决，得分归零并显示「仅作饮食记录存档，不计入今日有效打卡」',
            '结合早·中·晚碳水与 GI 升糖节律判罚：早上防空腹高 GI 飙糖、中午允许适量复合碳水、晚上严控精制面食与甜品',
            '纳入烹饪方式与隐形油盐糖评估（如红油重盐汤底、糖醋勾芡），并展示 DeepSeek 联网检索《中国居民膳食指南 2022》的核验依据',
            '保持治愈手账奶油浅色风格，卡片网格最多 md:grid-cols-2，手机框内全单列排布确保 0 溢出',
          ]}
          donts={[
            '不要让用户随便拍一顿炸鸡夜宵或可乐也能混过「好好吃饭」有效打卡',
            '不要只算总热量（kcal）而忽略升糖指数（GI）、钠含量（mg）、添加糖（g）和优质蛋白配比',
            '不要对所有体型一刀切：偏瘦增肌用户吃足干净米饭不应被扣分，而大基数减脂用户晚间高碳水必须严管',
            '不要使用深色实底块或非语义字号（text-sm / text-xs / text-lg）',
          ]}
        />
      </Section>
    </>
  )
}
