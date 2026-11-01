import { LinkButton } from '@/features/dashboard/components/link-button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-display font-bold">404</h1>
      <p className="text-body text-muted">这个页面走丢了</p>
      <LinkButton href="/">回到首页</LinkButton>
    </div>
  )
}
