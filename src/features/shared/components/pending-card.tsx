import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'

/** F1 占位：跨领域组件的 props 已定、实现未落地时渲染。实现方落地后删掉对它的引用 */
export function PendingCard({ title, owner }: { title: string; owner: string }) {
  return (
    <Card variant="sunken">
      <CardHeader title={title} description="待实现">
        <Badge>{owner}</Badge>
      </CardHeader>
    </Card>
  )
}
