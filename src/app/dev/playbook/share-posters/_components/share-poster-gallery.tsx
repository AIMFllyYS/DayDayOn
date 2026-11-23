'use client'

import { useEffect, useRef, useState } from 'react'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import {
  serializeSvgElementToDataUrl,
  type PosterOrientation,
} from '@/components/ui/report-share-sheet'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { renderReportPosterPng } from '@/features/checkin/share/report-poster'
import { cn } from '@/lib/cn'
import { POSTER_CASES, type PosterCase } from '../_data/poster-cases'

/*
 * 分享海报画廊：把每个板块、每种打卡设置的海报都真实渲染出来，横版 / 竖版一键切换。
 * 地址栏加 ?case=<id> 只渲染一张（调版式时用）。
 */

function PosterFrame({ item, orientation }: { item: PosterCase; orientation: PosterOrientation }) {
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ key: string; src: string | null; failed: boolean }>({
    key: '',
    src: null,
    failed: false,
  })
  const key = `${item.id}:${orientation}`

  useEffect(() => {
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      const svgEl = svgWrapRef.current?.querySelector('svg') ?? null
      renderReportPosterPng({
        ...item.input,
        orientation,
        mascotDataUrl: serializeSvgElementToDataUrl(svgEl),
      })
        .then((res) => {
          if (!cancelled) setState({ key, src: res.dataUrl, failed: false })
        })
        .catch(() => {
          if (!cancelled) setState({ key, src: null, failed: true })
        })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [item, orientation, key])

  const ready = state.key === key
  return (
    <figure
      data-ann={`playbook.share-posters.${item.id}`}
      className="border-border bg-surface flex flex-col overflow-hidden rounded-2xl border"
    >
      <div
        className={cn(
          'bg-surface-sunken grid place-items-center p-3',
          orientation === 'landscape' ? 'aspect-video' : 'aspect-9/16',
        )}
      >
        {ready && state.src ? (
          // 海报是运行时生成的 data URL，不走 next/image
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.src}
            alt={`${item.label}分享海报`}
            data-poster={key}
            className="shadow-card h-full w-full rounded-lg object-contain"
          />
        ) : ready && state.failed ? (
          <p className="text-caption text-danger-ink">海报生成失败</p>
        ) : (
          <Skeleton className="h-full w-full rounded-lg" />
        )}
      </div>
      <figcaption className="border-border border-t px-4 py-3">
        <p className="text-caption font-semibold">{item.label}</p>
        <p className="text-tiny text-muted mt-0.5">{item.note}</p>
        <p className="text-tiny text-subtle mt-1 font-mono">?case={item.id}</p>
      </figcaption>
      <div ref={svgWrapRef} aria-hidden className="pointer-events-none fixed -left-[9999px]">
        <MascotSvg character={item.character} mood={item.mood} size={160} />
      </div>
    </figure>
  )
}

export function SharePosterGallery({ only }: { only?: string }) {
  const [orientation, setOrientation] = useState<PosterOrientation>('landscape')
  const cases = only ? POSTER_CASES.filter((c) => c.id === only) : POSTER_CASES
  return (
    <div className="grid gap-4">
      <SegmentedControl
        label="海报比例"
        value={orientation}
        onValueChange={setOrientation}
        options={[
          { value: 'landscape', label: '16:9 横版' },
          { value: 'portrait', label: '9:16 竖版' },
        ]}
        className="max-w-xs"
      />
      <div
        className={cn(
          'grid gap-4',
          orientation === 'landscape' ? 'xl:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {cases.map((item) => (
          <PosterFrame key={item.id} item={item} orientation={orientation} />
        ))}
      </div>
    </div>
  )
}
