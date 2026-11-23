import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../_components/section'
import { SharePosterGallery } from './_components/share-poster-gallery'

export const metadata: Metadata = { title: '分享海报' }

export default async function SharePostersPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>
}) {
  const { case: only } = await searchParams
  return (
    <>
      <PageHeader
        title="分享海报"
        description="打卡完成后生成的分享图。每个板块是一件和打卡内容有关的手账实物：饮食是小食堂小票和餐盘，运动是号码布和跑道，睡眠是夜空星图，学习是活页笔记和番茄钟，自定义是票根和集章卡，跳过打卡是请假条。"
        docRef="ui-design-system.md 第 6 节"
      />
      <Section
        ann="playbook.share-posters.gallery"
        title="全部板块 × 打卡设置"
        description="数据由真实裁判函数 judge() 算出；切换比例查看横版与竖版两套构图。"
      >
        <SharePosterGallery only={only} />
      </Section>
      <Section ann="playbook.share-posters.rules" title="设计约定">
        <Rules
          dos={[
            '底纸、眉栏、宠物评语、裁判核验、扫码页脚是共用版块，各板块只换中间的「手账实物」',
            '颜色只读 globals.css 的 token：板块色只表示本板块，营养素等分类用主题色与板块三档色区分',
            '整张海报只有睡眠的夜空是深色实底，上面用奶油色字',
            '内容多了折叠成「等共 N 样 / 还有 N 项」，不缩小字号硬塞',
          ]}
          donts={[
            '不要让某个板块复用另一个板块的版式',
            '不要在海报里写死色值或借用其他板块色表示分类',
            '不要把用户上传的图片画进海报',
          ]}
        />
      </Section>
    </>
  )
}
