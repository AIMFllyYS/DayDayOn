import type { Module } from '@/features/shared/schemas'
import { customModule } from './custom'
import { dietModule } from './diet'
import { exerciseModule } from './exercise'
import { sleepModule } from './sleep'
import { studyModule } from './study'
import type { CheckinModuleDef } from './types'

/*
 * 打卡板块注册表：唯一知道全部板块的前端入口（checkin-modules.md 第 2 节）。
 * 打卡页、目标设置、新人引导都从这里按 Module 取板块定义，自己不写板块分支。
 */
export const CHECKIN_MODULES: { [M in Module]: CheckinModuleDef<M> } = {
  diet: dietModule,
  exercise: exerciseModule,
  sleep: sleepModule,
  study: studyModule,
  custom: customModule,
}

export function moduleDef(module: Module): CheckinModuleDef {
  return CHECKIN_MODULES[module] as unknown as CheckinModuleDef
}
