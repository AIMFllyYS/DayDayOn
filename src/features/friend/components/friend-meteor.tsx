'use client'

import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { friendActions, useFriendStore, type MeteorFlight } from '../friend-store'

interface FlightCoords {
  startX: number
  startY: number
  endX: number
  endY: number
}

function ActiveMeteor({ flight }: { flight: MeteorFlight }) {
  const [coords, setCoords] = useState<FlightCoords | null>(null)
  const [flying, setFlying] = useState(false)

  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      const startX = window.innerWidth / 2
      const startY = window.innerHeight / 2
      const anchor = document.querySelector<HTMLElement>('[data-friend-avatar-anchor="true"]')
      const rect = anchor?.getBoundingClientRect()
      const endX = rect ? rect.left + rect.width / 2 : 40
      const endY = rect ? rect.top + rect.height / 2 : 36
      setCoords({ startX, startY, endX, endY })
      raf2 = requestAnimationFrame(() => {
        setFlying(true)
      })
    })

    const timer = window.setTimeout(() => {
      friendActions.completeMeteorFlight()
    }, 620)

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.clearTimeout(timer)
    }
  }, [flight.id])

  if (!coords) return null

  const dx = coords.endX - coords.startX
  const dy = coords.endY - coords.startY
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <div
        style={{
          left: `${coords.startX}px`,
          top: `${coords.startY}px`,
          transform: flying
            ? `translate3d(${dx}px, ${dy}px, 0) scale(0.55)`
            : 'translate3d(0, 0, 0) scale(1.1)',
          opacity: flying ? 0.92 : 1,
          transition: 'transform 580ms cubic-bezier(0.22, 1, 0.36, 1), opacity 580ms ease-out',
        }}
        className="fixed -translate-x-1/2 -translate-y-1/2"
      >
        <div
          style={{
            transform: `rotate(${angleDeg}deg)`,
          }}
          className="relative flex items-center"
        >
          <div className="from-primary/0 via-primary/55 to-primary absolute right-4 h-2.5 w-28 rounded-full bg-gradient-to-r blur-[2px]" />
          <div className="bg-primary/30 absolute -inset-3 animate-ping rounded-full" />
          <div className="ring-primary shadow-float relative rounded-full ring-2">
            <Avatar name={flight.friendNickname} avatar={flight.friendAvatar} size="sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 接受好友邀请后的仪式感流星动画：
 * 从屏幕正中央（二次确认弹窗隐去处）划出一道发光流星飞向左上角顶栏头像，
 * 抵达后触发左上角 AvatarStack 弹出成双/多头像，并浮现引导提示气泡。
 */
export function FriendMeteorOverlay() {
  const { meteorFlight } = useFriendStore()
  if (!meteorFlight) return null
  return <ActiveMeteor key={meteorFlight.id} flight={meteorFlight} />
}
