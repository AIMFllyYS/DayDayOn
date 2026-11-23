import type { ModuleTone } from '@/components/ui/tone'
import type { PosterScene } from '../types'
import { customScene } from './custom'
import { dietScene } from './diet'
import { exerciseScene } from './exercise'
import { skipScene } from './skip'
import { sleepScene } from './sleep'
import { studyScene } from './study'

/* 海报场景注册表：唯一按板块分发构图的地方；场景文件之间互不 import。 */
export const POSTER_SCENES: Record<ModuleTone, PosterScene> = {
  diet: dietScene,
  exercise: exerciseScene,
  sleep: sleepScene,
  study: studyScene,
  custom: customScene,
}

export { skipScene }
