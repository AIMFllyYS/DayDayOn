export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="加载中">
      <div className="border-muted/30 border-t-foreground h-8 w-8 animate-spin rounded-full border-4" />
    </div>
  )
}
