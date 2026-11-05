import type { Metadata } from 'next'
import { SleepFlowSandbox } from './_components/sleep-flow'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  SleepDualThresholdRulesDemo,
  SleepRefereeComparisonMatrix,
} from './_components/sleep-module-demos'

export const metadata: Metadata = { title: '睡眠板块 · 早点睡' }

export default function SleepModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.sleep!}
      sandbox={<SleepFlowSandbox />}
      compare={<SleepRefereeComparisonMatrix />}
      rules={<SleepDualThresholdRulesDemo />}
    />
  )
}
