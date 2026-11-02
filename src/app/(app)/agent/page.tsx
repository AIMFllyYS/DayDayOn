import type { Metadata } from 'next'
import { AgentFullscreen } from '@/features/agent/components/agent-fullscreen'

export const metadata: Metadata = { title: '团团' }

/** Agent 全屏页：和悬浮弹窗共用同一个对话状态（AgentHost 提供） */
export default function AgentPage() {
  return <AgentFullscreen />
}
