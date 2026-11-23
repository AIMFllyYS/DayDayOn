'use client'

import { useState } from 'react'
import { Collapse } from '@/components/ui/collapse'
import { Icon, type IconName } from '@/components/ui/icon'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import type { TodoLayoutMode } from '../rules'
import type { TodoTag } from '../schemas'

/*
 * 待办右上角「菜单」下拉浮层（复用 Base UI Popover + Collapse）：
 * - 收纳视图切换、按标签筛选（二级小折叠菜单）、管理分组、已归档、全部展开/收起；
 * - 避免在顶部堆满自定义标签，保持顶部双导航栏简洁清爽。
 */

interface TodoActionsMenuProps {
  mode: TodoLayoutMode
  onModeChange: (mode: TodoLayoutMode) => void
  availableTags: readonly TodoTag[]
  activeTag?: string
  onTagChange: (tag: string | undefined) => void
  onOpenGroupManager: () => void
  onNavigateArchived: () => void
  archivedCount: number
  onExpandAllGroups: () => void
  onCollapseAllGroups: () => void
}

const menuRowClass =
  'text-caption text-foreground hover:bg-surface-sunken flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left font-semibold transition-colors duration-(--dur-fast)'

export function TodoActionsMenu({
  mode,
  onModeChange,
  availableTags,
  activeTag,
  onTagChange,
  onOpenGroupManager,
  onNavigateArchived,
  archivedCount,
  onExpandAllGroups,
  onCollapseAllGroups,
}: TodoActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setTagFilterOpen(false)
  }

  function runAndClose(action: () => void) {
    handleOpenChange(false)
    action()
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      align="end"
      side="bottom"
      sideOffset={6}
      clean
      className="min-w-52 p-1.5"
      trigger={
        <button
          type="button"
          aria-label="待办菜单"
          className={cn(
            'ease-spring text-caption inline-flex h-8.5 items-center gap-1 rounded-full border px-2.5 font-semibold transition-[transform,background-color,border-color,color] duration-(--dur-fast) active:scale-95',
            activeTag
              ? 'border-primary/40 bg-primary-soft text-primary-ink'
              : 'border-border bg-surface text-foreground hover:bg-surface-sunken',
          )}
        >
          <Icon name="menu" size={15} lineOnly />
          <span>菜单</span>
          {activeTag && <span aria-hidden className="bg-primary size-1.5 rounded-full" />}
        </button>
      }
    >
      <div role="menu" aria-label="待办菜单" className="flex flex-col gap-0.5">
        <MenuRow
          icon={mode === 'list' ? 'quadrant' : 'todo'}
          label={mode === 'list' ? '切换为四象限视图' : '切换为列表视图'}
          onClick={() => runAndClose(() => onModeChange(mode === 'list' ? 'quadrant' : 'list'))}
        />

        {/* 按标签筛选：二级小折叠菜单（仅列表模式显示） */}
        {mode === 'list' && (
          <div className="flex flex-col">
            <button
              type="button"
              aria-expanded={tagFilterOpen}
              onClick={() => setTagFilterOpen((prev) => !prev)}
              className={cn(menuRowClass, tagFilterOpen && 'bg-surface-sunken/80')}
            >
              <Icon name="tag" size={17} />
              <span className="min-w-0 flex-1 truncate">按标签筛选</span>
              {activeTag && (
                <span className="bg-primary-soft text-primary-ink text-tiny max-w-20 truncate rounded-full px-1.5 py-0.5 leading-none font-semibold">
                  #{activeTag}
                </span>
              )}
              <Icon
                name="chevron-down"
                size={15}
                className={cn(
                  'text-subtle shrink-0 transition-transform duration-(--dur-base)',
                  tagFilterOpen && 'rotate-180',
                )}
              />
            </button>

            <Collapse open={tagFilterOpen} unmountOnCollapse>
              <div className="bg-surface-sunken/70 mx-1 my-1 max-h-44 overflow-y-auto overscroll-contain rounded-xl p-1">
                {availableTags.length === 0 ? (
                  <p className="text-tiny text-subtle px-2.5 py-2 text-center">暂无自定义标签</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => runAndClose(() => onTagChange(undefined))}
                      className={cn(
                        'text-tiny flex min-h-8.5 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-left transition-colors',
                        activeTag === undefined
                          ? 'bg-primary-soft text-primary-ink font-semibold'
                          : 'text-muted hover:bg-surface hover:text-foreground font-medium',
                      )}
                    >
                      <span>全部标签</span>
                      {activeTag === undefined && <Icon name="check" size={14} lineOnly />}
                    </button>

                    {availableTags.map((t) => {
                      const selected = activeTag === t.name
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            runAndClose(() => onTagChange(selected ? undefined : t.name))
                          }
                          className={cn(
                            'text-tiny flex min-h-8.5 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-left transition-colors',
                            selected
                              ? 'bg-primary-soft text-primary-ink font-semibold'
                              : 'text-foreground hover:bg-surface font-medium',
                          )}
                        >
                          <span className="min-w-0 flex-1 truncate">#{t.name}</span>
                          {selected && (
                            <Icon name="check" size={14} className="shrink-0" lineOnly />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </Collapse>
          </div>
        )}

        <MenuRow icon="folder" label="管理分组" onClick={() => runAndClose(onOpenGroupManager)} />

        <MenuRow
          icon="archive"
          label={archivedCount > 0 ? `已归档（${archivedCount}）` : '已归档'}
          onClick={() => runAndClose(onNavigateArchived)}
        />

        {mode === 'list' && (
          <>
            <div className="bg-border mx-2 my-1 h-px" />
            <MenuRow
              icon="chevron-down"
              label="展开全部分组"
              onClick={() => runAndClose(onExpandAllGroups)}
            />
            <MenuRow
              icon="chevron-up"
              label="收起全部分组"
              onClick={() => runAndClose(onCollapseAllGroups)}
            />
          </>
        )}
      </div>
    </Popover>
  )
}

function MenuRow({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={menuRowClass}>
      <Icon name={icon} size={17} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}
