'use client'

import { Icon, type IconName } from '@/components/ui/icon'
import { softToneClass, type Tone } from '@/components/ui/tone'
import type { RefereeTier } from '@/features/referee/schemas'
import { cn } from '@/lib/cn'

/*
 * 个人体质档位（饮食的「你是哪一类人群」）：目标设置与新人引导共用。
 * 文案取自 Playbook rule-config-primitives 的 CONSTITUTION_TIERS，只留选择需要的两行。
 */

export const TIER_META: Record<
  RefereeTier,
  { name: string; who: string; rule: string; tone: Tone; icon: IconName }
> = {
  'strict-fat-loss': {
    name: '减脂严管',
    who: '偏胖或正在减脂（BMI ≥ 24）',
    rule: '晚间碳水、油脂、甜点扣得更重',
    tone: 'danger',
    icon: 'flame',
  },
  'balanced-glycemic': {
    name: '控糖均衡',
    who: '标准体型，想吃得平稳健康',
    rule: '对标《中国居民膳食指南》',
    tone: 'diet',
    icon: 'shield',
  },
  'gentle-gain': {
    name: '增肌温和',
    who: '偏瘦或在练力量（BMI < 18.5）',
    rule: '放宽干净碳水，蛋白不足会扣分',
    tone: 'exercise',
    icon: 'bolt',
  },
}

const ORDER: RefereeTier[] = ['strict-fat-loss', 'balanced-glycemic', 'gentle-gain']

/** 按 BMI 推荐档位；没有身高体重时返回 null */
export function suggestTier(heightCm: number | null, weightKg: number | null): RefereeTier | null {
  if (!heightCm || !weightKg) return null
  const bmi = weightKg / (heightCm / 100) ** 2
  if (bmi >= 24) return 'strict-fat-loss'
  if (bmi < 18.5) return 'gentle-gain'
  return 'balanced-glycemic'
}

export function TierPicker({
  value,
  onChange,
  suggested,
}: {
  value: RefereeTier
  onChange: (tier: RefereeTier) => void
  suggested?: RefereeTier | null
}) {
  return (
    <div role="radiogroup" aria-label="个人体质档位" className="grid gap-1.5 sm:grid-cols-3">
      {ORDER.map((id) => {
        const t = TIER_META[id]
        const on = id === value
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cn(
              'flex min-w-0 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
              on
                ? 'border-border-strong bg-surface shadow-soft'
                : 'border-border bg-surface-sunken hover:bg-surface',
            )}
          >
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-lg',
                softToneClass[t.tone],
              )}
            >
              <Icon name={t.icon} size={14} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption flex items-center gap-1 font-bold">
                {t.name}
                {suggested === id && (
                  <span className="text-tiny bg-primary-soft text-primary-ink rounded-full px-1.5 font-semibold">
                    推荐
                  </span>
                )}
              </span>
              <span className="text-tiny text-muted leading-snug">{t.who}</span>
              <span className="text-tiny text-subtle leading-snug">{t.rule}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
