import { useSyncExternalStore } from 'react'
import type { Sketch } from './sketch/types'
import {
  ANNOTATION_SCHEMA,
  annotationCategories,
  annotationPriorities,
  type Annotation,
  type AnnotationExport,
} from './types'

const categoryValues = new Set<string>(annotationCategories.map((c) => c.value))
const priorityValues = new Set<string>(annotationPriorities.map((p) => p.value))

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// localStorage 和导入的文件都可能被手改过，逐项检查关键字段，不合格的条目直接丢弃
function isAnnotation(v: unknown): v is Annotation {
  if (!isRecord(v)) return false
  const { id, route, comment, category, priority, status, target, point } = v
  return (
    typeof id === 'string' &&
    typeof route === 'string' &&
    typeof comment === 'string' &&
    typeof category === 'string' &&
    categoryValues.has(category) &&
    typeof priority === 'string' &&
    priorityValues.has(priority) &&
    (status === 'open' || status === 'resolved') &&
    isRecord(target) &&
    typeof target.selector === 'string' &&
    isRecord(target.rect) &&
    isRecord(point)
  )
}

function isSketch(v: unknown): v is Sketch {
  if (!isRecord(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    (v.frame === 'phone' || v.frame === 'desktop' || v.frame === 'free') &&
    Array.isArray(v.items) &&
    v.items.every((i) => isRecord(i) && typeof i.id === 'string' && typeof i.kind === 'string')
  )
}

/** 一个 localStorage 键对应一个可订阅的列表 */
function createListStore<T extends { id: string }>(key: string, guard: (v: unknown) => v is T) {
  const EMPTY: T[] = []
  let cache: T[] | null = null
  const listeners = new Set<() => void>()

  const read = (): T[] => {
    if (cache) return cache
    try {
      const raw = window.localStorage.getItem(key)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      cache = Array.isArray(parsed) ? parsed.filter(guard) : []
    } catch {
      cache = []
    }
    return cache
  }

  const write = (next: T[]) => {
    cache = next
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // 截图多了会超过 localStorage 的 5MB 上限：本次会话里仍然可用，但刷新后会丢
      window.alert(
        '本地存储空间不够了（截图比较占地方）。请先在批注列表里导出 JSON，再删掉已处理的批注。',
      )
    }
    listeners.forEach((l) => l())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    // 另一个标签页改了数据时同步过来
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      cache = null
      listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  }

  function useList(): T[] {
    return useSyncExternalStore(subscribe, read, () => EMPTY)
  }

  return {
    read,
    useList,
    upsert(item: T) {
      const list = read()
      write(
        list.some((x) => x.id === item.id)
          ? list.map((x) => (x.id === item.id ? item : x))
          : [...list, item],
      )
    },
    update(id: string, patch: Partial<T>) {
      write(read().map((x) => (x.id === id ? { ...x, ...patch } : x)))
    },
    remove(id: string) {
      write(read().filter((x) => x.id !== id))
    },
    clear() {
      write([])
    },
    /** 导入：按 id 合并，同 id 以导入的为准 */
    merge(items: T[]) {
      const byId = new Map(read().map((x) => [x.id, x]))
      items.forEach((x) => byId.set(x.id, x))
      write([...byId.values()])
    },
  }
}

const annotations = createListStore<Annotation>('daydayon:annotations:v1', isAnnotation)
const sketches = createListStore<Sketch>('daydayon:sketches:v1', isSketch)

export const useAnnotations = annotations.useList
export const useSketches = sketches.useList

export const annotationStore = {
  add: annotations.upsert,
  update(id: string, patch: Partial<Omit<Annotation, 'id' | 'createdAt'>>) {
    annotations.update(id, { ...patch, updatedAt: new Date().toISOString() })
  },
  /** 删除批注时一并删除它的草图 */
  remove(id: string) {
    const sketchId = annotations.read().find((a) => a.id === id)?.sketchId
    if (sketchId) sketches.remove(sketchId)
    annotations.remove(id)
  },
  clear() {
    annotations.clear()
    sketches.clear()
  },
}

export const sketchStore = {
  save: sketches.upsert,
  remove: sketches.remove,
  get: (id: string) => sketches.read().find((s) => s.id === id),
}

/** 解析导入的文件：接受 v1（只有批注）和 v2（批注 + 草图），也接受直接是数组的旧格式 */
export function parseExport(raw: unknown): { items: Annotation[]; sketches: Sketch[] } {
  const items = isRecord(raw) && Array.isArray(raw.items) ? raw.items : raw
  const sk = isRecord(raw) && Array.isArray(raw.sketches) ? raw.sketches : []
  return {
    items: Array.isArray(items) ? items.filter(isAnnotation) : [],
    sketches: sk.filter(isSketch),
  }
}

export function importExport(data: { items: Annotation[]; sketches: Sketch[] }) {
  sketches.merge(data.sketches)
  annotations.merge(data.items)
}

export function buildExport(items: Annotation[]): AnnotationExport {
  const ids = new Set(items.map((a) => a.sketchId).filter(Boolean))
  return {
    schema: ANNOTATION_SCHEMA,
    app: 'DayDayOn',
    exportedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    items,
    sketches: sketches.read().filter((s) => ids.has(s.id)),
  }
}

export function exportFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`
  return `annotations-${stamp}.json`
}
