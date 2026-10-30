import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted">这个页面走丢了</p>
      <Link href="/" className="bg-foreground text-background rounded-full px-5 py-2">
        回到首页
      </Link>
    </div>
  )
}
